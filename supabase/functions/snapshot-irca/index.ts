import { createClient } from "npm:@supabase/supabase-js@2.45.0";
import { corsHeaders } from "../_shared/cors.ts";
import { runPipelineNational } from "../_shared/pipeline.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const supabase = createClient(SUPABASE_URL, SERVICE_KEY);
  const t0 = Date.now();
  const fecha = new Date().toISOString().slice(0, 10);

  // Registrar run
  const { data: run } = await supabase
    .from("agent_runs")
    .insert({
      agente: "vigia",
      trigger: "snapshot-irca",
      modelo: "pipeline-v1",
      input: { fecha },
      status: "running",
    })
    .select()
    .single();

  try {
    const rows = await runPipelineNational();
    if (!rows.length) throw new Error("Pipeline retornó 0 filas");

    // Borrar snapshot del día (idempotente)
    await supabase.from("irca_snapshots").delete().eq("fecha", fecha);

    // Insertar en lotes de 500
    const BATCH = 500;
    for (let i = 0; i < rows.length; i += BATCH) {
      const slice = rows.slice(i, i + BATCH).map((r) => ({ ...r, fecha, pipeline_version: "v1" }));
      const { error } = await supabase.from("irca_snapshots").insert(slice);
      if (error) throw error;
    }

    const duracion_ms = Date.now() - t0;
    await supabase
      .from("agent_runs")
      .update({
        status: "success",
        output: { filas: rows.length, fecha },
        duracion_ms,
      })
      .eq("id", run!.id);

    return new Response(
      JSON.stringify({ ok: true, fecha, filas: rows.length, duracion_ms }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    const msg = e instanceof Error ? e.message : (typeof e === "object" ? JSON.stringify(e) : String(e));
    console.error("snapshot-irca error:", msg, e);
    await supabase
      .from("agent_runs")
      .update({ status: "error", error: msg, duracion_ms: Date.now() - t0 })
      .eq("id", run!.id);
    return new Response(JSON.stringify({ ok: false, error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
