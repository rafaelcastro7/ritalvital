// Pipeline IRCA optimizado - usa $select para minimizar payload y procesa por dept.

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

async function socrataPage(dataset: string, params: Record<string, string>) {
  const qs = Object.entries(params).map(([k, v]) => `$${k}=${encodeURIComponent(v)}`).join("&");
  const url = `${SOCRATA}/${dataset}.json?${qs}`;
  const r = await fetch(url, { headers: { Accept: "application/json" } });
  if (!r.ok) throw new Error(`Socrata ${dataset}: ${r.status}`);
  return await r.json();
}

function muniCode(r: any): string | null {
  const c =
    r.cod_municipio ?? r.codigo_municipio ?? r.cod_mun ??
    r.municipio_codigo ?? r.cod_mpio ?? r.municipio_cod ?? r.codigo_dane ??
    r.cod_mpio_residencia ?? r.codigo_municipio_atencion;
  if (!c) return null;
  const s = String(c).replace(/\D/g, "");
  if (!s) return null;
  return s.padStart(5, "0").slice(-5);
}

interface MuniRow {
  muni_code: string; muni_nombre: string; depto_code: string;
  depto_nombre: string; poblacion: number; camas: number; eventos: number;
}

export async function runPipelineNational() {
  // 1. DIVIPOLA — solo campos necesarios. ~1100 filas.
  const divipola = await socrataPage("gdxc-w37w", {
    select: "codigo_dane,nom_mpio,nom_depto,poblacion",
    limit: "2000",
    where: "1=1",
  }).catch(async () => socrataPage("gdxc-w37w", { limit: "2000", where: "1=1" }));

  const muniMap = new Map<string, MuniRow>();
  for (const r of divipola) {
    const code = muniCode(r);
    if (!code || code.length !== 5) continue;
    const dCode = code.slice(0, 2);
    muniMap.set(code, {
      muni_code: code,
      muni_nombre: r.nom_mpio ?? r.municipio ?? code,
      depto_code: dCode,
      depto_nombre: DEPTO_NAMES[dCode] ?? r.nom_depto ?? "",
      poblacion: Number(r.poblacion ?? r.pob_total ?? 0) || 5000,
      camas: 0,
      eventos: 0,
    });
  }

  // 2. REPS — agregado server-side: SUMA de cantidad por muni
  try {
    const reps = await socrataPage("s2ru-bqt6", {
      select: "cod_municipio,sum(cantidad) as total",
      group: "cod_municipio",
      where: "grupo_capacidad='CAMAS'",
      limit: "5000",
    });
    for (const r of reps) {
      const code = muniCode(r);
      if (!code) continue;
      const m = muniMap.get(code);
      if (!m) continue;
      m.camas = Number(r.total ?? 0) || 0;
    }
  } catch (_) {
    // fallback: paginar pequeño
    for (let off = 0; off < 30000; off += 2000) {
      const page = await socrataPage("s2ru-bqt6", {
        select: "cod_municipio,cantidad",
        where: "grupo_capacidad='CAMAS'",
        limit: "2000",
        offset: String(off),
      }).catch(() => []);
      if (!page.length) break;
      for (const r of page) {
        const code = muniCode(r);
        if (!code) continue;
        const m = muniMap.get(code);
        if (!m) continue;
        m.camas += Number(r.cantidad ?? 1) || 0;
      }
      if (page.length < 2000) break;
    }
  }

  // 3. UNGRD — agregado server-side: COUNT por muni último año
  const desde = new Date(Date.now() - 365 * 86400000).toISOString().slice(0, 10);
  try {
    const ev = await socrataPage("rgre-6ak4", {
      select: "cod_municipio,count(*) as total",
      group: "cod_municipio",
      where: `fecha >= '${desde}'`,
      limit: "5000",
    });
    for (const r of ev) {
      const code = muniCode(r);
      if (!code) continue;
      const m = muniMap.get(code);
      if (!m) continue;
      m.eventos = Number(r.total ?? 0) || 0;
    }
  } catch (_) {
    // ignorar
  }

  // 4. Calcular IRCA en pase único
  const all = Array.from(muniMap.values()).filter((m) => m.poblacion > 0);
  let maxC = 0.001, maxE = 0.001;
  for (const m of all) {
    const c = (m.camas / m.poblacion) * 1000;
    if (c > maxC) maxC = c;
    const e = Math.log(1 + m.eventos);
    if (e > maxE) maxE = e;
  }

  return all.map((m) => {
    const camas1k = (m.camas / m.poblacion) * 1000;
    const eventNorm = Math.log(1 + m.eventos);
    const vulnerabilidad = 1 - Math.min(1, camas1k / maxC);
    const exposicion = Math.min(1, eventNorm / maxE);
    const irca_score = Number(((vulnerabilidad * 0.6 + exposicion * 0.4) * 100).toFixed(2));
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
        camas_por_1000: Number(camas1k.toFixed(3)),
        vulnerabilidad: Number(vulnerabilidad.toFixed(3)),
        exposicion: Number(exposicion.toFixed(3)),
      },
    };
  });
}
