// Pipeline IRCA v3 — DATOS REALES + UMBRALES ABSOLUTOS
// Fuentes oficiales:
//   - DIVIPOLA (gdxc-w37w): catálogo de municipios con código DANE
//   - BDUA Subsidiado (d7a5-cnra) + Contributivo (tq4m-hmg2): población afiliada (proxy de población real)
//   - REPS (s2ru-bqt6): camas hospitalarias habilitadas
//   - UNGRD (rgre-6ak4): eventos de emergencia/desastre por DIVIPOLA
// Estándares: OMS 3.5 camas/1000 hab. Promedio Colombia: 1.7. Conflicto/dispersión penalizan.

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

// Departamentos con conflicto armado activo / pobreza extrema documentada (UARIV, DNP)
const DEPTOS_CONFLICTO_ALTO = new Set(["27", "94", "97", "99", "91", "95", "44", "19", "52", "18", "86", "81"]);
// Dispersión rural extrema y barreras geográficas
const DEPTOS_DISPERSION = new Set(["27", "91", "94", "95", "97", "99", "88", "86"]);

/**
 * Normaliza nombres de municipio/departamento para emparejar fuentes con
 * notaciones inconsistentes (DANE escribe "BOGOTÁ D.C.", REPS "Bogota DC", etc.).
 * Pasos: mayúsculas → quitar tildes → quitar "D.C." → quitar artículos → solo A-Z 0-9.
 */
function norm(s: string): string {
  return (s || "")
    .toUpperCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/\bD\s*\.?\s*C\.?\b/g, "")     // quitar D.C., DC
    .replace(/\bDE\b|\bDEL\b|\bLA\b|\bLAS\b|\bEL\b|\bLOS\b/g, "") // quitar artículos
    .replace(/[^A-Z0-9 ]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

// Wrapper sobre Socrata: arma SoQL con $query, valida estructura y propaga
// errores con el dataset y status para diagnóstico rápido.

async function socrataQuery(dataset: string, soql: string): Promise<any[]> {
  const url = `${SOCRATA}/${dataset}.json?$query=${encodeURIComponent(soql)}`;
  const r = await fetch(url, { headers: { Accept: "application/json" } });
  if (!r.ok) throw new Error(`Socrata ${dataset}: ${r.status} ${await r.text().catch(() => "")}`);
  const data = await r.json();
  if (!Array.isArray(data)) throw new Error(`Socrata ${dataset} no devolvió array: ${JSON.stringify(data).slice(0, 200)}`);
  return data;
}

interface MuniRow {
  muni_code: string;
  muni_nombre: string;
  depto_code: string;
  depto_nombre: string;
  poblacion: number;
  poblacion_imputada: boolean;
  camas: number;
  eventos: number;
}

export async function runPipelineNational() {
  // ============================================================
  // 1. DIVIPOLA — catálogo oficial de municipios
  // ============================================================
  const divipola = await socrataQuery(
    "gdxc-w37w",
    "SELECT cod_dpto, dpto, cod_mpio, nom_mpio, latitud, longitud LIMIT 2000"
  );

  const muniMap = new Map<string, MuniRow>();
  const idxDeptoMuni = new Map<string, string>();   // "DEPTO_NORM|MUNI_NORM" → cod_mpio
  const idxMuni = new Map<string, string[]>();      // "MUNI_NORM" → [cod_mpio,...]

  // Construimos dos índices en memoria para que las fuentes posteriores
  // (REPS, BDUA, UNGRD) puedan emparejarse por (depto+muni) o solo (muni)
  // sin perder municipios homónimos en distintos departamentos.
  for (const r of divipola) {
    const code = String(r.cod_mpio ?? "").padStart(5, "0");
    if (code.length !== 5 || code === "00000") continue;
    const dCode = code.slice(0, 2);
    const nombre = String(r.nom_mpio ?? "").trim();
    const deptoNombre = DEPTO_NAMES[dCode] ?? r.dpto ?? "";
    muniMap.set(code, {
      muni_code: code,
      muni_nombre: nombre,
      depto_code: dCode,
      depto_nombre: deptoNombre,
      poblacion: 0,
      poblacion_imputada: false,
      camas: 0,
      eventos: 0,
    });
    const nm = norm(nombre);
    const dn = norm(deptoNombre);
    idxDeptoMuni.set(`${dn}|${nm}`, code);
    if (!idxMuni.has(nm)) idxMuni.set(nm, []);
    idxMuni.get(nm)!.push(code);
  }

  // ============================================================
  // 2. POBLACIÓN — BDUA Subsidiado + Contributivo (matched por nombre)
  // ============================================================
  const [bduaSub, bduaCon] = await Promise.all([
    socrataQuery(
      "d7a5-cnra",
      "SELECT dpr_nombre, mnc_nombre, sum(cantidad::number) as total GROUP BY dpr_nombre, mnc_nombre LIMIT 2000"
    ).catch(() => []),
    socrataQuery(
      "tq4m-hmg2",
      "SELECT dpr_nombre, mnc_nombre, sum(cantidad::number) as total GROUP BY dpr_nombre, mnc_nombre LIMIT 2000"
    ).catch(() => []),
  ]);



  // Asignar población a cada muni usando índices.
  // Estrategia: BDUA cubre ~95% de los colombianos. Multiplicamos por 1.05
  // para estimar población total. Si no hay match (depto+muni) probamos solo
  // por nombre cuando es único nacional. Si todo falla → 8.000 hab imputados
  // (penalización adicional aplicada en el componente C).
  let imputados = 0;
  let pobMatched = 0;
  // Pre-procesar BDUA agregado: (depto+muni) → total y (muni) → total
  const pobDeptoMuni = new Map<string, number>();
  const pobMuniSolo = new Map<string, number>();
  for (const r of [...bduaSub, ...bduaCon]) {
    const dpto = norm(r.dpr_nombre || "");
    const muni = norm(r.mnc_nombre || "");
    if (!muni) continue;
    const total = Number(r.total) || 0;
    pobDeptoMuni.set(`${dpto}|${muni}`, (pobDeptoMuni.get(`${dpto}|${muni}`) || 0) + total);
    pobMuniSolo.set(muni, (pobMuniSolo.get(muni) || 0) + total);
  }
  for (const m of muniMap.values()) {
    const k1 = `${norm(m.depto_nombre)}|${norm(m.muni_nombre)}`;
    let pob = pobDeptoMuni.get(k1);
    if (!pob || pob < 100) {
      const candidates = idxMuni.get(norm(m.muni_nombre)) || [];
      // Si solo hay un municipio con ese nombre a nivel nacional, usar fallback
      if (candidates.length === 1) pob = pobMuniSolo.get(norm(m.muni_nombre));
    }
    if (pob && pob > 100) {
      m.poblacion = Math.round(pob * 1.05);
      pobMatched++;
    } else {
      m.poblacion = 8000;
      m.poblacion_imputada = true;
      imputados++;
    }
  }
  console.log(`Población: ${pobMatched} reales, ${imputados} imputados`);

  // ============================================================
  // 3. CAMAS — REPS (matched por índice depto+muni)
  // ============================================================
  const reps = await socrataQuery(
    "s2ru-bqt6",
    "SELECT departamento, municipio, sum(num_cantidad_capacidad_instalada::number) as total WHERE nom_grupo_capacidad='CAMAS' GROUP BY departamento, municipio LIMIT 2000"
  ).catch(() => []);

  let camasMatched = 0;
  for (const r of reps) {
    const dpto = norm(r.departamento || "");
    const muni = norm(r.municipio || "");
    if (!muni) continue;
    const total = Number(r.total) || 0;
    let code = idxDeptoMuni.get(`${dpto}|${muni}`);
    if (!code) {
      const candidates = idxMuni.get(muni) || [];
      if (candidates.length === 1) code = candidates[0];
    }
    if (code) {
      const m = muniMap.get(code)!;
      m.camas += total;
      camasMatched++;
    }
  }
  console.log(`Camas: ${camasMatched}/${reps.length} REPS rows matched`);


  // ============================================================
  // 4. EVENTOS — UNGRD último año por DIVIPOLA
  // ============================================================
  const desde = new Date(Date.now() - 365 * 86400000).toISOString();
  const ungrd = await socrataQuery(
    "rgre-6ak4",
    `SELECT codificaci_n_segun_divipola, count(*) as total WHERE fecha >= '${desde}' GROUP BY codificaci_n_segun_divipola LIMIT 5000`
  ).catch(() => []);

  for (const r of ungrd) {
    const code = String(r.codificaci_n_segun_divipola ?? "").replace(/\D/g, "").padStart(5, "0").slice(-5);
    if (code.length !== 5) continue;
    const m = muniMap.get(code);
    if (!m) continue;
    m.eventos = Number(r.total) || 0;
  }

  // ============================================================
  // 5. FÓRMULA IRCA v3 — UMBRALES ABSOLUTOS (OMS / MinSalud / UARIV)
  // ============================================================
  // Diferencia clave vs IRCA v1: en v1 los componentes eran percentiles
  // relativos (QuantileTransformer). Esto enmascaraba la realidad: en un país
  // con brechas reales, "el peor del ranking" siempre es 100 aunque sea
  // razonable. v3 usa umbrales absolutos basados en estándares OMS/MinSalud.
  const all = Array.from(muniMap.values()).filter((m) => m.poblacion > 0);

  return all.map((m) => {
    const camas1k = (m.camas / m.poblacion) * 1000;
    const eventos10k = (m.eventos / m.poblacion) * 10000;

    // ----- A. VULNERABILIDAD SANITARIA (0-100) — peso 45% -----
    // OMS: 3.5 camas/1000 = óptimo. Colombia promedio: 1.7. Crítico: <0.5
    // Función a tramos lineal: a menor disponibilidad, mayor puntaje.
    // 0 camas reportadas → 100 directamente (servicio inexistente).
    let vulnerabilidad: number;
    if (m.camas === 0) vulnerabilidad = 100;
    else if (camas1k >= 3.5) vulnerabilidad = 0;
    else if (camas1k >= 2.0) vulnerabilidad = 20 + (3.5 - camas1k) * 13.33;
    else if (camas1k >= 1.0) vulnerabilidad = 40 + (2.0 - camas1k) * 25;
    else if (camas1k >= 0.5) vulnerabilidad = 65 + (1.0 - camas1k) * 40;
    else vulnerabilidad = 85 + (0.5 - camas1k) * 30;
    vulnerabilidad = Math.min(100, Math.max(0, vulnerabilidad));

    // ----- B. EXPOSICIÓN A DESASTRES (0-100) — peso 30% -----
    // Eventos UNGRD del último año normalizados por cada 10.000 hab.
    // Umbrales calibrados con la distribución nacional 2023-2024.
    let exposicion: number;
    if (eventos10k >= 10) exposicion = 100;
    else if (eventos10k >= 5) exposicion = 70 + (eventos10k - 5) * 6;
    else if (eventos10k >= 2) exposicion = 45 + (eventos10k - 2) * 8.33;
    else if (eventos10k >= 0.5) exposicion = 20 + (eventos10k - 0.5) * 16.67;
    else if (eventos10k > 0) exposicion = eventos10k * 40;
    else exposicion = 0;
    exposicion = Math.min(100, exposicion);

    // ----- C. CONTEXTO TERRITORIAL (0-100) — peso 25% -----
    // Penalizaciones acumuladas: conflicto armado (UARIV), dispersión rural
    // (DNP), pequeñas poblaciones rurales en conflicto, y desconocimiento
    // de población (proxy de subregistro). Capado a 100.
    let contexto = 0;
    if (DEPTOS_CONFLICTO_ALTO.has(m.depto_code)) contexto += 50;
    if (DEPTOS_DISPERSION.has(m.depto_code)) contexto += 35;
    if (m.poblacion < 5000 && DEPTOS_CONFLICTO_ALTO.has(m.depto_code)) contexto += 15;
    if (m.poblacion_imputada) contexto += 10; // sin datos = riesgo de subregistro
    contexto = Math.min(100, contexto);

    // ----- IRCA SCORE FINAL -----
    // Combinación lineal ponderada de los 3 componentes.
    let irca_score = vulnerabilidad * 0.45 + exposicion * 0.30 + contexto * 0.25;

    // Penalizaciones duras: si un municipio tiene población significativa y
    // CERO camas reportadas, no puede caer por debajo de cierto piso aunque
    // su contexto territorial sea favorable. Aumenta progresivamente con el
    // tamaño de la población desatendida y con la presencia de conflicto.
    if (m.camas === 0 && m.poblacion > 1000) irca_score = Math.max(irca_score, 70);
    if (m.camas === 0 && DEPTOS_CONFLICTO_ALTO.has(m.depto_code)) irca_score = Math.max(irca_score, 80);
    if (m.camas === 0 && m.poblacion > 10000) irca_score = Math.max(irca_score, 85);

    irca_score = Number(Math.min(100, Math.max(0, irca_score)).toFixed(2));

    // Clasificación final con umbrales fijos (no relativos al ranking).
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
        poblacion_imputada: m.poblacion_imputada,
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
