// Pipeline IRCA v2 — fórmula con umbrales ABSOLUTOS anclados a estándares OMS/MinSalud
// Refleja la realidad colombiana: ~1.7 camas/1000 hab promedio (OMS recomienda 3.5)

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

// Departamentos históricamente con conflicto armado / pobreza extrema (DANE/UARIV)
const DEPTOS_CONFLICTO_ALTO = new Set(["27", "94", "97", "99", "91", "95", "44", "19", "52", "18", "86", "81"]);
// Departamentos con dispersión rural extrema y barreras de acceso
const DEPTOS_DISPERSION = new Set(["27", "91", "94", "95", "97", "99", "88", "86"]);

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
  // 1. DIVIPOLA
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

  // 2. REPS — camas
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

  // 3. UNGRD — eventos último año
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

  const all = Array.from(muniMap.values()).filter((m) => m.poblacion > 0);

  // ================================================================
  // FÓRMULA IRCA v2 — UMBRALES ABSOLUTOS BASADOS EN REALIDAD COLOMBIANA
  // ================================================================
  // Estándar OMS: 3.5 camas/1000 hab. Promedio Colombia: 1.7. Mínimo crítico: 1.0
  // Eventos UNGRD por 10k hab/año: >5 = exposición alta documentada
  // ================================================================

  return all.map((m) => {
    const camas1k = (m.camas / m.poblacion) * 1000;
    const eventos10k = (m.eventos / m.poblacion) * 10000;

    // ----- A. VULNERABILIDAD SANITARIA (0-100) — peso 45% -----
    // Anclado a OMS: 3.5 camas/1000 = óptimo (0 pts), 0 camas = catastrófico (100 pts)
    let vulnerabilidad: number;
    if (m.camas === 0) {
      vulnerabilidad = 100; // sin servicios = catastrófico
    } else if (camas1k >= 3.5) {
      vulnerabilidad = 0;
    } else if (camas1k >= 2.0) {
      vulnerabilidad = 20 + (3.5 - camas1k) * 13.33; // 20-40
    } else if (camas1k >= 1.0) {
      vulnerabilidad = 40 + (2.0 - camas1k) * 25;    // 40-65
    } else if (camas1k >= 0.5) {
      vulnerabilidad = 65 + (1.0 - camas1k) * 40;    // 65-85
    } else {
      vulnerabilidad = 85 + (0.5 - camas1k) * 30;    // 85-100
    }
    vulnerabilidad = Math.min(100, Math.max(0, vulnerabilidad));

    // ----- B. EXPOSICIÓN A DESASTRES (0-100) — peso 30% -----
    // UNGRD: >10 eventos/10k hab = catastrófico, >5 = alto, >2 = medio
    let exposicion: number;
    if (eventos10k >= 10) exposicion = 100;
    else if (eventos10k >= 5) exposicion = 70 + (eventos10k - 5) * 6;
    else if (eventos10k >= 2) exposicion = 45 + (eventos10k - 2) * 8.33;
    else if (eventos10k >= 0.5) exposicion = 20 + (eventos10k - 0.5) * 16.67;
    else if (eventos10k > 0) exposicion = eventos10k * 40;
    else exposicion = 0;
    exposicion = Math.min(100, exposicion);

    // ----- C. CONTEXTO TERRITORIAL (0-100) — peso 25% -----
    // Penaliza departamentos con conflicto armado documentado o dispersión rural
    let contexto = 0;
    if (DEPTOS_CONFLICTO_ALTO.has(m.depto_code)) contexto += 50;
    if (DEPTOS_DISPERSION.has(m.depto_code)) contexto += 35;
    // Municipios pequeños y aislados (<5k hab en deptos de conflicto) son más vulnerables
    if (m.poblacion < 5000 && DEPTOS_CONFLICTO_ALTO.has(m.depto_code)) contexto += 15;
    contexto = Math.min(100, contexto);

    // ----- IRCA SCORE FINAL (0-100) -----
    let irca_score = vulnerabilidad * 0.45 + exposicion * 0.30 + contexto * 0.25;

    // Penalización extra si NO hay servicios Y hay población significativa
    if (m.camas === 0 && m.poblacion > 1000) {
      irca_score = Math.max(irca_score, 70); // mínimo Alto si no hay servicios
    }
    // Penalización extra si NO hay servicios Y está en zona de conflicto
    if (m.camas === 0 && DEPTOS_CONFLICTO_ALTO.has(m.depto_code)) {
      irca_score = Math.max(irca_score, 80); // mínimo Crítico
    }

    irca_score = Number(Math.min(100, Math.max(0, irca_score)).toFixed(2));

    // ----- CLASIFICACIÓN -----
    let nivel: "Bajo" | "Medio" | "Alto" | "Crítico";
    if (irca_score >= 65) nivel = "Crítico";
    else if (irca_score >= 45) nivel = "Alto";
    else if (irca_score >= 25) nivel = "Medio";
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
        eventos_por_10k: Number(eventos10k.toFixed(3)),
        vulnerabilidad: Number(vulnerabilidad.toFixed(2)),
        exposicion: Number(exposicion.toFixed(2)),
        contexto: Number(contexto.toFixed(2)),
        sin_servicios: m.camas === 0,
        en_conflicto: DEPTOS_CONFLICTO_ALTO.has(m.depto_code),
        dispersion_rural: DEPTOS_DISPERSION.has(m.depto_code),
      },
    };
  });
}
