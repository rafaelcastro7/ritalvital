import { createClient } from "npm:@supabase/supabase-js@2.45.0";
import { corsHeaders } from "../_shared/cors.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const sb = createClient(SUPABASE_URL, SERVICE_KEY);

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const t0 = Date.now();
  const { data: run } = await sb.from("agent_runs").insert({
    agente: "validador", trigger: "validador-cross", modelo: "rule-engine-v1",
    input: {}, status: "running",
  }).select().single();

  try {
    const { data: fechas } = await sb
      .from("irca_snapshots").select("fecha").order("fecha", { ascending: false }).limit(1);
    const fecha = fechas?.[0]?.fecha;
    if (!fecha) throw new Error("Sin snapshots");

    const { data: snaps } = await sb.from("irca_snapshots").select("*").eq("fecha", fecha);
    const validaciones: any[] = [];

    for (const s of snaps ?? []) {
      const c = s.componentes as any;
      // 1. Sin camas reportadas + población alta = subregistro REPS probable
      if (c.camas === 0 && c.poblacion > 20000) {
        validaciones.push({
          tipo_anomalia: "subregistro_reps",
          fuente: "REPS",
          severidad: "media",
          muni_code: s.muni_code,
          depto_code: s.depto_code,
          descripcion: `${s.muni_nombre}: 0 camas reportadas con población ${c.poblacion}. Posible subregistro REPS.`,
          metadata: { poblacion: c.poblacion },
          agent_run_id: run!.id,
        });
      }
      // 2. IRCA crítico sin eventos UNGRD = falta de reporte municipal
      if (s.nivel === "Crítico" && c.eventos === 0) {
        validaciones.push({
          tipo_anomalia: "sin_eventos_ungrd",
          fuente: "UNGRD",
          severidad: "baja",
          muni_code: s.muni_code,
          depto_code: s.depto_code,
          descripcion: `${s.muni_nombre} en estado Crítico sin eventos reportados a UNGRD en el último año.`,
          metadata: { irca: s.irca_score },
          agent_run_id: run!.id,
        });
      }
      // 3. Camas/1000 anormalmente alto (posible duplicación)
      if (c.camas_por_1000 > 50) {
        validaciones.push({
          tipo_anomalia: "outlier_camas",
          fuente: "REPS",
          severidad: "alta",
          muni_code: s.muni_code,
          depto_code: s.depto_code,
          descripcion: `${s.muni_nombre}: ${c.camas_por_1000} camas/1000 hab. Posible duplicación de registro.`,
          metadata: { camas: c.camas, poblacion: c.poblacion },
          agent_run_id: run!.id,
        });
      }
    }

    if (validaciones.length) {
      // Solo insertamos si no había una idéntica reciente (último día)
      const { data: recientes } = await sb
        .from("validaciones")
        .select("muni_code,tipo_anomalia")
        .gte("created_at", new Date(Date.now() - 86400000).toISOString());
      const dup = new Set((recientes ?? []).map((r) => `${r.muni_code}|${r.tipo_anomalia}`));
      const nuevas = validaciones.filter((v) => !dup.has(`${v.muni_code}|${v.tipo_anomalia}`));
      if (nuevas.length) await sb.from("validaciones").insert(nuevas);
      await sb.from("agent_runs").update({
        status: "success",
        output: { detectadas: validaciones.length, nuevas: nuevas.length },
        duracion_ms: Date.now() - t0,
      }).eq("id", run!.id);
      return new Response(JSON.stringify({ ok: true, detectadas: validaciones.length, nuevas: nuevas.length }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    await sb.from("agent_runs").update({
      status: "success", output: { detectadas: 0 },
      duracion_ms: Date.now() - t0,
    }).eq("id", run!.id);
    return new Response(JSON.stringify({ ok: true, detectadas: 0 }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
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
