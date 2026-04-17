/**
 * datasets.ts
 * Pipeline IRCA con cobertura nacional (32 deptos · 1.122 municipios)
 *
 * Fuentes Socrata:
 *   DIVIPOLA      → gdxc-w37w  (cod_dpto, cod_mpio, nom_mpio, latitud, longitud)
 *   REPS Capacidad → s2ru-bqt6  (camas habilitadas por IPS/ESE)
 *   UNGRD 2019-22  → wwkg-r6te  (eventos históricos)
 *   UNGRD 2023-24  → rgre-6ak4  (eventos recientes con GPS)
 *   DANE Pob 2035  → estimaciones integradas (DANE no expone Socrata)
 */

import type { Municipio } from '@/types/municipio';

const SOCRATA_BASE = 'https://www.datos.gov.co/resource';

// ── Helpers ──────────────────────────────────────────────────────────────────

export const normalizeStr = (s: string) =>
  s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();

const toNum = (v: string | undefined) => parseFloat(v ?? '0') || 0;
const toInt = (v: string | undefined) => parseInt(v ?? '0', 10) || 0;

// ── Departamentos de Colombia (33 entidades — 32 deptos + Bogotá) ────────────

export const DEPTO_NAMES: Record<string, string> = {
  '05': 'Antioquia', '08': 'Atlántico', '11': 'Bogotá D.C.', '13': 'Bolívar',
  '15': 'Boyacá', '17': 'Caldas', '18': 'Caquetá', '19': 'Cauca', '20': 'Cesar',
  '23': 'Córdoba', '25': 'Cundinamarca', '27': 'Chocó', '41': 'Huila',
  '44': 'La Guajira', '47': 'Magdalena', '50': 'Meta', '52': 'Nariño',
  '54': 'Norte de Santander', '63': 'Quindío', '66': 'Risaralda', '68': 'Santander',
  '70': 'Sucre', '73': 'Tolima', '76': 'Valle del Cauca', '81': 'Arauca',
  '85': 'Casanare', '86': 'Putumayo', '88': 'San Andrés y Providencia',
  '91': 'Amazonas', '94': 'Guainía', '95': 'Guaviare', '97': 'Vaupés', '99': 'Vichada',
};

// Población departamental aprox (DANE 2024) — usada para imputar municipios sin valor
const DEPT_POP_AVG: Record<string, number> = {
  '05': 31000, '08': 30000, '11': 7900000, '13': 22000, '15': 9500, '17': 17000,
  '18': 23000, '19': 30000, '20': 26000, '23': 56000, '25': 24000, '27': 14000,
  '41': 23000, '44': 71000, '47': 38000, '50': 33000, '52': 24500, '54': 33000,
  '63': 50000, '66': 50000, '68': 28000, '70': 32000, '73': 28000, '76': 110000,
  '81': 38000, '85': 19000, '86': 22000, '88': 31000, '91': 9000, '94': 12500,
  '95': 30000, '97': 5500, '99': 26000,
};

// ── Referencia Chocó (mantenida para fallbacks y demos rápidas) ──────────────

export interface MunRef {
  cod: number;
  name: string;
  nameNorm: string;
  dept: string;
  poblacion: number;
}

export const MUN_CHOCO: MunRef[] = [
  { cod: 27001, name: 'Quibdó',                  poblacion: 122000 },
  { cod: 27006, name: 'Acandí',                   poblacion: 9800   },
  { cod: 27025, name: 'Alto Baudó',               poblacion: 14200  },
  { cod: 27050, name: 'Atrato',                   poblacion: 8500   },
  { cod: 27073, name: 'Bagadó',                   poblacion: 7300   },
  { cod: 27075, name: 'Bahía Solano',             poblacion: 11000  },
  { cod: 27077, name: 'Bajo Baudó',               poblacion: 19500  },
  { cod: 27086, name: 'Belén de Bajirá',          poblacion: 21000  },
  { cod: 27099, name: 'Bojayá',                   poblacion: 9200   },
  { cod: 27135, name: 'El Cantón del San Pablo',  poblacion: 4800   },
  { cod: 27150, name: 'Carmen del Darién',        poblacion: 7600   },
  { cod: 27160, name: 'Cértegui',                 poblacion: 6100   },
  { cod: 27205, name: 'Condoto',                  poblacion: 15200  },
  { cod: 27245, name: 'El Carmen de Atrato',      poblacion: 14800  },
  { cod: 27250, name: 'El Litoral del San Juan',  poblacion: 8900   },
  { cod: 27361, name: 'Istmina',                  poblacion: 22000  },
  { cod: 27372, name: 'Juradó',                   poblacion: 3200   },
  { cod: 27413, name: 'Lloró',                    poblacion: 8700   },
  { cod: 27425, name: 'Medio Atrato',             poblacion: 10500  },
  { cod: 27430, name: 'Medio Baudó',              poblacion: 8200   },
  { cod: 27450, name: 'Medio San Juan',           poblacion: 12800  },
  { cod: 27491, name: 'Nóvita',                   poblacion: 8100   },
  { cod: 27495, name: 'Nuquí',                    poblacion: 7400   },
  { cod: 27580, name: 'Río Iró',                  poblacion: 6900   },
  { cod: 27600, name: 'Río Quito',                poblacion: 7200   },
  { cod: 27615, name: 'Riosucio',                 poblacion: 28000  },
  { cod: 27660, name: 'San José del Palmar',      poblacion: 5600   },
  { cod: 27745, name: 'Sipí',                     poblacion: 4100   },
  { cod: 27787, name: 'Tadó',                     poblacion: 17600  },
  { cod: 27800, name: 'Unguía',                   poblacion: 16400  },
  { cod: 27810, name: 'Unión Panamericana',       poblacion: 8900   },
].map(m => ({ ...m, dept: 'Chocó', nameNorm: normalizeStr(m.name) }));

const POB_OVERRIDE: Record<number, number> = Object.fromEntries(
  MUN_CHOCO.map(m => [m.cod, m.poblacion]),
);

/** DANE pob como tabla (para drill-down legado) */
export function getDanePobRows(): Record<string, string>[] {
  return MUN_CHOCO.map(m => ({
    cod_municipio:    String(m.cod),
    municipio:        m.name,
    departamento:     m.dept,
    poblacion_2024:   String(m.poblacion),
    fuente:           'DANE Proyecciones 2018–2035',
    nota:             'Valor de referencia integrado',
  }));
}

// ── Catálogo de fuentes ──────────────────────────────────────────────────────

export interface DatasetMeta {
  updatedAt:     string;
  createdAt:     string;
  frequency:     string;
  coverage:      string;
  license:       string;
  views:         string;
  downloads:     string;
  tags:          string[];
  category:      string;
  language:      string;
}

export const DATASET_CATALOG = {
  divipola: {
    id:          'gdxc-w37w',
    name:        'DIVIPOLA – Municipios de Colombia',
    institution: 'DANE',
    description: 'Codificación oficial de municipios y departamentos. Llave territorial maestra nacional.',
    url:         'https://www.datos.gov.co/Mapas-Nacionales/Divipola/gdxc-w37w/about_data',
    isReference: false,
    color:       'hsl(200,70%,50%)',
    priorityCols: ['cod_municipio', 'nom_mpio', 'dpto', 'cod_dpto', 'tipo_municipio', 'latitud', 'longitud'],
    meta: {
      updatedAt:  '24 ene 2025', createdAt:  '13 jul 2016', frequency:  'Semestral',
      coverage:   'Nacional', license:    'CC BY-SA 4.0', views:      '168 K',
      downloads:  '228 K', tags:       ['codigo', 'departamento', 'municipio'],
      category:   'Mapas Nacionales', language:   'Español',
    } satisfies DatasetMeta,
  },
  dane_pob: {
    id:          'dane-proyecciones-2035',
    name:        'Proyecciones de Población 2018–2035',
    institution: 'DANE',
    description: 'Proyecciones municipales por sexo y edad basadas en el Censo 2018.',
    url:         'https://www.dane.gov.co/index.php/estadisticas-por-tema/demografia-y-poblacion/proyecciones-de-poblacion',
    isReference: true,
    color:       'hsl(180,60%,45%)',
    priorityCols: ['cod_municipio', 'municipio', 'departamento', 'poblacion_2024', 'fuente'],
    meta: {
      updatedAt:  '2023', createdAt:  '2018', frequency:  'Por Censo (10 años)',
      coverage:   'Nacional', license:    'CC BY 4.0', views:      'N/A', downloads:  'N/A',
      tags:       ['poblacion', 'proyecciones', 'censo 2018'],
      category:   'Demografía y Población', language:   'Español',
    } satisfies DatasetMeta,
  },
  reps: {
    id:          's2ru-bqt6',
    name:        'REPS – Capacidad Instalada',
    institution: 'MinSalud',
    description: 'Camas habilitadas por tipo, consultorios y ambulancias por IPS/ESE activa en Colombia.',
    url:         'https://www.datos.gov.co/Salud-y-Protecci-n-Social/Capacidad-Instalada/s2ru-bqt6/about_data',
    isReference: false,
    color:       'hsl(145,63%,45%)',
    priorityCols: ['municipio', 'nombre_prestador', 'nom_grupo_capacidad', 'nom_descripcion_capacidad', 'num_cantidad_capacidad_instalada', 'departamento'],
    meta: {
      updatedAt:  'Mensual', createdAt:  '2015', frequency:  'Mensual',
      coverage:   'Nacional', license:    'CC BY 4.0', views:      '50 K+', downloads:  '80 K+',
      tags:       ['salud', 'camas', 'IPS', 'ESE', 'REPS'],
      category:   'Salud y Protección Social', language:   'Español',
    } satisfies DatasetMeta,
  },
  ungrd_hist: {
    id:          'wwkg-r6te',
    name:        'Emergencias UNGRD 2019–2022',
    institution: 'UNGRD',
    description: 'Eventos históricos de emergencias con afectación en vías, puentes, viviendas.',
    url:         'https://www.datos.gov.co/Ambiente-y-Desarrollo-Sostenible/Emergencias-UNGRD/wwkg-r6te/about_data',
    isReference: false,
    color:       'hsl(25,85%,52%)',
    priorityCols: ['fecha', 'municipio', 'divipola', 'evento', 'vias_averiadas', 'puentes_vehiculares', 'puentes_peatonales', 'fallecidos', 'heridos', 'personas'],
    meta: {
      updatedAt:  '2023', createdAt:  '2019', frequency:  'Anual',
      coverage:   'Nacional', license:    'CC BY 4.0', views:      '30 K+', downloads:  '45 K+',
      tags:       ['emergencias', 'desastres', 'UNGRD', 'vias'],
      category:   'Ambiente y Desarrollo Sostenible', language:   'Español',
    } satisfies DatasetMeta,
  },
  ungrd_recent: {
    id:          'rgre-6ak4',
    name:        'Emergencias UNGRD 2023–2024',
    institution: 'UNGRD',
    description: 'Eventos recientes con coordenadas GPS y soporte financiero del FNGRD.',
    url:         'https://www.datos.gov.co/Ambiente-y-Desarrollo-Sostenible/Emergencias-2023-2024/rgre-6ak4/about_data',
    isReference: false,
    color:       'hsl(10,70%,50%)',
    priorityCols: ['fecha', 'municipio', 'divipola', 'evento', 'vias_averiadas', 'puentes_vehiculares', 'puentes_peatonales', 'fallecidos', 'heridos', 'personas'],
    meta: {
      updatedAt:  'ene 2025', createdAt:  'ene 2023', frequency:  'Trimestral',
      coverage:   'Nacional', license:    'CC BY 4.0', views:      '12 K+', downloads:  '18 K+',
      tags:       ['emergencias', 'desastres', '2023', '2024', 'GPS'],
      category:   'Ambiente y Desarrollo Sostenible', language:   'Español',
    } satisfies DatasetMeta,
  },
} as const;

export type SourceKey = keyof typeof DATASET_CATALOG;

// ── Fetch Socrata ────────────────────────────────────────────────────────────

async function socrataFetch(
  datasetId: string,
  where: string,
  limit = 50_000,
): Promise<Record<string, string>[]> {
  const token = (import.meta.env.VITE_DATOS_GOV_TOKEN as string | undefined) ?? '';
  const params = new URLSearchParams({ $where: where, $limit: String(limit) });
  const headers: HeadersInit = { Accept: 'application/json' };
  if (token) (headers as Record<string, string>)['X-App-Token'] = token;

  const url = `${SOCRATA_BASE}/${datasetId}.json?${params}`;
  let res: Response;
  try {
    res = await fetch(url, { headers, signal: AbortSignal.timeout(45_000) });
  } catch (e: unknown) {
    const cause = e instanceof Error ? e.message : String(e);
    throw new Error(`Red/CORS al consultar ${datasetId}: ${cause}`);
  }

  if (!res.ok) {
    let detail = '';
    try {
      const json = await res.json() as { message?: string; code?: string };
      detail = json.message ?? json.code ?? '';
    } catch {
      detail = await res.text().catch(() => '');
    }
    throw new Error(
      `HTTP ${res.status} en ${datasetId}${detail ? ': ' + detail.slice(0, 300) : ''}`,
    );
  }

  const data = await res.json() as unknown;
  if (data && typeof data === 'object' && !Array.isArray(data)) {
    const obj = data as { error?: boolean; message?: string };
    if (obj.error) throw new Error(`Socrata error en ${datasetId}: ${obj.message ?? 'desconocido'}`);
  }
  return data as Record<string, string>[];
}

async function socrataFetchWithFallback(
  datasetId: string,
  strategies: string[],
  limit = 50_000,
): Promise<{ rows: Record<string, string>[]; usedStrategy: number }> {
  let lastErr: Error = new Error('Sin estrategias');
  for (let i = 0; i < strategies.length; i++) {
    try {
      const rows = await socrataFetch(datasetId, strategies[i], limit);
      return { rows, usedStrategy: i };
    } catch (e: unknown) {
      lastErr = e instanceof Error ? e : new Error(String(e));
      if (lastErr.message.startsWith('Red/CORS')) break;
    }
  }
  throw lastErr;
}

// ── Fetchers ────────────────────────────────────────────────────────────────

export async function fetchDivipola(
  onCount?: (n: number) => void,
  deptFilter?: string | null,
): Promise<Record<string, string>[]> {
  const where = deptFilter ? `cod_dpto='${deptFilter}'` : `cod_dpto IS NOT NULL`;
  const rows = await socrataFetch('gdxc-w37w', where, 2_000);
  const enriched = rows.map(r => ({
    ...r,
    cod_municipio: `${String(r.cod_dpto ?? '').padStart(2, '0')}${String(r.cod_mpio ?? '').padStart(3, '0')}`,
  }));
  onCount?.(enriched.length);
  return enriched;
}

/** REPS — TODAS las camas de Colombia (sin filtro Chocó) */
export async function fetchReps(
  onCount?: (n: number) => void,
): Promise<Record<string, string>[]> {
  const rows = await socrataFetch('s2ru-bqt6', `nom_grupo_capacidad='CAMAS'`, 200_000);
  onCount?.(rows.length);
  return rows;
}

/** UNGRD Histórico — Colombia entera */
export async function fetchUngrdHist(
  onCount?: (n: number) => void,
): Promise<Record<string, string>[]> {
  const strategies = [`divipola IS NOT NULL`, `1=1`];
  const { rows } = await socrataFetchWithFallback('wwkg-r6te', strategies, 200_000);
  onCount?.(rows.length);
  return rows;
}

/** UNGRD Reciente — Colombia entera */
export async function fetchUngrdRecent(
  onCount?: (n: number) => void,
): Promise<Record<string, string>[]> {
  const strategies = [`divipola IS NOT NULL`, `1=1`];
  const { rows } = await socrataFetchWithFallback('rgre-6ak4', strategies, 200_000);
  onCount?.(rows.length);
  return rows;
}

// ── Calidad ──────────────────────────────────────────────────────────────────

export interface QualityMetrics {
  completeness: number;
  coverage:     number;
  rowCount:     number;
  colCount:     number;
}

export function computeQuality(
  rows: Record<string, string>[],
  getCode?: (r: Record<string, string>) => number,
): QualityMetrics {
  if (!rows.length) return { completeness: 0, coverage: 0, rowCount: 0, colCount: 0 };
  const cols = Object.keys(rows[0]);
  const total = rows.length * cols.length;
  const filled = rows.reduce(
    (acc, r) => acc + cols.filter(c => r[c] !== undefined && r[c] !== null && r[c] !== '').length,
    0,
  );
  let coverage = 0;
  if (getCode) {
    const found = new Set(rows.map(getCode).filter(c => c > 0));
    coverage = found.size;
  }
  return {
    completeness: Math.round((filled / total) * 100),
    coverage,
    rowCount: rows.length,
    colCount: cols.length,
  };
}

// ── Pipeline IRCA NACIONAL ───────────────────────────────────────────────────

export interface PipelineLog {
  ts:    string;
  level: 'info' | 'warn' | 'error';
  msg:   string;
}

function percentileRanks(values: number[]): number[] {
  const n = values.length;
  if (n <= 1) return values.map(() => 0);
  return values.map(v => {
    const below = values.filter(x => x < v).length;
    return below / (n - 1);
  });
}

function nivelRiesgo(score: number): Municipio['nivel_riesgo'] {
  if (score >= 0.75) return 'Crítico';
  if (score >= 0.50) return 'Alto';
  if (score >= 0.25) return 'Medio';
  return 'Bajo';
}

function recomendacion(nivel: string): string {
  if (nivel === 'Crítico')
    return 'Notificar al comité departamental de gestión del riesgo y revisar la red de referencia del municipio en las próximas 24 horas.';
  if (nivel === 'Alto')
    return 'Notificar al comité departamental y verificar disponibilidad operativa básica y planes de contingencia.';
  if (nivel === 'Medio')
    return 'Solicitar validación del plan local de contingencia y seguimiento territorial reforzado.';
  return 'Monitoreo sin acción inmediata e inclusión en reporte departamental.';
}

interface MunBuild {
  cod: number;
  cod_dpto: string;
  name: string;
  nameNorm: string;
  dept: string;
  poblacion: number;
  poblacionImputada: boolean;
  lat?: number;
  lng?: number;
}

/**
 * Pipeline nacional. Ahora recibe DIVIPOLA opcionalmente — si no llega usa fallback Chocó.
 */
export async function runIrcaPipelineNational(
  divipolaRows: Record<string, string>[],
  repsRows: Record<string, string>[],
  ungrdHistRows: Record<string, string>[],
  ungrdRecentRows: Record<string, string>[],
  addLog: (l: PipelineLog) => void = () => {},
): Promise<Municipio[]> {
  const log = (level: PipelineLog['level'], msg: string) =>
    addLog({ ts: new Date().toLocaleTimeString('es-CO'), level, msg });

  log('info', '=== Pipeline IRCA Nacional iniciado ===');

  // 1. Universo de municipios
  let universe: MunBuild[] = [];

  if (divipolaRows.length > 0) {
    universe = divipolaRows
      .map(r => {
        const codDpto = String(r.cod_dpto ?? '').padStart(2, '0');
        const codMun  = String(r.cod_mpio ?? '').padStart(3, '0');
        const cod     = parseInt(`${codDpto}${codMun}`, 10);
        if (!cod || isNaN(cod)) return null;
        const name = r.nom_mpio ?? r.municipio ?? `Municipio ${codMun}`;
        const lat  = r.latitud  ? parseFloat(r.latitud)  : undefined;
        const lng  = r.longitud ? parseFloat(r.longitud) : undefined;
        const dept = DEPTO_NAMES[codDpto] ?? r.dpto ?? `Depto ${codDpto}`;
        const pob  = POB_OVERRIDE[cod] ?? DEPT_POP_AVG[codDpto] ?? 15000;
        return {
          cod, cod_dpto: codDpto, name, nameNorm: normalizeStr(name),
          dept, poblacion: pob, poblacionImputada: !POB_OVERRIDE[cod],
          lat: lat && !isNaN(lat) ? lat : undefined,
          lng: lng && !isNaN(lng) ? lng : undefined,
        } satisfies MunBuild;
      })
      .filter((x): x is MunBuild => x !== null);
    log('info', `DIVIPOLA: ${universe.length} municipios cargados (cobertura nacional)`);
  } else {
    universe = MUN_CHOCO.map(m => ({
      cod: m.cod, cod_dpto: '27', name: m.name, nameNorm: m.nameNorm,
      dept: 'Chocó', poblacion: m.poblacion, poblacionImputada: false,
    }));
    log('warn', `DIVIPOLA no disponible — usando fallback Chocó (${universe.length} municipios)`);
  }

  if (universe.length === 0) {
    log('error', 'Universo vacío — abortando');
    return [];
  }

  const VALID_CODES = new Set(universe.map(u => u.cod));

  // 2. Camas REPS (join por DIVIPOLA cuando se puede, fallback nombre+depto)
  const bedsByCod: Record<number, number> = {};
  let repsMatched = 0, repsByCode = 0, repsByName = 0;

  // Pre-construir índice nombre→cod por departamento
  const nameDeptIndex = new Map<string, number>();
  for (const u of universe) {
    nameDeptIndex.set(`${u.cod_dpto}|${u.nameNorm}`, u.cod);
  }
  // Dept name → cod
  const deptNameToCod = new Map<string, string>();
  for (const [cod, nom] of Object.entries(DEPTO_NAMES)) {
    deptNameToCod.set(normalizeStr(nom), cod);
  }

  repsRows.forEach(r => {
    const qty = toNum(r.num_cantidad_capacidad_instalada);
    if (!qty) return;

    // Intento 1: DIVIPOLA directo si existe
    let cod = toInt(r.cod_municipio ?? r.divipola ?? r.codmunicipio);
    if (cod && VALID_CODES.has(cod)) {
      bedsByCod[cod] = (bedsByCod[cod] ?? 0) + qty;
      repsByCode++; repsMatched++;
      return;
    }

    // Intento 2: nombre + departamento
    const munNorm = normalizeStr(r.municipio ?? r.municipiosededesc ?? '');
    const deptNorm = normalizeStr(r.departamento ?? '');
    const codDpto = deptNameToCod.get(deptNorm);
    if (munNorm && codDpto) {
      const k = `${codDpto}|${munNorm}`;
      const found = nameDeptIndex.get(k);
      if (found) {
        bedsByCod[found] = (bedsByCod[found] ?? 0) + qty;
        repsByName++; repsMatched++;
      }
    }
  });
  log('info', `REPS: ${repsMatched.toLocaleString('es-CO')} filas integradas (${repsByCode} por código + ${repsByName} por nombre)`);

  // 3. Eventos UNGRD
  const ungrdRows = [...ungrdHistRows, ...ungrdRecentRows];
  interface Agg { eventos: number; vias: number; puentes: number; coords: [number, number][] }
  const evtByCod: Record<number, Agg> = {};

  ungrdRows.forEach(r => {
    const raw = r.divipola ?? r.cod_divipola ?? r.codigo_divipola ?? '';
    const cod = toInt(raw);
    if (!cod || !VALID_CODES.has(cod)) return;
    if (!evtByCod[cod]) evtByCod[cod] = { eventos: 0, vias: 0, puentes: 0, coords: [] };
    evtByCod[cod].eventos++;
    evtByCod[cod].vias    += toInt(r.vias_averiadas);
    evtByCod[cod].puentes += toInt(r.puentes_vehiculares) + toInt(r.puentes_peatonales);
    const lat = parseFloat(r.latitud ?? r.lat ?? '');
    const lng = parseFloat(r.longitud ?? r.lon ?? r.lng ?? '');
    if (!isNaN(lat) && !isNaN(lng) && lat !== 0) evtByCod[cod].coords.push([lat, lng]);
  });
  log('info', `UNGRD: ${Object.keys(evtByCod).length} municipios con eventos registrados`);

  // 4. Tabla base
  const base = universe.map(m => {
    const camas    = bedsByCod[m.cod] ?? 0;
    const evt      = evtByCod[m.cod];
    const totalEvt = evt?.eventos ?? 0;
    const sevVial  = totalEvt > 0 ? (evt.vias + evt.puentes) / totalEvt : 0;
    const camas1k  = m.poblacion > 0 ? camas / (m.poblacion / 1000) : 0;
    // Si no había lat/lng en DIVIPOLA, intentar usar promedio de eventos UNGRD
    let lat = m.lat, lng = m.lng;
    if ((!lat || !lng) && evt?.coords.length) {
      lat = evt.coords.reduce((s, c) => s + c[0], 0) / evt.coords.length;
      lng = evt.coords.reduce((s, c) => s + c[1], 0) / evt.coords.length;
    }
    return { m, camas, totalEvt, sevVial, camas1k, lat, lng };
  });

  // 5. Percentiles
  const pctlVuln = percentileRanks(base.map(r => r.camas1k)).map(v => 1 - v);
  const pctlExpo = percentileRanks(base.map(r => r.totalEvt));
  const pctlSev  = percentileRanks(base.map(r => r.sevVial));

  // 6. Municipio[]
  const result: Municipio[] = base.map(({ m, camas, totalEvt, sevVial, camas1k, lat, lng }, i) => {
    const irca  = (pctlVuln[i] + pctlExpo[i] + pctlSev[i]) / 3;
    const nivel = nivelRiesgo(irca);
    const sinEvt = totalEvt === 0;
    return {
      cod_municipio:          m.cod,
      municipio:              m.name,
      depto:                  m.dept,
      cod_depto:              m.cod_dpto,
      poblacion:              m.poblacion,
      poblacion_imputada:     m.poblacionImputada,
      camas_totales:          camas,
      camas_por_1000_hab:     camas1k,
      total_eventos:          totalEvt,
      severidad_vial:         sevVial,
      expuestos:              !sinEvt,
      sin_eventos_reportados: sinEvt,
      pctl_vuln_salud:        pctlVuln[i],
      pctl_exposicion:        pctlExpo[i],
      pctl_severidad:         pctlSev[i],
      iraa_score:             irca,
      nivel_riesgo:           nivel,
      estado_confianza:       sinEvt || camas === 0 ? 'Baja - validación requerida' : 'Alta',
      recomendacion:          recomendacion(nivel),
      lat,
      lng,
    };
  });

  const dist = result.reduce((acc, r) => {
    acc[r.nivel_riesgo] = (acc[r.nivel_riesgo] ?? 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  log('info', `Distribución: Crítico=${dist['Crítico'] ?? 0} · Alto=${dist['Alto'] ?? 0} · Medio=${dist['Medio'] ?? 0} · Bajo=${dist['Bajo'] ?? 0}`);
  log('info', '=== Pipeline completado ===');

  return result.sort((a, b) => b.iraa_score - a.iraa_score);
}

/**
 * Wrapper de retrocompatibilidad — Chocó solamente, mantiene API anterior.
 * Usado por DatasetManager/legados.
 */
export function runIrcaPipeline(
  repsRows: Record<string, string>[],
  ungrdHistRows: Record<string, string>[],
  ungrdRecentRows: Record<string, string>[],
  addLog: (l: PipelineLog) => void,
): Municipio[] {
  // Filtra REPS y UNGRD a Chocó
  const repsChoco = repsRows.filter(r => {
    const dept = normalizeStr(r.departamento ?? '');
    return dept.includes('choc');
  });
  const ungrdHistChoco = ungrdHistRows.filter(r => String(r.divipola ?? '').startsWith('27'));
  const ungrdRecentChoco = ungrdRecentRows.filter(r => String(r.divipola ?? '').startsWith('27'));

  // Sync wrapper: usar pipeline nacional con DIVIPOLA vacío → fallback Chocó
  let result: Municipio[] = [];
  void runIrcaPipelineNational([], repsChoco, ungrdHistChoco, ungrdRecentChoco, addLog).then(r => {
    result = r;
  });
  // Como necesita ser síncrono y el pipeline nacional NO usa await internamente,
  // simplemente lo reimplementamos en línea aquí:
  const universe = MUN_CHOCO.map(m => ({
    cod: m.cod, cod_dpto: '27', name: m.name, nameNorm: m.nameNorm,
    dept: 'Chocó', poblacion: m.poblacion, poblacionImputada: false,
  }));
  const VALID = new Set(universe.map(u => u.cod));

  const bedsByCod: Record<number, number> = {};
  repsChoco.forEach(r => {
    const qty = toNum(r.num_cantidad_capacidad_instalada);
    const munNorm = normalizeStr(r.municipio ?? r.municipiosededesc ?? '');
    const found = universe.find(u => u.nameNorm === munNorm);
    if (found && qty) bedsByCod[found.cod] = (bedsByCod[found.cod] ?? 0) + qty;
  });

  interface Agg { eventos: number; vias: number; puentes: number }
  const evtByCod: Record<number, Agg> = {};
  [...ungrdHistChoco, ...ungrdRecentChoco].forEach(r => {
    const cod = toInt(r.divipola);
    if (!VALID.has(cod)) return;
    if (!evtByCod[cod]) evtByCod[cod] = { eventos: 0, vias: 0, puentes: 0 };
    evtByCod[cod].eventos++;
    evtByCod[cod].vias    += toInt(r.vias_averiadas);
    evtByCod[cod].puentes += toInt(r.puentes_vehiculares) + toInt(r.puentes_peatonales);
  });

  const base = universe.map(m => {
    const camas = bedsByCod[m.cod] ?? 0;
    const evt = evtByCod[m.cod];
    const totalEvt = evt?.eventos ?? 0;
    const sevVial = totalEvt > 0 ? (evt.vias + evt.puentes) / totalEvt : 0;
    const camas1k = m.poblacion > 0 ? camas / (m.poblacion / 1000) : 0;
    return { m, camas, totalEvt, sevVial, camas1k };
  });

  const pctlVuln = percentileRanks(base.map(r => r.camas1k)).map(v => 1 - v);
  const pctlExpo = percentileRanks(base.map(r => r.totalEvt));
  const pctlSev  = percentileRanks(base.map(r => r.sevVial));

  result = base.map(({ m, camas, totalEvt, sevVial, camas1k }, i) => {
    const irca = (pctlVuln[i] + pctlExpo[i] + pctlSev[i]) / 3;
    const nivel = nivelRiesgo(irca);
    const sinEvt = totalEvt === 0;
    return {
      cod_municipio:          m.cod,
      municipio:              m.name,
      depto:                  'Chocó',
      cod_depto:              '27',
      poblacion:              m.poblacion,
      poblacion_imputada:     false,
      camas_totales:          camas,
      camas_por_1000_hab:     camas1k,
      total_eventos:          totalEvt,
      severidad_vial:         sevVial,
      expuestos:              !sinEvt,
      sin_eventos_reportados: sinEvt,
      pctl_vuln_salud:        pctlVuln[i],
      pctl_exposicion:        pctlExpo[i],
      pctl_severidad:         pctlSev[i],
      iraa_score:             irca,
      nivel_riesgo:           nivel,
      estado_confianza:       sinEvt ? 'Baja - validación requerida' : 'Alta',
      recomendacion:          recomendacion(nivel),
    };
  });

  return result.sort((a, b) => a.municipio.localeCompare(b.municipio, 'es'));
}
