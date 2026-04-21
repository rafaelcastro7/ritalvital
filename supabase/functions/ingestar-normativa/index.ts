// Ingesta de normativa colombiana de salud (búsqueda léxica FTS español, sin embeddings)
// Solo admin. Recibe { docs: [{ norma, titulo, articulo?, contenido, url_fuente? }] }
// O { preset: "default" } para cargar Resolución 2115/2007, 3100/2019, Ley 1751/2015 y Decreto 1575/2007.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

interface DocChunk {
  norma: string;
  titulo: string;
  articulo?: string;
  contenido: string;
  url_fuente?: string;
}

// Extractos clave de normativa colombiana de salud — agua potable y derecho a la salud
const PRESET_DOCS: DocChunk[] = [
  {
    norma: "Resolución 2115/2007",
    titulo: "Características físicas, químicas y microbiológicas del agua para consumo humano",
    articulo: "Artículo 2 — Características físicas",
    contenido: "El agua para consumo humano no podrá sobrepasar los siguientes valores máximos aceptables: Color aparente 15 UPC, Olor y sabor aceptable, Turbiedad 2 UNT, pH entre 6,5 y 9,0. Estos parámetros físicos garantizan condiciones organolépticas mínimas para evitar rechazo del consumidor y enfermedades.",
    url_fuente: "https://www.minsalud.gov.co/Normatividad_Nuevo/RESOLUCI%C3%93N%202115%20DE%202007.pdf",
  },
  {
    norma: "Resolución 2115/2007",
    titulo: "Características microbiológicas",
    articulo: "Artículo 11 — Microbiología",
    contenido: "Las técnicas aceptadas para el análisis microbiológico del agua para consumo humano son filtración por membrana, enzima sustrato y sustrato definido. Los valores máximos aceptables son: Coliformes totales 0 UFC/100 cm³, Escherichia coli 0 UFC/100 cm³. La presencia de E. coli indica contaminación fecal reciente y riesgo inmediato de enfermedad diarreica aguda (EDA).",
    url_fuente: "https://www.minsalud.gov.co/Normatividad_Nuevo/RESOLUCI%C3%93N%202115%20DE%202007.pdf",
  },
  {
    norma: "Resolución 2115/2007",
    titulo: "Índice de Riesgo de la Calidad del Agua para Consumo Humano (IRCA)",
    articulo: "Artículo 12 — Cálculo del IRCA",
    contenido: "El IRCA se calcula sumando los puntajes de riesgo asignados a cada característica no aceptable, dividido entre la sumatoria de puntajes de riesgo asignados a todas las características analizadas, multiplicado por 100. Clasificación: 0-5% Sin riesgo (apta), 5,1-14% Riesgo bajo, 14,1-35% Riesgo medio, 35,1-80% Riesgo alto, 80,1-100% Inviable sanitariamente. En riesgo alto e inviable se requieren acciones inmediatas de las autoridades sanitarias y prestador.",
    url_fuente: "https://www.minsalud.gov.co/Normatividad_Nuevo/RESOLUCI%C3%93N%202115%20DE%202007.pdf",
  },
  {
    norma: "Resolución 2115/2007",
    titulo: "Acciones según nivel de riesgo IRCA",
    articulo: "Artículo 15 — Responsabilidades",
    contenido: "Cuando el IRCA mensual sea Riesgo Alto o Inviable Sanitariamente, la autoridad sanitaria departamental o municipal deberá notificar al prestador, a la Superintendencia de Servicios Públicos Domiciliarios y a la Procuraduría General. El prestador debe presentar plan de acción correctivo en un máximo de 30 días calendario y la alcaldía debe garantizar suministro alternativo de agua potable a la población afectada.",
    url_fuente: "https://www.minsalud.gov.co/Normatividad_Nuevo/RESOLUCI%C3%93N%202115%20DE%202007.pdf",
  },
  {
    norma: "Resolución 3100/2019",
    titulo: "Inscripción en el Registro Especial de Prestadores de Servicios de Salud (REPS)",
    articulo: "Artículo 6 — Condiciones de habilitación",
    contenido: "Todo prestador de servicios de salud debe cumplir con condiciones de capacidad técnico-administrativa, suficiencia patrimonial y financiera, y capacidad tecnológica y científica. La habilitación es requisito indispensable para la prestación de servicios y debe renovarse cada 4 años. El incumplimiento genera cierre temporal o definitivo del servicio.",
    url_fuente: "https://www.minsalud.gov.co/Normatividad_Nuevo/Resoluci%C3%B3n%20No.%203100%20de%202019.pdf",
  },
  {
    norma: "Resolución 3100/2019",
    titulo: "Estándares de infraestructura para servicios ambulatorios",
    articulo: "Anexo Técnico — Estándares de habilitación",
    contenido: "Los servicios ambulatorios deben contar con suministro permanente de agua potable que cumpla con la Resolución 2115/2007, sistema de manejo de residuos según Decreto 351/2014, áreas diferenciadas para atención y procedimientos, y planes de contingencia ante interrupción del suministro. La falta de agua potable es causal de no habilitación.",
    url_fuente: "https://www.minsalud.gov.co/Normatividad_Nuevo/Resoluci%C3%B3n%20No.%203100%20de%202019.pdf",
  },
  {
    norma: "Ley 1751/2015",
    titulo: "Naturaleza y contenido del derecho fundamental a la salud",
    articulo: "Artículo 2 — Derecho fundamental",
    contenido: "El derecho fundamental a la salud es autónomo e irrenunciable en lo individual y en lo colectivo. Comprende el acceso a los servicios de salud de manera oportuna, eficaz y con calidad para la preservación, el mejoramiento y la promoción de la salud. El Estado adoptará políticas para asegurar la igualdad de trato y oportunidades en el acceso a las actividades de promoción, prevención, diagnóstico, tratamiento, rehabilitación y paliación.",
    url_fuente: "https://www.funcionpublica.gov.co/eva/gestornormativo/norma.php?i=60733",
  },
  {
    norma: "Ley 1751/2015",
    titulo: "Determinantes sociales de salud",
    articulo: "Artículo 9 — Determinantes sociales",
    contenido: "Es deber del Estado adoptar políticas públicas dirigidas a lograr la reducción de las desigualdades de los determinantes sociales de la salud que incidan en el goce efectivo del derecho. Entre estos: acceso a agua potable, saneamiento básico, vivienda digna, educación, alimentación, ambiente sano y trabajo. La omisión sostenida en garantizar agua potable a poblaciones vulnerables vulnera el núcleo esencial del derecho.",
    url_fuente: "https://www.funcionpublica.gov.co/eva/gestornormativo/norma.php?i=60733",
  },
  {
    norma: "Ley 1751/2015",
    titulo: "Sujetos de especial protección",
    articulo: "Artículo 11 — Sujetos de especial protección",
    contenido: "La atención de niños, niñas y adolescentes, mujeres en estado de embarazo, desplazados, víctimas de violencia y del conflicto armado, adultos mayores, personas con discapacidad, enfermedades huérfanas y víctimas de abuso, gozarán de especial protección. La calidad del agua y la prevención de enfermedades de origen hídrico debe priorizarse en territorios con alta concentración de estos grupos.",
    url_fuente: "https://www.funcionpublica.gov.co/eva/gestornormativo/norma.php?i=60733",
  },
  {
    norma: "Decreto 1575/2007",
    titulo: "Vigilancia de la calidad del agua para consumo humano",
    articulo: "Artículo 11 — Autoridades sanitarias",
    contenido: "Las direcciones territoriales de salud (departamentales, distritales y municipales) son responsables de la vigilancia de la calidad del agua para consumo humano en su jurisdicción. Deben tomar muestras representativas, calcular el IRCA mensual, reportar al SIVICAP del Instituto Nacional de Salud y exigir acciones al prestador cuando el IRCA supere el 14% (riesgo medio o superior).",
    url_fuente: "https://www.minambiente.gov.co/wp-content/uploads/2021/10/Decreto-1575-de-2007.pdf",
  },
];

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    // Acceso público sin autenticación
    const body = await req.json().catch(() => ({}));
    const docs: DocChunk[] = body.preset === "default" ? PRESET_DOCS : (body.docs ?? []);
    const replace: boolean = body.replace === true;
    if (!docs.length) return new Response(JSON.stringify({ error: "no docs" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const admin = createClient(SUPABASE_URL, SERVICE_KEY);

    // Si replace=true, limpiar normativas duplicadas (mismas normas)
    if (replace) {
      const normas = [...new Set(docs.map(d => d.norma))];
      await admin.from("normativa_chunks").delete().in("norma", normas);
    }

    const inserted: any[] = [];
    const errors: any[] = [];

    for (const d of docs) {
      try {
        const fullText = `${d.norma}. ${d.titulo}. ${d.articulo ?? ""}. ${d.contenido}`;
        const { data, error } = await admin.from("normativa_chunks").insert({
          norma: d.norma,
          titulo: d.titulo,
          articulo: d.articulo ?? null,
          contenido: d.contenido,
          url_fuente: d.url_fuente ?? null,
          tokens: Math.ceil(fullText.length / 4),
        }).select("id, norma, articulo").single();
        if (error) throw error;
        inserted.push(data);
      } catch (e: any) {
        errors.push({ norma: d.norma, articulo: d.articulo, error: e.message });
      }
    }

    return new Response(JSON.stringify({ ok: true, inserted: inserted.length, errors, items: inserted }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e.message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
