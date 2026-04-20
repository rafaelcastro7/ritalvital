// Pipeline IRCA simplificado para edge functions.
// Replica la lógica core de src/lib/datasets.ts pero usando fetch nativo de Deno.

const SOCRATA = "https://www.datos.gov.co/resource";

const DEPTO_NAMES: Record<string, string> = {
  "05": "Antioquia", "08": "Atlántico", "11": "Bogotá D.C.", "13": "Bolívar",
  "15": "Boyacá", "17": "Caldas", "18": "Caquetá", "19": "Cauca",
  "20": "Cesar", "23": "Córdoba", "25": "Cundinamarca", "27": "Chocó",
  "41": "Huila", "44": "La Guajira", "47": "Magdalena", "50": "Meta",
  "52": "Nariño", "54": "Norte de Santander", "63": "Quindío", "66": "Risaralda",
  "68": "Santander", "70": "Sucre", "73": "Tolima", "76": "Valle del Cauca",
  "81": "Arauca", "85": "Casanare", "86": "Putumayo", "88": "San Andrés",
  "91": "Amazonas", "94": "Guainía", "95": "Guaviare", "97": "Vaupés", "99": "Vichada",
};

async function socrata(dataset: string, where: string, limit = 50000) {
  const url = `${SOCRATA}/${dataset}.json?$where=${encodeURIComponent(where)}&$limit=${limit}`;
  const r = await fetch(url, { headers: { Accept: "application/json" } });
  if (!r.ok) throw new Error(`Socrata ${dataset}: ${r.status}`);
  return await r.json();
}

async function tryStrategies(dataset: string, strategies: string[], limit = 50000) {
  for (const w of strategies) {
    try {
      const rows = await socrata(dataset, w, limit);
      if (Array.isArray(rows) && rows.length) return rows;
    } catch (_) { /* next */ }
  }
  return [];
}

function muniCode(r: any): string | null {
  const c =
    r.cod_municipio ?? r.codigo_municipio ?? r.cod_mun ??
    r.municipio_codigo ?? r.cod_mpio ?? r.municipio_cod;
  if (!c) return null;
  return String(c).padStart(5, "0");
}

function deptCode(c: string) { return c.slice(0, 2); }

export async function runPipelineNational() {
  // 1. DIVIPOLA — base oficial
  const divipola = await tryStrategies("gdxc-w37w", [
    "1=1",
  ], 2000);

  // 2. REPS — capacidad instalada (camas)
  const reps = await tryStrategies("s2ru-bqt6", [
    "grupo='CAMAS'",
    "grupo_capacidad='CAMAS'",
    "1=1",
  ], 100000);

  // 3. UNGRD eventos
  const ungrd = await tryStrategies("rgre-6ak4", [
    `fecha >= '${new Date(Date.now() - 1000 * 60 * 60 * 24 * 365).toISOString().slice(0, 10)}'`,
    "1=1",
  ], 50000);

  // Construir base municipios
  const muniMap = new Map<string, any>();
  for (const r of divipola) {
    const code = muniCode(r) ?? r.codigo_dane?.toString().padStart(5, "0");
    if (!code || code.length !== 5) continue;
    const dCode = deptCode(code);
    muniMap.set(code, {
      muni_code: code,
      muni_nombre: r.nom_mpio ?? r.municipio ?? r.nombre_municipio ?? code,
      depto_code: dCode,
      depto_nombre: DEPTO_NAMES[dCode] ?? r.nom_depto ?? "",
      poblacion: Number(r.poblacion ?? r.pob_total ?? 0) || 5000,
      camas: 0,
      eventos: 0,
    });
  }

  // Agregar REPS
  for (const r of reps) {
    const code = muniCode(r);
    if (!code) continue;
    const m = muniMap.get(code);
    if (!m) continue;
    const cap = Number(r.cantidad ?? r.numero_camas ?? r.cantidad_camas ?? 1);
    m.camas += isFinite(cap) ? cap : 0;
  }

  // Agregar UNGRD
  for (const r of ungrd) {
    const code = muniCode(r);
    if (!code) continue;
    const m = muniMap.get(code);
    if (!m) continue;
    m.eventos += 1;
  }

  // Calcular IRCA por municipio
  const arr = Array.from(muniMap.values()).filter((m) => m.poblacion > 0);
  const camas1k = arr.map((m) => (m.camas / m.poblacion) * 1000);
  const eventNorm = arr.map((m) => Math.log(1 + m.eventos));

  const maxC = Math.max(...camas1k, 0.001);
  const maxE = Math.max(...eventNorm, 0.001);

  const result = arr.map((m, i) => {
    const vulnerabilidad = 1 - Math.min(1, camas1k[i] / maxC); // 0..1 (1 = peor)
    const exposicion = Math.min(1, eventNorm[i] / maxE); // 0..1
    const irca_score = Number(
      ((vulnerabilidad * 0.6 + exposicion * 0.4) * 100).toFixed(2),
    );
    let nivel: "Bajo" | "Medio" | "Alto" | "Crítico";
    if (irca_score >= 75) nivel = "Crítico";
    else if (irca_score >= 55) nivel = "Alto";
    else if (irca_score >= 35) nivel = "Medio";
    else nivel = "Bajo";

    return {
      muni_code: m.muni_code,
      muni_nombre: m.muni_nombre,
      depto_code: m.depto_code,
      depto_nombre: m.depto_nombre,
      irca_score,
      nivel,
      componentes: {
        poblacion: m.poblacion,
        camas: m.camas,
        eventos: m.eventos,
        camas_por_1000: Number(camas1k[i].toFixed(3)),
        vulnerabilidad: Number(vulnerabilidad.toFixed(3)),
        exposicion: Number(exposicion.toFixed(3)),
      },
    };
  });

  return result;
}
