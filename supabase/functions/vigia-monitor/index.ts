import { createClient } from "npm:@supabase/supabase-js@2.45.0";
import { corsHeaders } from "../_shared/cors.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const RESEND_KEY = Deno.env.get("RESEND_API_KEY") ?? "";

const sb = createClient(SUPABASE_URL, SERVICE_KEY);

/**
 * Calcula la severidad de una alerta combinando el tamaño del salto (delta)
 * con el nivel absoluto del IRCA. Un delta pequeño puede ser crítico si el
 * municipio ya estaba en zona roja; un delta grande es alta aunque venga de
 * una base baja. Umbrales calibrados con la varianza histórica nacional.
 */
function severidadFromDelta(delta: number, score: number): "info" | "baja" | "media" | "alta" | "critica" {
  if (score >= 75 && delta >= 5) return "critica";
  if (delta >= 15) return "alta";
  if (delta >= 8) return "media";
  if (delta >= 3) return "baja";
  return "info";
}

async function sendEmail(to: string, subject: string, html: string) {
  if (!RESEND_KEY) return { skipped: true };
  const r = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${RESEND_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: "RutaVital IA <alertas@resend.dev>",
      to: [to], subject, html,
    }),
  });
  return { ok: r.ok, status: r.status };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const t0 = Date.now();
  const { data: run } = await sb.from("agent_runs").insert({
    agente: "vigia", trigger: "vigia-monitor", modelo: "rule-engine-v1",
    input: {}, status: "running",
  }).select().single();

  try {
    // Necesitamos las 2 fechas distintas más recientes para calcular el delta
    // por municipio. Se piden 200 filas y se deduplican porque cada fecha
    // contiene ~1.122 snapshots (uno por municipio).
    const { data: fechas } = await sb
      .from("irca_snapshots")
      .select("fecha")
      .order("fecha", { ascending: false })
      .limit(200);
    const unicas = Array.from(new Set((fechas ?? []).map((f) => f.fecha))).slice(0, 2);
    if (unicas.length < 2) {
      await sb.from("agent_runs").update({
        status: "success", output: { msg: "Insuficientes snapshots", fechas: unicas },
        duracion_ms: Date.now() - t0,
      }).eq("id", run!.id);
      return new Response(JSON.stringify({ ok: true, msg: "Necesita 2 snapshots" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const [hoy, ayer] = unicas;

    const { data: actuales } = await sb.from("irca_snapshots").select("*").eq("fecha", hoy);
    const { data: prev } = await sb.from("irca_snapshots").select("muni_code,irca_score").eq("fecha", ayer);
    const prevMap = new Map((prev ?? []).map((p) => [p.muni_code, Number(p.irca_score)]));

    // Recorremos el snapshot de hoy y comparamos con el de ayer municipio
    // por municipio. Solo se generan alertas para deltas POSITIVOS ≥ 3 pts
    // (mejoras no se reportan como alerta; se podrían registrar aparte).
    const alertas: any[] = [];
    for (const a of actuales ?? []) {
      const before = prevMap.get(a.muni_code);
      if (before == null) continue;
      const delta = Number(a.irca_score) - before;
      if (delta < 3) continue;
      const sev = severidadFromDelta(delta, Number(a.irca_score));
      alertas.push({
        tipo: "delta_irca",
        severidad: sev,
        titulo: `IRCA ↑ ${delta.toFixed(1)} pts en ${a.muni_nombre}`,
        descripcion: `IRCA pasó de ${before.toFixed(1)} a ${Number(a.irca_score).toFixed(1)} (nivel ${a.nivel}).`,
        muni_code: a.muni_code,
        depto_code: a.depto_code,
        fuente: "snapshot-irca",
        agent_run_id: run!.id,
        payload: { antes: before, despues: a.irca_score, delta, fecha_anterior: ayer, fecha_actual: hoy },
      });
    }

    if (alertas.length) {
      await sb.from("alertas").insert(alertas);
    }

    // Notificación a suscriptores: cada suscripción define filtros (depto,
    // muni, severidad mínima, umbral de IRCA). Solo si hay match enviamos
    // email vía Resend. Si RESEND_API_KEY no está configurada, se omite
    // silenciosamente (el sistema sigue funcionando sin email).
    const { data: subs } = await sb.from("suscripciones").select("*").eq("activa", true);
    let emails_enviados = 0;
    for (const s of subs ?? []) {
      const ord = ["info", "baja", "media", "alta", "critica"];
      const minIdx = ord.indexOf(s.severidad_minima);
      const matching = alertas.filter((a) => {
        if (ord.indexOf(a.severidad) < minIdx) return false;
        if (s.depto_filter?.length && !s.depto_filter.includes(a.depto_code)) return false;
        if (s.muni_filter?.length && !s.muni_filter.includes(a.muni_code)) return false;
        if (s.umbral_irca && a.payload.despues < Number(s.umbral_irca)) return false;
        return true;
      });
      if (!matching.length) continue;
      const html = `<h2>RutaVital IA — ${matching.length} alertas nuevas</h2><ul>${
        matching.slice(0, 20).map((a) => `<li><b>[${a.severidad.toUpperCase()}]</b> ${a.titulo} — ${a.descripcion}</li>`).join("")
      }</ul>`;
      const res = await sendEmail(s.email_destino, `RutaVital — ${matching.length} alertas IRCA`, html);
      if ((res as any).ok) emails_enviados++;
    }

    await sb.from("agent_runs").update({
      status: "success",
      output: { alertas_creadas: alertas.length, emails_enviados, fechas: { hoy, ayer } },
      duracion_ms: Date.now() - t0,
    }).eq("id", run!.id);

    return new Response(JSON.stringify({
      ok: true, alertas: alertas.length, emails_enviados,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    await sb.from("agent_runs").update({
      status: "error", error: msg, duracion_ms: Date.now() - t0,
    }).eq("id", run!.id);
    return new Response(JSON.stringify({ ok: false, error: msg }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
