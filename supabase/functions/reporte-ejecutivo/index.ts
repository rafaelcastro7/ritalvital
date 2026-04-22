import { createClient } from "npm:@supabase/supabase-js@2.45.0";
import { corsHeaders } from "../_shared/cors.ts";
import { runPipelineNational } from "../_shared/pipeline.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const LOVABLE_KEY = Deno.env.get("LOVABLE_API_KEY")!;

const sb = createClient(SUPABASE_URL, SERVICE_KEY);

async function ensureSnapshot(): Promise<string> {
  const { data: fechas } = await sb
    .from("irca_snapshots").select("fecha").order("fecha", { ascending: false }).limit(1);
  if (fechas?.[0]?.fecha) return fechas[0].fecha as string;

  // Auto-generar snapshot si no existe
  console.log("No hay snapshots. Generando uno nuevo...");
  const fecha = new Date().toISOString().slice(0, 10);
  const rows = await runPipelineNational();
  if (!rows.length) throw new Error("Pipeline retornó 0 filas");

  await sb.from("irca_snapshots").delete().eq("fecha", fecha);
  const BATCH = 500;
  for (let i = 0; i < rows.length; i += BATCH) {
    const slice = rows.slice(i, i + BATCH).map((r) => ({ ...r, fecha, pipeline_version: "v1" }));
    const { error } = await sb.from("irca_snapshots").insert(slice);
    if (error) throw error;
  }
  console.log(`Snapshot creado con ${rows.length} filas`);
  return fecha;
}

function htmlReport(opts: {
  titulo: string;
  fecha: string;
  resumen: string;
  tabla: any[];
  recomendaciones: string;
}) {
  const rows = opts.tabla.map((r) => `
    <tr>
      <td>${r.muni_nombre}</td>
      <td style="text-align:right">${Number(r.irca_score).toFixed(1)}</td>
      <td><span class="b ${r.nivel.toLowerCase()}">${r.nivel}</span></td>
      <td style="text-align:right">${r.componentes?.poblacion ?? "—"}</td>
      <td style="text-align:right">${r.componentes?.eventos ?? 0}</td>
    </tr>`).join("");
  return `<!DOCTYPE html><html lang="es"><head><meta charset="utf-8"><title>${opts.titulo}</title>
  <style>
    body { font-family: -apple-system, system-ui, sans-serif; color:#0f172a; margin:40px; }
    h1 { font-size:22px; margin:0 0 4px; }
    .meta { color:#64748b; font-size:12px; margin-bottom:24px; }
    .card { background:#f8fafc; border:1px solid #e2e8f0; border-radius:12px; padding:16px; margin-bottom:20px; }
    table { width:100%; border-collapse:collapse; font-size:12px; }
    th,td { padding:8px; border-bottom:1px solid #e2e8f0; text-align:left; }
    th { background:#f1f5f9; font-weight:600; }
    .b { padding:2px 8px; border-radius:999px; font-size:11px; font-weight:600; }
    .b.crítico { background:#7f1d1d; color:#fff; }
    .b.alto { background:#dc2626; color:#fff; }
    .b.medio { background:#f59e0b; color:#fff; }
    .b.bajo { background:#16a34a; color:#fff; }
    .footer { margin-top:32px; font-size:10px; color:#94a3b8; border-top:1px solid #e2e8f0; padding-top:12px; }
  </style></head><body>
    <h1>${opts.titulo}</h1>
    <div class="meta">RutaVital IA · Generado ${new Date().toLocaleString("es-CO")} · Snapshot ${opts.fecha}</div>
    <div class="card"><h3>Resumen ejecutivo</h3><div>${opts.resumen.replace(/\n/g, "<br/>")}</div></div>
    <div class="card"><h3>Municipios con mayor riesgo</h3>
      <table><thead><tr><th>Municipio</th><th>IRCA</th><th>Nivel</th><th>Población</th><th>Eventos</th></tr></thead>
      <tbody>${rows}</tbody></table></div>
    <div class="card"><h3>Recomendaciones operativas</h3><div>${opts.recomendaciones.replace(/\n/g, "<br/>")}</div></div>
    <div class="footer">Documento generado por copiloto agéntico. Validar siempre con equipo territorial.</div>
  </body></html>`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  // Acceso público sin autenticación
  const { depto_code, depto_nombre } = await req.json();
  if (!depto_code) return new Response(JSON.stringify({ error: "depto_code requerido" }), {
    status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

  const t0 = Date.now();
  const { data: run } = await sb.from("agent_runs").insert({
    agente: "reportero", trigger: "reporte-ejecutivo", modelo: "google/gemini-2.5-flash",
    user_id: null, input: { depto_code }, status: "running",
  }).select().single();

  try {
    const { data: fechas } = await sb
      .from("irca_snapshots").select("fecha").order("fecha", { ascending: false }).limit(1);
    const fecha = fechas?.[0]?.fecha;
    if (!fecha) throw new Error("Sin snapshots disponibles");

    const { data: muns } = await sb
      .from("irca_snapshots").select("*")
      .eq("fecha", fecha).eq("depto_code", depto_code)
      .order("irca_score", { ascending: false });
    if (!muns?.length) throw new Error("Sin datos para el departamento");

    const top = muns.slice(0, 15);
    const stats = {
      total: muns.length,
      criticos: muns.filter((m) => m.nivel === "Crítico").length,
      altos: muns.filter((m) => m.nivel === "Alto").length,
      promedio: (muns.reduce((s, m) => s + Number(m.irca_score), 0) / muns.length).toFixed(1),
    };

    // Generar resumen + recomendaciones con IA
    const prompt = `Eres analista de salud pública. Genera (1) un resumen ejecutivo de 4-6 frases y (2) recomendaciones operativas en bullets, para el departamento ${depto_nombre ?? depto_code}.
Datos:
- Municipios analizados: ${stats.total}
- IRCA promedio: ${stats.promedio}
- Críticos: ${stats.criticos} | Altos: ${stats.altos}
- Top 5 críticos: ${top.slice(0, 5).map((m) => `${m.muni_nombre} (${Number(m.irca_score).toFixed(1)})`).join(", ")}
Devuelve JSON: { "resumen": "...", "recomendaciones": "- ...\\n- ..." }`;

    const ai = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${LOVABLE_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [{ role: "user", content: prompt }],
        response_format: { type: "json_object" },
      }),
    });
    if (!ai.ok) throw new Error(`AI: ${ai.status}`);
    const aiJson = await ai.json();
    const parsed = JSON.parse(aiJson.choices[0].message.content);

    const html = htmlReport({
      titulo: `Reporte ejecutivo IRCA — ${depto_nombre ?? depto_code}`,
      fecha,
      resumen: parsed.resumen,
      tabla: top,
      recomendaciones: parsed.recomendaciones,
    });

    // Subir HTML al bucket público
    const path = `publico/${depto_code}-${fecha}-${Date.now()}.html`;
    const { error: upErr } = await sb.storage.from("reportes").upload(path, html, {
      contentType: "text/html", upsert: true,
    });
    if (upErr) throw upErr;

    const { data: pub } = sb.storage.from("reportes").getPublicUrl(path);

    const { data: rep } = await sb.from("reportes").insert({
      tipo: "ejecutivo",
      titulo: `Reporte ejecutivo — ${depto_nombre ?? depto_code} (${fecha})`,
      depto_code,
      pdf_url: pub?.publicUrl ?? path,
      generado_por: null,
      agent_run_id: run!.id,
      metadata: { fecha, stats, top_count: top.length },
    }).select().single();

    await sb.from("agent_runs").update({
      status: "success", output: { reporte_id: rep!.id, path },
      duracion_ms: Date.now() - t0,
    }).eq("id", run!.id);

    return new Response(JSON.stringify({ ok: true, reporte: rep, url: pub?.publicUrl }), {
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
