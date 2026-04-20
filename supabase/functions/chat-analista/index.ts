import { createClient } from "npm:@supabase/supabase-js@2.45.0";
import { corsHeaders } from "../_shared/cors.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const LOVABLE_KEY = Deno.env.get("LOVABLE_API_KEY")!;

const MODEL = "google/gemini-2.5-flash";

const SYSTEM_PROMPT = `Eres "Analista RutaVital", copiloto agéntico de salud pública territorial para Colombia.
Tu fuente única de verdad son las herramientas. NUNCA inventes cifras: si no tienes el dato, llama a la herramienta.
Hablas en español, conciso, con bullets y tablas cortas. Cita siempre el municipio + código DIVIPOLA y la fecha del snapshot.
Cuando expongas riesgo, distingue entre: vulnerabilidad sanitaria (camas/1000 hab), exposición (eventos UNGRD) e IRCA compuesto.
No reemplazas criterio humano: termina recomendaciones con "validar con el equipo territorial".`;

const TOOLS = [
  {
    type: "function",
    function: {
      name: "consultar_municipio",
      description: "Devuelve el snapshot IRCA más reciente de un municipio.",
      parameters: {
        type: "object",
        properties: {
          query: { type: "string", description: "Nombre del municipio o código DIVIPOLA de 5 dígitos." },
        },
        required: ["query"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "top_criticos",
      description: "Lista los N municipios con mayor IRCA, opcionalmente filtrados por departamento.",
      parameters: {
        type: "object",
        properties: {
          n: { type: "number", description: "Número de municipios (máx 50)." },
          depto_code: { type: "string", description: "Código DANE del departamento (2 dígitos), opcional." },
        },
        required: ["n"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "comparar_municipios",
      description: "Compara IRCA y componentes entre 2-5 municipios.",
      parameters: {
        type: "object",
        properties: {
          municipios: { type: "array", items: { type: "string" }, description: "Nombres o códigos." },
        },
        required: ["municipios"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "tendencia_municipio",
      description: "Devuelve la serie histórica de IRCA de un municipio.",
      parameters: {
        type: "object",
        properties: {
          query: { type: "string" },
          dias: { type: "number", description: "Ventana en días, default 30." },
        },
        required: ["query"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "alertas_recientes",
      description: "Devuelve alertas activas, opcionalmente por departamento o severidad mínima.",
      parameters: {
        type: "object",
        properties: {
          depto_code: { type: "string" },
          severidad_minima: { type: "string", enum: ["baja", "media", "alta", "critica"] },
          limit: { type: "number" },
        },
      },
    },
  },
];

const sb = createClient(SUPABASE_URL, SERVICE_KEY);

async function findMuni(query: string) {
  const q = query.trim();
  // por código
  if (/^\d{5}$/.test(q)) {
    const { data } = await sb
      .from("irca_snapshots")
      .select("*")
      .eq("muni_code", q)
      .order("fecha", { ascending: false })
      .limit(1);
    return data?.[0];
  }
  const { data } = await sb
    .from("irca_snapshots")
    .select("*")
    .ilike("muni_nombre", `%${q}%`)
    .order("fecha", { ascending: false })
    .limit(1);
  return data?.[0];
}

async function execTool(name: string, args: any) {
  if (name === "consultar_municipio") {
    const m = await findMuni(args.query);
    return m ? { found: true, ...m } : { found: false, msg: "Sin datos para ese municipio." };
  }
  if (name === "top_criticos") {
    let q = sb.from("irca_snapshots").select("*");
    // último snapshot
    const { data: maxF } = await sb
      .from("irca_snapshots")
      .select("fecha")
      .order("fecha", { ascending: false })
      .limit(1);
    const fecha = maxF?.[0]?.fecha;
    if (fecha) q = q.eq("fecha", fecha);
    if (args.depto_code) q = q.eq("depto_code", args.depto_code);
    const { data } = await q.order("irca_score", { ascending: false }).limit(Math.min(50, args.n ?? 10));
    return { fecha, items: data ?? [] };
  }
  if (name === "comparar_municipios") {
    const out = [];
    for (const m of args.municipios.slice(0, 5)) {
      const found = await findMuni(m);
      if (found) out.push(found);
    }
    return { items: out };
  }
  if (name === "tendencia_municipio") {
    const m = await findMuni(args.query);
    if (!m) return { found: false };
    const dias = args.dias ?? 30;
    const desde = new Date(Date.now() - dias * 86400000).toISOString().slice(0, 10);
    const { data } = await sb
      .from("irca_snapshots")
      .select("fecha,irca_score,nivel,componentes")
      .eq("muni_code", m.muni_code)
      .gte("fecha", desde)
      .order("fecha");
    return { muni_code: m.muni_code, muni_nombre: m.muni_nombre, serie: data ?? [] };
  }
  if (name === "alertas_recientes") {
    let q = sb.from("alertas").select("*").order("created_at", { ascending: false });
    if (args.depto_code) q = q.eq("depto_code", args.depto_code);
    if (args.severidad_minima) {
      const ord = ["info", "baja", "media", "alta", "critica"];
      const min = ord.indexOf(args.severidad_minima);
      q = q.in("severidad", ord.slice(min));
    }
    const { data } = await q.limit(args.limit ?? 20);
    return { items: data ?? [] };
  }
  return { error: `Herramienta desconocida: ${name}` };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  // Validar JWT
  const authHeader = req.headers.get("Authorization");
  if (!authHeader) {
    return new Response(JSON.stringify({ error: "No auth" }), {
      status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  const sbUser = createClient(SUPABASE_URL, Deno.env.get("SUPABASE_PUBLISHABLE_KEY")!, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: { user } } = await sbUser.auth.getUser();
  if (!user) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const body = await req.json();
  const { conversacion_id, message } = body;
  let convId = conversacion_id;

  // Crear conversación si no existe
  if (!convId) {
    const { data: c } = await sb
      .from("conversaciones")
      .insert({ user_id: user.id, titulo: message.slice(0, 60) })
      .select()
      .single();
    convId = c!.id;
  }

  // Guardar mensaje del usuario
  await sb.from("mensajes").insert({
    conversacion_id: convId, role: "user", content: message,
  });

  // Cargar historial
  const { data: hist } = await sb
    .from("mensajes")
    .select("role,content,tool_calls,tool_name")
    .eq("conversacion_id", convId)
    .order("created_at");

  const messages: any[] = [{ role: "system", content: SYSTEM_PROMPT }];
  for (const m of hist ?? []) {
    if (m.role === "tool") {
      messages.push({ role: "tool", content: m.content, tool_call_id: m.tool_name });
    } else if (m.role === "assistant" && m.tool_calls) {
      messages.push({ role: "assistant", content: m.content || "", tool_calls: m.tool_calls });
    } else {
      messages.push({ role: m.role, content: m.content });
    }
  }

  const t0 = Date.now();
  const { data: run } = await sb.from("agent_runs").insert({
    agente: "analista", trigger: "chat", modelo: MODEL,
    user_id: user.id, conversacion_id: convId,
    input: { message }, status: "running",
  }).select().single();

  const usados: string[] = [];

  try {
    // Loop ReAct máximo 5 iteraciones
    for (let iter = 0; iter < 5; iter++) {
      const r = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: { Authorization: `Bearer ${LOVABLE_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({ model: MODEL, messages, tools: TOOLS, tool_choice: "auto" }),
      });
      if (r.status === 429) throw new Error("Rate limit (429). Intenta de nuevo en unos segundos.");
      if (r.status === 402) throw new Error("Créditos AI agotados. Recarga en Lovable AI.");
      if (!r.ok) throw new Error(`AI Gateway: ${r.status} ${await r.text()}`);
      const json = await r.json();
      const choice = json.choices[0].message;

      if (choice.tool_calls?.length) {
        messages.push(choice);
        await sb.from("mensajes").insert({
          conversacion_id: convId, role: "assistant",
          content: choice.content || "", tool_calls: choice.tool_calls,
        });
        for (const tc of choice.tool_calls) {
          const args = JSON.parse(tc.function.arguments || "{}");
          usados.push(tc.function.name);
          const result = await execTool(tc.function.name, args);
          const content = JSON.stringify(result);
          messages.push({ role: "tool", tool_call_id: tc.id, content });
          await sb.from("mensajes").insert({
            conversacion_id: convId, role: "tool",
            content, tool_name: tc.id,
          });
        }
        continue;
      }

      // Respuesta final
      await sb.from("mensajes").insert({
        conversacion_id: convId, role: "assistant", content: choice.content,
      });
      await sb.from("agent_runs").update({
        status: "success", output: { content: choice.content },
        herramientas_usadas: usados, duracion_ms: Date.now() - t0,
      }).eq("id", run!.id);

      return new Response(JSON.stringify({
        conversacion_id: convId, content: choice.content, herramientas_usadas: usados,
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    throw new Error("Excedido límite de iteraciones agénticas");
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    await sb.from("agent_runs").update({
      status: "error", error: msg, duracion_ms: Date.now() - t0,
    }).eq("id", run!.id);
    return new Response(JSON.stringify({ error: msg, conversacion_id: convId }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
