import { useState, useCallback, useRef, useMemo } from 'react';
import {
  X, Database, RefreshCw, Play, CheckCircle2, AlertCircle,
  Loader2, ExternalLink, ChevronDown, ChevronUp, Download,
  Search, ArrowUpDown, ArrowUp, ArrowDown, Info, GitBranch,
  Layers, Zap, Eye, EyeOff, Calendar, RotateCcw, Globe,
  Scale, TrendingUp,
} from 'lucide-react';
import { toast } from 'sonner';
import type { Municipio } from '@/types/municipio';
import {
  DATASET_CATALOG, MUN_CHOCO, getDanePobRows, computeQuality,
  fetchDivipola, fetchReps, fetchUngrdHist, fetchUngrdRecent,
  runIrcaPipeline, type PipelineLog, type SourceKey,
} from '@/lib/datasets';

// ── Types ─────────────────────────────────────────────────────────────────────

type FetchStatus = 'idle' | 'loading' | 'ok' | 'error';
type Tab = 'sources' | 'pipeline' | 'lineage';

interface SourceState {
  status:    FetchStatus;
  rows:      Record<string, string>[];
  fetchedAt: Date | null;
  error:     string;
}

const IDLE_SOURCE: SourceState = { status: 'idle', rows: [], fetchedAt: null, error: '' };
const REFERENCE_SOURCE = (rows: Record<string, string>[]): SourceState => ({
  status: 'ok', rows, fetchedAt: null, error: '',
});

interface PipelineState {
  logs:   PipelineLog[];
  stats:  Record<string, number> | null;
  runAt:  Date | null;
  result: Municipio[] | null;
}

interface Props {
  open:         boolean;
  onClose:      () => void;
  onDataUpdate: (data: Municipio[], runAt: Date) => void;
}

// ── Main Component ────────────────────────────────────────────────────────────

export default function DatasetManager({ open, onClose, onDataUpdate }: Props) {
  const [tab, setTab] = useState<Tab>('sources');
  const [expanded, setExpanded] = useState<SourceKey | null>(null);

  const [sources, setSources] = useState<Record<SourceKey, SourceState>>({
    divipola:     IDLE_SOURCE,
    dane_pob:     REFERENCE_SOURCE(getDanePobRows()),
    reps:         IDLE_SOURCE,
    ungrd_hist:   IDLE_SOURCE,
    ungrd_recent: IDLE_SOURCE,
  });

  const [pipeline, setPipeline] = useState<PipelineState>({ logs: [], stats: null, runAt: null, result: null });
  const [running, setRunning] = useState(false);

  const addLog = useCallback((l: PipelineLog) =>
    setPipeline(p => ({ ...p, logs: [l, ...p.logs].slice(0, 300) })), []);

  if (!open) return null;

  // ── Source updater ────────────────────────────────────────────────────────
  const updateSource = (key: SourceKey, patch: Partial<SourceState>) =>
    setSources(s => ({ ...s, [key]: { ...s[key], ...patch } }));

  // ── Loaders ───────────────────────────────────────────────────────────────
  const load = async (key: SourceKey, fetcher: () => Promise<Record<string, string>[]>) => {
    updateSource(key, { status: 'loading', error: '' });
    try {
      const rows = await fetcher();
      updateSource(key, { status: 'ok', rows, fetchedAt: new Date(), error: '' });
      toast.success(`${DATASET_CATALOG[key].name}: ${rows.length.toLocaleString('es-CO')} registros`);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      updateSource(key, { status: 'error', rows: [], error: msg });
      toast.error(`Error cargando ${DATASET_CATALOG[key].name}`, { description: msg });
    }
  };

  const loaders: Record<SourceKey, () => Promise<void>> = {
    divipola:     () => load('divipola',     () => fetchDivipola()),
    dane_pob:     async () => {},  // reference — no fetch
    reps:         () => load('reps',         () => fetchReps()),
    ungrd_hist:   () => load('ungrd_hist',   () => fetchUngrdHist()),
    ungrd_recent: () => load('ungrd_recent', () => fetchUngrdRecent()),
  };

  const loadAll = () =>
    Promise.all((['divipola', 'reps', 'ungrd_hist', 'ungrd_recent'] as SourceKey[]).map(k => loaders[k]()));

  // ── Pipeline ──────────────────────────────────────────────────────────────
  const canRun = sources.reps.status === 'ok'
    && (sources.ungrd_hist.status === 'ok' || sources.ungrd_recent.status === 'ok');

  const runPipeline = () => {
    if (!canRun) { toast.warning('Carga REPS y al menos un dataset UNGRD'); return; }
    setRunning(true);
    setPipeline(p => ({ ...p, logs: [], stats: null }));
    setTimeout(() => {
      try {
        const result = runIrcaPipeline(
          sources.reps.rows,
          sources.ungrd_hist.rows,
          sources.ungrd_recent.rows,
          addLog,
        );
        const now   = new Date();
        const stats = result.reduce((a, r) => ({ ...a, [r.nivel_riesgo]: (a[r.nivel_riesgo] ?? 0) + 1 }), {} as Record<string, number>);
        setPipeline(p => ({ ...p, stats, runAt: now, result }));
        onDataUpdate(result, now);
        toast.success('Dashboard actualizado', {
          description: `${result.length} municipios procesados · ${now.toLocaleTimeString('es-CO')}`,
        });
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e);
        addLog({ ts: new Date().toLocaleTimeString('es-CO'), level: 'error', msg });
        toast.error('Error en pipeline', { description: msg });
      } finally { setRunning(false); }
    }, 50);
  };

  // ── Overview stats ────────────────────────────────────────────────────────
  const totalRecords = Object.values(sources).reduce((s, src) => s + src.rows.length, 0);
  const loadedCount  = Object.values(sources).filter(s => s.status === 'ok').length;
  const errorCount   = Object.values(sources).filter(s => s.status === 'error').length;
  const anyLoading   = Object.values(sources).some(s => s.status === 'loading');

  return (
    <div className="fixed inset-0 z-[9999] bg-background flex flex-col overflow-hidden">
      {/* ── Top bar ── */}
      <div className="border-b border-border px-6 py-4 flex items-center justify-between shrink-0 bg-background/95 backdrop-blur">
        <div className="flex items-center gap-3">
          <Database className="w-5 h-5 text-primary" />
          <span className="font-bold text-base tracking-tight">Gestión de Datasets</span>
          <span className="text-xs text-muted-foreground font-mono hidden sm:inline">datos.gov.co · Socrata API</span>
        </div>

        {/* Stats pills */}
        <div className="hidden md:flex items-center gap-2 text-xs">
          <Pill color="text-primary">{loadedCount}/5 fuentes</Pill>
          <Pill color="text-[hsl(145,63%,55%)]">{totalRecords.toLocaleString('es-CO')} registros</Pill>
          {errorCount > 0 && <Pill color="text-destructive">{errorCount} errores</Pill>}
        </div>

        <button type="button" onClick={onClose} title="Cerrar gestión de datasets" className="p-2 rounded-full hover:bg-accent transition">
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* ── Tabs ── */}
      <div className="border-b border-border px-6 shrink-0">
        <div className="flex gap-0">
          {([
            { key: 'sources',  label: 'Fuentes',  Icon: Layers },
            { key: 'pipeline', label: 'Pipeline', Icon: Zap    },
            { key: 'lineage',  label: 'Linaje',   Icon: GitBranch },
          ] as const).map(({ key, label, Icon }) => (
            <button
              type="button"
              key={key}
              onClick={() => setTab(key)}
              className={`flex items-center gap-1.5 px-4 py-3 text-sm font-medium border-b-2 transition ${
                tab === key
                  ? 'border-primary text-primary'
                  : 'border-transparent text-muted-foreground hover:text-foreground'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* ── Tab content ── */}
      <div className="flex-1 overflow-y-auto">
        {tab === 'sources'  && <SourcesTab  sources={sources} loaders={loaders} loadAll={loadAll} anyLoading={anyLoading} expanded={expanded} setExpanded={setExpanded} runPipeline={runPipeline} canRun={canRun} running={running} />}
        {tab === 'pipeline' && <PipelineTab sources={sources} pipeline={pipeline} running={running} canRun={canRun} runPipeline={runPipeline} />}
        {tab === 'lineage'  && <LineageTab  sources={sources} pipelineResult={pipeline.result} />}
      </div>
    </div>
  );
}

// ── SOURCES TAB ───────────────────────────────────────────────────────────────

function SourcesTab({ sources, loaders, loadAll, anyLoading, expanded, setExpanded, runPipeline, canRun, running }: {
  sources: Record<SourceKey, SourceState>;
  loaders: Record<SourceKey, () => Promise<void>>;
  loadAll: () => void;
  anyLoading: boolean;
  expanded: SourceKey | null;
  setExpanded: (k: SourceKey | null) => void;
  runPipeline: () => void;
  canRun: boolean;
  running: boolean;
}) {
  const SOURCE_ORDER: SourceKey[] = ['divipola', 'dane_pob', 'reps', 'ungrd_hist', 'ungrd_recent'];

  return (
    <div className="max-w-5xl mx-auto px-6 py-6 space-y-4">
      {/* Action bar */}
      <div className="flex flex-wrap items-center gap-3 pb-2">
        <button type="button" onClick={() => void loadAll()} disabled={anyLoading}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-secondary hover:bg-accent text-sm font-medium transition disabled:opacity-50">
          <RefreshCw className={`w-3.5 h-3.5 ${anyLoading ? 'animate-spin' : ''}`} />
          Actualizar todos
        </button>
        <button type="button" onClick={runPipeline} disabled={!canRun || running}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-semibold hover:opacity-90 transition disabled:opacity-50">
          {running ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Play className="w-3.5 h-3.5" />}
          {running ? 'Calculando IRCA…' : 'Ejecutar pipeline IRCA'}
        </button>
      </div>

      {/* Dataset cards */}
      {SOURCE_ORDER.map(key => (
        <DatasetCard
          key={key}
          sourceKey={key}
          state={sources[key]}
          onLoad={DATASET_CATALOG[key].isReference ? undefined : () => void loaders[key]()}
          expanded={expanded === key}
          onToggleExpand={() => setExpanded(expanded === key ? null : key)}
        />
      ))}

      {/* Nota metodológica */}
      <div className="flex items-start gap-3 bg-secondary/30 border border-border rounded-xl p-4 text-xs text-muted-foreground">
        <Info className="w-4 h-4 shrink-0 mt-0.5 text-primary" />
        <p className="leading-relaxed">
          <span className="font-semibold text-foreground">Integración garantizada:</span>{' '}
          DIVIPOLA y REPS se unen por nombre de municipio normalizado (sin tildes, minúsculas).
          UNGRD se une por código DIVIPOLA de 5 dígitos (prefijo 27 = Chocó). DANE Población
          es referencia integrada — las proyecciones 2024 están incluidas en el motor de cálculo.
          El pipeline usa los 5 datasets como fuentes y calcula IRCA para los 32 municipios definidos en DIVIPOLA.
        </p>
      </div>
    </div>
  );
}

// ── DATASET CARD ──────────────────────────────────────────────────────────────

function DatasetCard({ sourceKey, state, onLoad, expanded, onToggleExpand }: {
  sourceKey: SourceKey;
  state: SourceState;
  onLoad?: () => void;
  expanded: boolean;
  onToggleExpand: () => void;
}) {
  const cfg     = DATASET_CATALOG[sourceKey];
  const meta    = cfg.meta;
  const quality = useMemo(() => computeQuality(
    state.rows,
    sourceKey === 'reps'
      ? undefined
      : sourceKey.startsWith('ungrd')
        ? r => parseInt(r.divipola ?? '0', 10)
        : undefined,
  ), [state.rows, sourceKey]);

  const StatusDot = () => {
    if (state.status === 'loading') return <Loader2 className="w-4 h-4 animate-spin text-primary" />;
    if (state.status === 'ok')      return <CheckCircle2 className="w-4 h-4 text-[hsl(145,63%,55%)]" />;
    if (state.status === 'error')   return <AlertCircle  className="w-4 h-4 text-destructive" />;
    return <div className="w-4 h-4 rounded-full border-2 border-muted" />;
  };

  const statusText =
    state.status === 'loading' ? 'Descargando desde datos.gov.co…'
    : state.status === 'ok'    ? `${state.rows.length.toLocaleString('es-CO')} registros · ${state.fetchedAt ? elapsedLabel(state.fetchedAt) : 'integrado'}`
    : state.status === 'error' ? state.error
    : 'Sin cargar';

  return (
    <div className="bg-card border border-border rounded-xl overflow-hidden">
      {/* Card header */}
      <div className="p-4 flex items-start gap-3">
        {/* Color accent */}
        <div className="w-1 self-stretch rounded-full shrink-0 [background-color:var(--accent-color)]"
          style={{ '--accent-color': cfg.color } as React.CSSProperties} />

        <StatusDot />

        <div className="flex-1 min-w-0 space-y-2">
          {/* Título + institución + badge */}
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-semibold text-sm">{cfg.name}</span>
            <span className="text-xs text-muted-foreground">· {cfg.institution}</span>
            {cfg.isReference && (
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-primary/15 text-primary border border-primary/25 font-medium">
                integrado
              </span>
            )}
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-secondary text-muted-foreground font-mono">
              {cfg.id}
            </span>
          </div>

          <p className="text-xs text-muted-foreground leading-relaxed">{cfg.description}</p>

          {/* Metadata grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-x-4 gap-y-1.5 pt-0.5">
            <MetaItem icon={<Calendar className="w-3 h-3" />}    label="Actualizado"  value={meta.updatedAt} />
            <MetaItem icon={<RotateCcw className="w-3 h-3" />}   label="Frecuencia"   value={meta.frequency} />
            <MetaItem icon={<Globe className="w-3 h-3" />}       label="Cobertura"    value={meta.coverage} />
            <MetaItem icon={<Scale className="w-3 h-3" />}       label="Licencia"     value={meta.license} />
            {meta.views !== 'N/A' && (
              <MetaItem icon={<Eye className="w-3 h-3" />}        label="Vistas"       value={meta.views} />
            )}
            {meta.downloads !== 'N/A' && (
              <MetaItem icon={<Download className="w-3 h-3" />}   label="Descargas"    value={meta.downloads} />
            )}
            <MetaItem icon={<Database className="w-3 h-3" />}    label="Categoría"    value={meta.category} />
            <MetaItem icon={<TrendingUp className="w-3 h-3" />}  label="Creado"       value={meta.createdAt} />
          </div>

          {/* Tags */}
          <div className="flex flex-wrap gap-1 pt-0.5">
            {meta.tags.map(t => (
              <span key={t} className="text-[10px] px-1.5 py-0.5 rounded bg-secondary text-muted-foreground font-mono">
                {t}
              </span>
            ))}
          </div>

          {/* Status + quality */}
          <div className="flex items-center gap-3 flex-wrap pt-0.5 border-t border-border/50">
            <span className={`text-xs ${
              state.status === 'error' ? 'text-destructive' :
              state.status === 'ok'   ? 'text-[hsl(145,63%,55%)]' :
              'text-muted-foreground'
            }`}>{statusText}</span>

            {state.status === 'ok' && (
              <>
                <span className="text-xs text-muted-foreground">
                  {quality.colCount} cols
                </span>
                <QualityBar value={quality.completeness} />
                {quality.coverage > 0 && (
                  <span className="text-xs text-muted-foreground">
                    {quality.coverage}/32 municipios
                  </span>
                )}
              </>
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="flex flex-col items-end gap-1.5 shrink-0">
          <a href={cfg.url} target="_blank" rel="noopener noreferrer"
            className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent transition"
            title="Ver fuente en datos.gov.co">
            <ExternalLink className="w-3.5 h-3.5" />
          </a>

          {onLoad && (
            <button type="button" onClick={onLoad} disabled={state.status === 'loading'}
              className="text-xs px-3 py-1.5 rounded-lg bg-secondary hover:bg-accent text-secondary-foreground transition disabled:opacity-50 flex items-center gap-1.5">
              <RefreshCw className={`w-3 h-3 ${state.status === 'loading' ? 'animate-spin' : ''}`} />
              {state.status === 'loading' ? 'Cargando…' : state.status === 'ok' ? 'Recargar' : 'Cargar'}
            </button>
          )}

          {state.rows.length > 0 && (
            <button type="button" onClick={onToggleExpand}
              className="text-xs px-3 py-1.5 rounded-lg bg-secondary hover:bg-accent text-secondary-foreground transition flex items-center gap-1.5">
              <Eye className="w-3 h-3" />
              {expanded ? 'Cerrar' : 'Ver datos'}
              {expanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
            </button>
          )}
        </div>
      </div>

      {/* Drill-down table */}
      {expanded && state.rows.length > 0 && (
        <DrilldownTable
          rows={state.rows}
          sourceKey={sourceKey}
          priorityCols={[...cfg.priorityCols]}
        />
      )}
    </div>
  );
}

/** Ítem de metadato con ícono + label + valor */
function MetaItem({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-start gap-1.5">
      <span className="text-muted-foreground mt-0.5 shrink-0">{icon}</span>
      <div className="min-w-0">
        <div className="text-[9px] text-muted-foreground uppercase tracking-wide leading-none">{label}</div>
        <div className="text-[11px] font-medium text-foreground leading-tight truncate" title={value}>{value}</div>
      </div>
    </div>
  );
}

// ── DRILL-DOWN TABLE ──────────────────────────────────────────────────────────

function DrilldownTable({ rows, sourceKey, priorityCols }: {
  rows: Record<string, string>[];
  sourceKey: SourceKey;
  priorityCols: string[];
}) {
  const [search,      setSearch]      = useState('');
  const [sortCol,     setSortCol]     = useState<string>(priorityCols[0] ?? '');
  const [sortAsc,     setSortAsc]     = useState(true);
  const [page,        setPage]        = useState(0);
  const [pageSize,    setPageSize]    = useState(25);
  const [showAllCols, setShowAllCols] = useState(false);

  // Detect all columns, put priority ones first
  const allCols = useMemo(() => {
    if (!rows.length) return [];
    const keys = Object.keys(rows[0]);
    const prio  = priorityCols.filter(c => keys.includes(c));
    const rest  = keys.filter(c => !priorityCols.includes(c));
    return [...prio, ...rest];
  }, [rows, priorityCols]);

  const visibleCols = showAllCols ? allCols : allCols.slice(0, Math.min(allCols.length, 7));

  // Completeness per column
  const colStats = useMemo(() => {
    const stats: Record<string, { filled: number; pct: number }> = {};
    allCols.forEach(col => {
      const filled = rows.filter(r => r[col] !== undefined && r[col] !== null && r[col] !== '').length;
      stats[col] = { filled, pct: Math.round((filled / rows.length) * 100) };
    });
    return stats;
  }, [rows, allCols]);

  // Filter
  const filtered = useMemo(() => {
    if (!search.trim()) return rows;
    const q = search.toLowerCase();
    return rows.filter(r => Object.values(r).some(v => v?.toLowerCase().includes(q)));
  }, [rows, search]);

  // Sort
  const sorted = useMemo(() => {
    if (!sortCol) return filtered;
    return [...filtered].sort((a, b) => {
      const va = a[sortCol] ?? '';
      const vb = b[sortCol] ?? '';
      const na = parseFloat(va);
      const nb = parseFloat(vb);
      const cmp = !isNaN(na) && !isNaN(nb)
        ? na - nb
        : va.localeCompare(vb, 'es');
      return sortAsc ? cmp : -cmp;
    });
  }, [filtered, sortCol, sortAsc]);

  const totalPages = Math.ceil(sorted.length / pageSize);
  const pageRows   = sorted.slice(page * pageSize, (page + 1) * pageSize);

  const toggleSort = (col: string) => {
    if (sortCol === col) setSortAsc(a => !a);
    else { setSortCol(col); setSortAsc(true); }
    setPage(0);
  };

  const exportCsv = () => {
    const cols = allCols;
    const header = cols.join(',');
    const body   = sorted.map(r => cols.map(c => `"${(r[c] ?? '').replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob   = new Blob([header + '\n' + body], { type: 'text/csv;charset=utf-8;' });
    const url    = URL.createObjectURL(blob);
    const a      = document.createElement('a');
    a.href       = url;
    a.download   = `${sourceKey}_choco_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const SortIcon = ({ col }: { col: string }) => {
    if (sortCol !== col) return <ArrowUpDown className="w-3 h-3 opacity-30" />;
    return sortAsc
      ? <ArrowUp   className="w-3 h-3 text-primary" />
      : <ArrowDown className="w-3 h-3 text-primary" />;
  };

  const colType = (col: string): 'num' | 'date' | 'text' => {
    const sample = rows.find(r => r[col])?.[ col] ?? '';
    if (!isNaN(parseFloat(sample)) && sample.trim() !== '') return 'num';
    if (/^\d{4}-\d{2}-\d{2}/.test(sample)) return 'date';
    return 'text';
  };

  return (
    <div className="border-t border-border bg-background/50">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2 px-4 py-3 border-b border-border/50">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
          <input
            value={search}
            onChange={e => { setSearch(e.target.value); setPage(0); }}
            placeholder="Buscar en todas las columnas…"
            className="w-full pl-8 pr-3 py-1.5 text-xs rounded-md border border-border bg-background focus:outline-none focus:ring-1 focus:ring-primary"
          />
        </div>

        <div className="flex items-center gap-2 ml-auto">
          <span className="text-xs text-muted-foreground">
            {filtered.length.toLocaleString('es-CO')} / {rows.length.toLocaleString('es-CO')} filas
          </span>

          <select value={pageSize} onChange={e => { setPageSize(Number(e.target.value)); setPage(0); }}
            title="Filas por página"
            className="text-xs bg-secondary border border-border rounded-md px-2 py-1.5">
            {[25, 50, 100].map(n => <option key={n} value={n}>{n} / pág</option>)}
          </select>

          <button type="button" onClick={() => setShowAllCols(v => !v)}
            className="flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-md bg-secondary hover:bg-accent transition">
            {showAllCols ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
            {showAllCols ? `${allCols.length} cols` : `+${allCols.length - visibleCols.length}`}
          </button>

          <button type="button" onClick={exportCsv}
            className="flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-md bg-secondary hover:bg-accent transition">
            <Download className="w-3 h-3" />
            CSV
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead className="sticky top-0 bg-secondary/80 backdrop-blur">
            <tr>
              <th className="text-right px-2 py-2 text-muted-foreground font-normal w-10">#</th>
              {visibleCols.map(col => (
                <th key={col}
                  className="text-left px-3 py-2 font-medium cursor-pointer hover:bg-accent/50 whitespace-nowrap select-none"
                  onClick={() => toggleSort(col)}
                >
                  <div className="flex items-center gap-1">
                    <span className="text-[9px] opacity-40 font-mono">
                      {colType(col) === 'num' ? '🔢' : colType(col) === 'date' ? '📅' : '📝'}
                    </span>
                    <span>{col}</span>
                    <SortIcon col={col} />
                  </div>
                  {/* Completeness bar */}
                  <div className="h-0.5 mt-1 rounded-full bg-muted overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all [width:var(--col-pct)] ${
                        colStats[col].pct > 90 ? 'bg-[hsl(145,63%,55%)]' :
                        colStats[col].pct > 60 ? 'bg-yellow-400' : 'bg-red-400'
                      }`}
                      style={{ '--col-pct': `${colStats[col].pct}%` } as React.CSSProperties}
                    />
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {pageRows.map((row, i) => (
              <tr key={i} className="border-t border-border/40 hover:bg-accent/20 transition-colors">
                <td className="text-right px-2 py-1.5 text-muted-foreground opacity-40 font-mono">
                  {page * pageSize + i + 1}
                </td>
                {visibleCols.map(col => (
                  <td key={col} className="px-3 py-1.5 max-w-[200px] truncate" title={row[col]}>
                    {row[col] || <span className="opacity-20">—</span>}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      <div className="flex items-center justify-between px-4 py-2.5 border-t border-border/50 text-xs text-muted-foreground">
        <span>
          Mostrando {(page * pageSize + 1).toLocaleString('es-CO')}–
          {Math.min((page + 1) * pageSize, sorted.length).toLocaleString('es-CO')} de{' '}
          {sorted.length.toLocaleString('es-CO')} registros
        </span>
        <div className="flex items-center gap-1">
          <NavBtn disabled={page === 0} onClick={() => setPage(0)}>«</NavBtn>
          <NavBtn disabled={page === 0} onClick={() => setPage(p => p - 1)}>‹</NavBtn>
          {Array.from({ length: Math.min(totalPages, 5) }, (_, j) => {
            const p = Math.max(0, Math.min(page - 2, totalPages - 5)) + j;
            return (
              <NavBtn key={p} active={p === page} onClick={() => setPage(p)}>
                {p + 1}
              </NavBtn>
            );
          })}
          <NavBtn disabled={page >= totalPages - 1} onClick={() => setPage(p => p + 1)}>›</NavBtn>
          <NavBtn disabled={page >= totalPages - 1} onClick={() => setPage(totalPages - 1)}>»</NavBtn>
        </div>
      </div>
    </div>
  );
}

// ── PIPELINE TAB ──────────────────────────────────────────────────────────────

function PipelineTab({ sources, pipeline, running, canRun, runPipeline }: {
  sources:     Record<SourceKey, SourceState>;
  pipeline:    PipelineState;
  running:     boolean;
  canRun:      boolean;
  runPipeline: () => void;
}) {
  const NIVEL_COLOR: Record<string, string> = {
    'Crítico': 'text-red-500', 'Alto': 'text-orange-400',
    'Medio': 'text-yellow-400', 'Bajo': 'text-green-500',
  };

  const flowSteps: { key: SourceKey; label: string; role: string }[] = [
    { key: 'divipola',     label: 'DIVIPOLA',    role: 'llave territorial' },
    { key: 'dane_pob',     label: 'DANE Pob.',   role: 'normalización' },
    { key: 'reps',         label: 'REPS',         role: 'vulnerabilidad sanitaria' },
    { key: 'ungrd_hist',   label: 'UNGRD hist',  role: 'exposición histórica' },
    { key: 'ungrd_recent', label: 'UNGRD 2024',  role: 'severidad vial reciente' },
  ];

  return (
    <div className="max-w-4xl mx-auto px-6 py-6 space-y-8">
      {/* Flow diagram */}
      <section className="space-y-3">
        <SectionLabel>Flujo de integración</SectionLabel>
        <div className="bg-card border border-border rounded-xl p-5 space-y-4">
          {/* Sources row */}
          <div className="grid grid-cols-5 gap-2">
            {flowSteps.map(({ key, label, role }) => {
              const s = sources[key].status;
              return (
                <div key={key} className={`rounded-lg border px-2 py-2 text-center ${
                  s === 'ok'      ? 'border-[hsl(145,63%,55%)]/40 bg-[hsl(145,63%,55%)]/5' :
                  s === 'error'   ? 'border-destructive/40 bg-destructive/5' :
                  s === 'loading' ? 'border-primary/40 bg-primary/5' :
                  'border-border bg-secondary/30'
                }`}>
                  <div className="text-[10px] font-bold">{label}</div>
                  <div className="text-[9px] text-muted-foreground mt-0.5">{role}</div>
                  <div className="mt-1.5 flex justify-center">
                    {s === 'ok'      ? <CheckCircle2 className="w-3.5 h-3.5 text-[hsl(145,63%,55%)]" /> :
                     s === 'error'   ? <AlertCircle  className="w-3.5 h-3.5 text-destructive" /> :
                     s === 'loading' ? <Loader2      className="w-3.5 h-3.5 animate-spin text-primary" /> :
                                       <div className="w-3.5 h-3.5 rounded-full border-2 border-muted" />}
                  </div>
                  <div className="text-[9px] text-muted-foreground mt-0.5">
                    {sources[key].rows.length > 0 ? `${sources[key].rows.length} rows` : '—'}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Arrow */}
          <div className="text-center text-muted-foreground text-xl">▼</div>

          {/* ETL box */}
          <div className="bg-[hsl(270,30%,14%)] border border-[hsl(270,30%,28%)] rounded-lg px-4 py-3 text-center">
            <div className="text-xs font-bold text-[hsl(270,60%,72%)]">ETL + Pipeline IRCA · TypeScript</div>
            <div className="text-[10px] text-muted-foreground mt-0.5">
              Join territorial · percentiles uniformes · IRCA = (vuln + expo + sev) / 3
            </div>
          </div>

          <div className="text-center text-muted-foreground text-xl">▼</div>

          {/* Output */}
          <div className="bg-primary/10 border border-primary/30 rounded-lg px-4 py-3 text-center">
            <div className="text-xs font-bold text-primary">municipios_riesgo · Dashboard actualizado</div>
            <div className="text-[10px] text-muted-foreground mt-0.5">
              {pipeline.runAt
                ? `Último run: ${pipeline.runAt.toLocaleString('es-CO')}`
                : '32 municipios · Bajo / Medio / Alto / Crítico'}
            </div>
          </div>
        </div>
      </section>

      {/* Controls */}
      <section className="flex flex-wrap gap-3 items-center">
        <button type="button" onClick={runPipeline} disabled={!canRun || running}
          className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-primary text-primary-foreground text-sm font-semibold hover:opacity-90 transition disabled:opacity-50">
          {running ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
          {running ? 'Calculando…' : 'Ejecutar pipeline IRCA'}
        </button>
        {!canRun && <p className="text-xs text-muted-foreground">Carga REPS y al menos un dataset UNGRD para ejecutar.</p>}
      </section>

      {/* Stats */}
      {pipeline.stats && (
        <section className="space-y-3">
          <SectionLabel>Distribución de riesgo — último run</SectionLabel>
          <div className="grid grid-cols-4 gap-3">
            {(['Crítico', 'Alto', 'Medio', 'Bajo'] as const).map(n => (
              <div key={n} className="bg-card border border-border rounded-xl px-4 py-4 text-center">
                <div className={`text-3xl font-extrabold ${NIVEL_COLOR[n]}`}>
                  {pipeline.stats?.[n] ?? 0}
                </div>
                <div className="text-xs text-muted-foreground mt-1">{n}</div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Log */}
      {pipeline.logs.length > 0 && (
        <section className="space-y-2">
          <SectionLabel>Log de ejecución</SectionLabel>
          <div className="bg-[hsl(220,13%,5%)] border border-border rounded-xl p-4 font-mono text-xs space-y-0.5 max-h-80 overflow-y-auto">
            {pipeline.logs.map((l, i) => (
              <div key={i} className={
                l.level === 'error' ? 'text-red-400' :
                l.level === 'warn'  ? 'text-yellow-400' :
                'text-green-300'
              }>
                <span className="opacity-40">[{l.ts}]</span>{' '}
                <span className="font-bold">{l.level.toUpperCase().padEnd(5)}</span>{' '}
                {l.msg}
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

// ── LINEAGE TAB ───────────────────────────────────────────────────────────────

type LinSubTab = 'dag' | 'schema' | 'joins' | 'coverage' | 'stats';

const OUTPUT_SCHEMA = [
  { field: 'cod_municipio',          type: 'int',     layer: 'id',       formula: 'Referencia DIVIPOLA 5 dígitos',                              sources: ['DIVIPOLA gdxc-w37w'],                   domain: '27001–27810',  nullable: false },
  { field: 'municipio',              type: 'string',  layer: 'id',       formula: 'Nombre oficial del municipio',                               sources: ['DANE DIVIPOLA'],                        domain: 'texto libre',  nullable: false },
  { field: 'depto',                  type: 'string',  layer: 'id',       formula: 'Constante "Chocó"',                                          sources: ['referencia'],                           domain: '"Chocó"',      nullable: false },
  { field: 'poblacion',              type: 'int',     layer: 'raw',      formula: 'Proyección 2024 (DANE Censo 2018)',                           sources: ['DANE proyecciones'],                    domain: '3 200–122 000',nullable: false },
  { field: 'poblacion_imputada',     type: 'bool',    layer: 'flag',     formula: 'True si poblacion == mediana departamental',                 sources: ['derivado'],                             domain: 'true|false',   nullable: false },
  { field: 'camas_totales',          type: 'float',   layer: 'raw',      formula: 'SUM(num_cantidad_capacidad_instalada) WHERE CAMAS',           sources: ['REPS s2ru-bqt6'],                       domain: '≥ 0',          nullable: false },
  { field: 'camas_por_1000_hab',     type: 'float',   layer: 'metric',   formula: 'camas_totales / (poblacion / 1000)',                         sources: ['REPS', 'DANE pob'],                     domain: '≥ 0',          nullable: false },
  { field: 'total_eventos',          type: 'int',     layer: 'raw',      formula: 'COUNT(*) WHERE divipola = municipio',                         sources: ['UNGRD wwkg-r6te', 'UNGRD rgre-6ak4'],   domain: '≥ 0',          nullable: false },
  { field: 'severidad_vial',         type: 'float',   layer: 'metric',   formula: '(vias_averiadas + puentes_v + puentes_p) / total_eventos',   sources: ['UNGRD wwkg-r6te', 'UNGRD rgre-6ak4'],   domain: '≥ 0',          nullable: false },
  { field: 'expuestos',              type: 'bool',    layer: 'flag',     formula: 'total_eventos > 0',                                          sources: ['derivado'],                             domain: 'true|false',   nullable: false },
  { field: 'sin_eventos_reportados', type: 'bool',    layer: 'flag',     formula: 'total_eventos == 0  (subregistro potencial)',                 sources: ['derivado'],                             domain: 'true|false',   nullable: false },
  { field: 'pctl_vuln_salud',        type: 'float',   layer: 'pctil',    formula: '1 − QuantileTransformer(camas_por_1000_hab)',                 sources: ['derivado'],                             domain: '[0, 1]',       nullable: false },
  { field: 'pctl_exposicion',        type: 'float',   layer: 'pctil',    formula: 'QuantileTransformer(total_eventos)',                          sources: ['derivado'],                             domain: '[0, 1]',       nullable: false },
  { field: 'pctl_severidad',         type: 'float',   layer: 'pctil',    formula: 'QuantileTransformer(severidad_vial)',                         sources: ['derivado'],                             domain: '[0, 1]',       nullable: false },
  { field: 'iraa_score',             type: 'float',   layer: 'score',    formula: '(pctl_vuln + pctl_expo + pctl_sev) / 3',                     sources: ['derivado'],                             domain: '[0, 1]',       nullable: false },
  { field: 'nivel_riesgo',           type: 'enum',    layer: 'output',   formula: 'cut(iraa_score, [0,.25,.5,.75,1])',                          sources: ['derivado'],                             domain: 'Bajo|Medio|Alto|Crítico', nullable: false },
  { field: 'estado_confianza',       type: 'string',  layer: 'output',   formula: '"Baja" if sin_eventos else "Alta"',                          sources: ['derivado'],                             domain: 'texto',        nullable: false },
  { field: 'recomendacion',          type: 'string',  layer: 'output',   formula: 'lookup(nivel_riesgo) — texto operativo',                    sources: ['derivado'],                             domain: 'texto',        nullable: false },
] as const;

const LAYER_COLOR: Record<string, string> = {
  id:     'bg-blue-500/15 text-blue-400 border-blue-500/25',
  raw:    'bg-emerald-500/15 text-emerald-400 border-emerald-500/25',
  metric: 'bg-amber-500/15 text-amber-400 border-amber-500/25',
  flag:   'bg-zinc-500/15 text-zinc-400 border-zinc-500/25',
  pctil:  'bg-violet-500/15 text-violet-400 border-violet-500/25',
  score:  'bg-primary/15 text-primary border-primary/25',
  output: 'bg-rose-500/15 text-rose-400 border-rose-500/25',
};

function LineageTab({ sources, pipelineResult }: {
  sources:        Record<SourceKey, SourceState>;
  pipelineResult: Municipio[] | null;
}) {
  const [sub, setSub] = useState<LinSubTab>('dag');

  // ── Shared computations ──────────────────────────────────────────────────
  const norm = (s: string) =>
    s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();

  const ungrdByCode = useMemo(() => {
    const map: Record<number, number> = {};
    [...sources.ungrd_hist.rows, ...sources.ungrd_recent.rows].forEach(r => {
      const cod = parseInt(r.divipola ?? r.cod_divipola ?? '0', 10);
      if (cod) map[cod] = (map[cod] ?? 0) + 1;
    });
    return map;
  }, [sources]);

  const repsByCode = useMemo(() => {
    const ntc = Object.fromEntries(MUN_CHOCO.map(m => [m.nameNorm, m.cod]));
    const map: Record<number, number> = {};
    sources.reps.rows.forEach(r => {
      const key = norm(r.municipio ?? r.municipiosededesc ?? '');
      const cod = ntc[key];
      if (cod) map[cod] = (map[cod] ?? 0) + (parseFloat(r.num_cantidad_capacidad_instalada ?? '0') || 0);
    });
    return map;
  }, [sources]);

  const divipolaCodes = useMemo(() =>
    new Set(sources.divipola.rows.map(r => parseInt(r.cod_municipio ?? '0', 10)).filter(Boolean))
  , [sources]);

  // ── Sub-tab nav ──────────────────────────────────────────────────────────
  const SUBS: { key: LinSubTab; label: string }[] = [
    { key: 'dag',      label: 'DAG ETL' },
    { key: 'schema',   label: 'Diccionario' },
    { key: 'joins',    label: 'Calidad de Joins' },
    { key: 'coverage', label: 'Cobertura' },
    { key: 'stats',    label: `Distribuciones${pipelineResult ? '' : ' 🔒'}` },
  ];

  return (
    <div className="max-w-6xl mx-auto px-6 py-6 space-y-5">
      {/* Sub-tab nav */}
      <div className="flex gap-1 p-1 bg-secondary/50 rounded-lg w-fit">
        {SUBS.map(s => (
          <button type="button" key={s.key} onClick={() => setSub(s.key)}
            className={`px-3 py-1.5 rounded-md text-xs font-medium transition ${
              sub === s.key
                ? 'bg-background text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            }`}>
            {s.label}
          </button>
        ))}
      </div>

      {sub === 'dag'      && <DagView sources={sources} />}
      {sub === 'schema'   && <SchemaView />}
      {sub === 'joins'    && <JoinsView sources={sources} ungrdByCode={ungrdByCode} repsByCode={repsByCode} divipolaCodes={divipolaCodes} />}
      {sub === 'coverage' && <CoverageView sources={sources} ungrdByCode={ungrdByCode} repsByCode={repsByCode} divipolaCodes={divipolaCodes} pipelineResult={pipelineResult} />}
      {sub === 'stats'    && <StatsView pipelineResult={pipelineResult} />}
    </div>
  );
}

// ── DAG VIEW ──────────────────────────────────────────────────────────────────

function DagView({ sources }: { sources: Record<SourceKey, SourceState> }) {
  const sColor = (key: SourceKey) => {
    const s = sources[key].status;
    if (s === 'ok')      return 'border-[hsl(145,63%,55%)]/60 bg-[hsl(145,63%,55%)]/8 text-[hsl(145,63%,55%)]';
    if (s === 'loading') return 'border-primary/60 bg-primary/8 text-primary animate-pulse';
    if (s === 'error')   return 'border-destructive/60 bg-destructive/8 text-destructive';
    return 'border-border bg-secondary/30 text-muted-foreground';
  };

  const srcNodes: { key: SourceKey; shortName: string; role: string }[] = [
    { key: 'divipola',     shortName: 'DIVIPOLA',   role: 'llave territorial' },
    { key: 'dane_pob',     shortName: 'DANE Pob.',  role: 'proyecciones 2024' },
    { key: 'reps',         shortName: 'REPS',        role: 'camas habilitadas' },
    { key: 'ungrd_hist',   shortName: 'UNGRD hist', role: 'eventos 2019–2022' },
    { key: 'ungrd_recent', shortName: 'UNGRD 2024', role: 'eventos 2023–2024' },
  ];

  const DagBox = ({ children, accent = false }: { children: React.ReactNode; accent?: boolean }) => (
    <div className={`rounded-xl border px-4 py-3 text-center text-xs ${
      accent
        ? 'border-primary/40 bg-primary/10 text-primary font-semibold'
        : 'border-border bg-card'
    }`}>
      {children}
    </div>
  );

  const Arrow = () => (
    <div className="flex justify-center my-1 text-muted-foreground text-lg select-none">▼</div>
  );

  return (
    <div className="space-y-1">
      <SectionLabel>Flujo de transformación — de fuente a IRCA</SectionLabel>

      {/* Source nodes */}
      <div className="grid grid-cols-5 gap-2">
        {srcNodes.map(({ key, shortName, role }) => (
          <div key={key} className={`rounded-xl border px-3 py-3 text-center transition ${sColor(key)}`}>
            <div className="text-[11px] font-bold">{shortName}</div>
            <div className="text-[9px] opacity-70 mt-0.5">{role}</div>
            <div className="text-[9px] font-mono opacity-50 mt-0.5">{DATASET_CATALOG[key].id}</div>
            <div className="text-[9px] mt-1 font-medium">
              {sources[key].status === 'ok'
                ? `${sources[key].rows.length.toLocaleString('es-CO')} filas`
                : sources[key].status === 'loading' ? '↻ cargando'
                : sources[key].status === 'error' ? '✕ error'
                : '—'}
            </div>
          </div>
        ))}
      </div>

      <Arrow />

      {/* Join layer */}
      <DagBox>
        <div className="text-xs font-bold text-foreground mb-2">Integración territorial</div>
        <div className="grid grid-cols-3 gap-2 text-[10px] text-muted-foreground">
          <div className="bg-secondary/60 rounded-lg p-2">
            <div className="font-semibold text-foreground">Join REPS</div>
            <div>nombre municipio normalizado</div>
            <div className="font-mono opacity-60">LEFT JOIN · 32 muns</div>
          </div>
          <div className="bg-secondary/60 rounded-lg p-2">
            <div className="font-semibold text-foreground">Join UNGRD</div>
            <div>DIVIPOLA 5 dígitos</div>
            <div className="font-mono opacity-60">GROUP BY · cod 27xxx</div>
          </div>
          <div className="bg-secondary/60 rounded-lg p-2">
            <div className="font-semibold text-foreground">Ref. DANE pob.</div>
            <div>32 valores fijos 2024</div>
            <div className="font-mono opacity-60">lookup · cod_municipio</div>
          </div>
        </div>
      </DagBox>

      <Arrow />

      {/* Metrics layer */}
      <DagBox>
        <div className="text-xs font-bold text-foreground mb-2">Métricas brutas (por municipio)</div>
        <div className="grid grid-cols-3 gap-2 text-[10px]">
          {[
            { field: 'camas_por_1000_hab',  formula: 'SUM(camas) / (pob / 1000)',             color: 'text-emerald-400' },
            { field: 'total_eventos',        formula: 'COUNT(filas UNGRD)',                     color: 'text-amber-400' },
            { field: 'severidad_vial',       formula: '(vias + puentes) / total_eventos',       color: 'text-amber-400' },
          ].map(({ field, formula, color }) => (
            <div key={field} className="bg-secondary/60 rounded-lg p-2 text-left">
              <div className={`font-mono font-semibold ${color}`}>{field}</div>
              <div className="text-muted-foreground mt-0.5">{formula}</div>
            </div>
          ))}
        </div>
      </DagBox>

      <Arrow />

      {/* Percentile layer */}
      <DagBox>
        <div className="text-xs font-bold text-foreground mb-1">QuantileTransformer · distribución uniforme (sklearn-compatible)</div>
        <div className="text-[9px] text-muted-foreground mb-2">rank(x, n) = #{`{y : y < x}`} / (n − 1) · resultado en [0, 1]</div>
        <div className="grid grid-cols-3 gap-2 text-[10px]">
          {[
            { field: 'pctl_vuln_salud',  formula: '1 − rank(camas_por_1000_hab)', color: 'text-violet-400' },
            { field: 'pctl_exposicion',  formula: 'rank(total_eventos)',           color: 'text-violet-400' },
            { field: 'pctl_severidad',   formula: 'rank(severidad_vial)',          color: 'text-violet-400' },
          ].map(({ field, formula, color }) => (
            <div key={field} className="bg-secondary/60 rounded-lg p-2 text-left">
              <div className={`font-mono font-semibold ${color}`}>{field}</div>
              <div className="text-muted-foreground mt-0.5">{formula}</div>
            </div>
          ))}
        </div>
      </DagBox>

      <Arrow />

      {/* IRCA */}
      <DagBox accent>
        <div className="text-sm font-extrabold">IRCA = (pctl_vuln + pctl_expo + pctl_sev) / 3</div>
        <div className="text-[10px] font-normal text-primary/80 mt-1">Índice de Riesgo de Continuidad Asistencial · [0, 1] · peso 1/3 por componente</div>
      </DagBox>

      <Arrow />

      {/* Output */}
      <div className="grid grid-cols-4 gap-2">
        {(['Bajo','Medio','Alto','Crítico'] as const).map((n, i) => {
          const thresholds = ['[0.00, 0.25)', '[0.25, 0.50)', '[0.50, 0.75)', '[0.75, 1.00]'];
          const colors     = ['text-green-500','text-yellow-400','text-orange-400','text-red-500'];
          return (
            <div key={n} className={`rounded-xl border border-border bg-card px-3 py-2 text-center`}>
              <div className={`text-sm font-bold ${colors[i]}`}>{n}</div>
              <div className="text-[10px] font-mono text-muted-foreground mt-0.5">{thresholds[i]}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── SCHEMA VIEW ───────────────────────────────────────────────────────────────

function SchemaView() {
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<string>('all');

  const layers = ['all', 'id', 'raw', 'metric', 'flag', 'pctil', 'score', 'output'];
  const LAYER_LABEL: Record<string, string> = {
    all: 'Todos', id: 'Identificador', raw: 'Dato crudo', metric: 'Métrica',
    flag: 'Bandera', pctil: 'Percentil', score: 'Score', output: 'Salida',
  };

  const visible = OUTPUT_SCHEMA.filter(f => {
    const matchSearch = !search || f.field.includes(search) || f.formula.toLowerCase().includes(search.toLowerCase());
    const matchFilter = filter === 'all' || f.layer === filter;
    return matchSearch && matchFilter;
  });

  return (
    <div className="space-y-3">
      <SectionLabel>Diccionario de campos — salida del pipeline (18 campos)</SectionLabel>

      {/* Toolbar */}
      <div className="flex flex-wrap gap-2 items-center">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Buscar campo o fórmula…"
            className="w-full pl-8 pr-3 py-1.5 text-xs rounded-md border border-border bg-background focus:outline-none focus:ring-1 focus:ring-primary" />
        </div>
        <div className="flex gap-1 flex-wrap">
          {layers.map(l => (
            <button type="button" key={l} onClick={() => setFilter(l)}
              className={`text-[10px] px-2.5 py-1 rounded-full border transition font-medium ${
                filter === l ? 'bg-primary text-primary-foreground border-primary' : 'bg-secondary border-border text-muted-foreground hover:text-foreground'
              }`}>
              {LAYER_LABEL[l]}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <table className="w-full text-xs">
          <thead className="bg-secondary/50 sticky top-0">
            <tr>
              <th className="text-left px-3 py-2.5 font-semibold text-muted-foreground">Campo</th>
              <th className="text-left px-3 py-2.5 font-semibold text-muted-foreground">Tipo</th>
              <th className="text-left px-3 py-2.5 font-semibold text-muted-foreground">Capa</th>
              <th className="text-left px-3 py-2.5 font-semibold text-muted-foreground">Fórmula / Derivación</th>
              <th className="text-left px-3 py-2.5 font-semibold text-muted-foreground">Fuentes</th>
              <th className="text-left px-3 py-2.5 font-semibold text-muted-foreground">Dominio</th>
            </tr>
          </thead>
          <tbody>
            {visible.map(f => (
              <tr key={f.field} className="border-t border-border hover:bg-accent/20 transition-colors">
                <td className="px-3 py-2 font-mono font-semibold text-foreground">{f.field}</td>
                <td className="px-3 py-2 font-mono text-muted-foreground">{f.type}</td>
                <td className="px-3 py-2">
                  <span className={`text-[10px] px-1.5 py-0.5 rounded border font-medium ${LAYER_COLOR[f.layer]}`}>
                    {f.layer}
                  </span>
                </td>
                <td className="px-3 py-2 font-mono text-muted-foreground max-w-[260px]">{f.formula}</td>
                <td className="px-3 py-2">
                  {f.sources.map(s => (
                    <div key={s} className="text-[10px] text-muted-foreground">{s}</div>
                  ))}
                </td>
                <td className="px-3 py-2 font-mono text-muted-foreground text-[10px]">{f.domain}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {visible.length === 0 && (
          <div className="px-4 py-6 text-center text-sm text-muted-foreground">Sin resultados para "{search}"</div>
        )}
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-2">
        {Object.entries(LAYER_COLOR).map(([layer, cls]) => (
          <span key={layer} className={`text-[10px] px-2 py-0.5 rounded border font-medium ${cls}`}>
            {LAYER_LABEL[layer] ?? layer}
          </span>
        ))}
      </div>
    </div>
  );
}

// ── JOINS VIEW ────────────────────────────────────────────────────────────────

function JoinsView({ sources, ungrdByCode, repsByCode, divipolaCodes }: {
  sources:        Record<SourceKey, SourceState>;
  ungrdByCode:    Record<number, number>;
  repsByCode:     Record<number, number>;
  divipolaCodes:  Set<number>;
}) {
  // REPS unmatched names
  const repsUnmatched = useMemo(() => {
    const known = new Set(MUN_CHOCO.map(m => m.nameNorm));
    const norm = (s: string) => s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
    const uniq = new Set<string>();
    sources.reps.rows.forEach(r => {
      const n = norm(r.municipio ?? r.municipiosededesc ?? '');
      if (n && !known.has(n)) uniq.add(n);
    });
    return [...uniq].sort().slice(0, 30);
  }, [sources.reps.rows]);

  const repsMatched  = MUN_CHOCO.filter(m => repsByCode[m.cod] !== undefined).length;
  const ungrdMatched = MUN_CHOCO.filter(m => ungrdByCode[m.cod] !== undefined).length;
  const divMatched   = sources.divipola.rows.length > 0 ? MUN_CHOCO.filter(m => divipolaCodes.has(m.cod)).length : 32;

  const JoinCard = ({ title, keyDesc, matched, total, source, loaded, unmatched }: {
    title: string; keyDesc: string; matched: number; total: number;
    source: string; loaded: boolean; unmatched?: string[];
  }) => {
    const pct = total > 0 ? Math.round((matched / total) * 100) : 0;
    const color = pct === 100 ? 'bg-[hsl(145,63%,55%)]' : pct >= 75 ? 'bg-yellow-400' : 'bg-red-400';

    return (
      <div className="bg-card border border-border rounded-xl p-4 space-y-3">
        <div className="flex items-start justify-between gap-2">
          <div>
            <div className="font-semibold text-sm">{title}</div>
            <div className="text-xs text-muted-foreground mt-0.5">Clave: <span className="font-mono">{keyDesc}</span></div>
            <div className="text-[10px] text-muted-foreground">Fuente: {source}</div>
          </div>
          <div className="text-right shrink-0">
            <div className={`text-2xl font-extrabold ${pct === 100 ? 'text-[hsl(145,63%,55%)]' : pct >= 75 ? 'text-yellow-400' : 'text-red-400'}`}>
              {pct}%
            </div>
            <div className="text-xs text-muted-foreground">{matched}/{total} municipios</div>
          </div>
        </div>

        {/* Match rate bar */}
        <div className="h-2 rounded-full bg-secondary overflow-hidden">
          <div className={`h-full rounded-full transition-all [width:var(--match-w)] ${color}`}
            style={{ '--match-w': `${pct}%` } as React.CSSProperties} />
        </div>

        {!loaded && (
          <p className="text-xs text-muted-foreground italic">Fuente no cargada — porcentaje no disponible.</p>
        )}

        {loaded && matched < total && (
          <div className="space-y-1">
            <div className="text-xs font-semibold text-destructive">
              {total - matched} municipios sin match en esta fuente:
            </div>
            <div className="flex flex-wrap gap-1">
              {MUN_CHOCO.filter(m =>
                title.includes('REPS') ? repsByCode[m.cod] === undefined : ungrdByCode[m.cod] === undefined
              ).map(m => (
                <span key={m.cod} className="text-[10px] px-1.5 py-0.5 rounded bg-destructive/10 text-destructive border border-destructive/20">
                  {m.name}
                </span>
              ))}
            </div>
          </div>
        )}

        {unmatched && unmatched.length > 0 && (
          <details className="mt-1">
            <summary className="text-xs cursor-pointer text-muted-foreground hover:text-foreground">
              {unmatched.length} nombres en la fuente sin match en DIVIPOLA (posible encoding diferente)
            </summary>
            <div className="mt-2 flex flex-wrap gap-1 max-h-28 overflow-y-auto">
              {unmatched.map(n => (
                <span key={n} className="text-[10px] px-1.5 py-0.5 rounded bg-secondary font-mono text-muted-foreground">
                  {n}
                </span>
              ))}
            </div>
          </details>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-4">
      <SectionLabel>Análisis de calidad de joins — matching entre fuentes y los 32 municipios</SectionLabel>

      {/* Join methodology */}
      <div className="flex items-start gap-3 bg-secondary/30 border border-border rounded-xl p-3 text-xs text-muted-foreground">
        <Info className="w-4 h-4 shrink-0 mt-0.5 text-primary" />
        <p>
          <span className="font-semibold text-foreground">Metodología de join:</span>{' '}
          REPS se une por nombre de municipio normalizado (minúsculas + NFD + sin tildes).
          UNGRD se une por código DIVIPOLA de 5 dígitos (prefijo 27 = Chocó).
          Un match rate {'<'} 100% indica municipios de Chocó sin registros en esa fuente o diferencia en la clave de unión.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <JoinCard
          title="DIVIPOLA × Referencia"
          keyDesc="cod_municipio (5 dígitos)"
          matched={divMatched}
          total={32}
          source="gdxc-w37w · DANE"
          loaded={sources.divipola.status === 'ok'}
        />
        <JoinCard
          title="REPS × municipio"
          keyDesc="nom. normalizado"
          matched={repsMatched}
          total={32}
          source="s2ru-bqt6 · MinSalud"
          loaded={sources.reps.status === 'ok'}
          unmatched={repsUnmatched}
        />
        <JoinCard
          title="UNGRD × DIVIPOLA"
          keyDesc="divipola (5 dígitos)"
          matched={ungrdMatched}
          total={32}
          source="wwkg-r6te + rgre-6ak4"
          loaded={sources.ungrd_hist.status === 'ok' || sources.ungrd_recent.status === 'ok'}
        />
      </div>

      {/* Estadísticas de camas y eventos por municipio */}
      {(sources.reps.status === 'ok' || sources.ungrd_hist.status === 'ok' || sources.ungrd_recent.status === 'ok') && (
        <div className="space-y-2">
          <SectionLabel>Detalle de valores joined por municipio</SectionLabel>
          <div className="bg-card border border-border rounded-xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead className="bg-secondary/50 sticky top-0">
                  <tr>
                    <th className="text-left px-3 py-2 font-semibold text-muted-foreground">Municipio</th>
                    <th className="text-left px-3 py-2 font-semibold text-muted-foreground">DIVIPOLA</th>
                    <th className="text-right px-3 py-2 font-semibold text-muted-foreground">Camas (REPS)</th>
                    <th className="text-right px-3 py-2 font-semibold text-muted-foreground">Eventos (UNGRD)</th>
                    <th className="text-left px-3 py-2 font-semibold text-muted-foreground">Estado join</th>
                  </tr>
                </thead>
                <tbody>
                  {MUN_CHOCO.map(m => {
                    const camas  = repsByCode[m.cod];
                    const eventos = ungrdByCode[m.cod];
                    const hasReps  = camas !== undefined;
                    const hasUngrd = eventos !== undefined;
                    const bothOk   = hasReps && hasUngrd;
                    const noneOk   = !hasReps && !hasUngrd;
                    return (
                      <tr key={m.cod} className={`border-t border-border hover:bg-accent/20 ${noneOk ? 'bg-destructive/5' : ''}`}>
                        <td className="px-3 py-1.5 font-medium">{m.name}</td>
                        <td className="px-3 py-1.5 font-mono text-muted-foreground">{m.cod}</td>
                        <td className={`px-3 py-1.5 text-right font-mono ${hasReps ? 'text-emerald-400' : 'text-destructive/60'}`}>
                          {hasReps ? camas!.toFixed(0) : '—'}
                        </td>
                        <td className={`px-3 py-1.5 text-right font-mono ${hasUngrd ? 'text-amber-400' : 'text-muted-foreground/40'}`}>
                          {hasUngrd ? eventos : '—'}
                        </td>
                        <td className="px-3 py-1.5">
                          <span className={`text-[10px] px-1.5 py-0.5 rounded border font-medium ${
                            bothOk  ? 'bg-[hsl(145,63%,55%)]/10 text-[hsl(145,63%,55%)] border-[hsl(145,63%,55%)]/20'
                            : noneOk ? 'bg-destructive/10 text-destructive border-destructive/20'
                            : 'bg-yellow-400/10 text-yellow-400 border-yellow-400/20'
                          }`}>
                            {bothOk ? 'completo' : noneOk ? 'sin datos' : 'parcial'}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── COVERAGE VIEW ─────────────────────────────────────────────────────────────

function CoverageView({ sources, ungrdByCode, repsByCode, divipolaCodes, pipelineResult }: {
  sources:        Record<SourceKey, SourceState>;
  ungrdByCode:    Record<number, number>;
  repsByCode:     Record<number, number>;
  divipolaCodes:  Set<number>;
  pipelineResult: Municipio[] | null;
}) {
  const [sortBy, setSortBy] = useState<'name' | 'irca' | 'coverage'>('coverage');

  const ircaByCode = useMemo(() => {
    if (!pipelineResult) return {} as Record<number, number>;
    return Object.fromEntries(pipelineResult.map(m => [m.cod_municipio, m.iraa_score]));
  }, [pipelineResult]);

  const rows = useMemo(() => {
    return MUN_CHOCO.map(m => {
      const inDiv   = sources.divipola.status !== 'ok' || divipolaCodes.has(m.cod);
      const inDane  = true;
      const inReps  = sources.reps.status !== 'ok' || repsByCode[m.cod] !== undefined;
      const inUngrd = (sources.ungrd_hist.status !== 'ok' && sources.ungrd_recent.status !== 'ok') || ungrdByCode[m.cod] !== undefined;
      const cov     = [inDiv, inDane, inReps, inUngrd].filter(Boolean).length;
      const irca    = ircaByCode[m.cod] ?? null;
      return { m, inDiv, inDane, inReps, inUngrd, cov, irca,
        camas:   repsByCode[m.cod]  ?? 0,
        eventos: ungrdByCode[m.cod] ?? 0,
      };
    }).sort((a, b) => {
      if (sortBy === 'name')     return a.m.name.localeCompare(b.m.name, 'es');
      if (sortBy === 'irca')     return (b.irca ?? -1) - (a.irca ?? -1);
      return b.cov - a.cov || a.m.name.localeCompare(b.m.name, 'es');
    });
  }, [sources, ungrdByCode, repsByCode, divipolaCodes, ircaByCode, sortBy]);

  const totalCov = rows.filter(r => r.cov === 4).length;
  const IRCA_COLOR = (v: number | null) => {
    if (v === null) return '';
    if (v >= 0.75) return 'text-red-500';
    if (v >= 0.50) return 'text-orange-400';
    if (v >= 0.25) return 'text-yellow-400';
    return 'text-green-500';
  };

  return (
    <div className="space-y-3">
      <SectionLabel>Cobertura territorial — 32 municipios × 5 fuentes</SectionLabel>

      {/* Summary badges */}
      <div className="flex flex-wrap gap-3">
        <div className="bg-card border border-border rounded-lg px-3 py-2 text-xs">
          <div className="text-muted-foreground">Cobertura completa</div>
          <div className="text-lg font-bold text-foreground">{totalCov}<span className="text-muted-foreground text-xs font-normal">/32</span></div>
        </div>
        {(['reps','ungrd_hist','ungrd_recent'] as SourceKey[]).map(k => {
          const cnt = sources[k].rows.length;
          return (
            <div key={k} className="bg-card border border-border rounded-lg px-3 py-2 text-xs">
              <div className="text-muted-foreground">{DATASET_CATALOG[k].name.split('–')[0].trim()}</div>
              <div className="text-lg font-bold text-foreground">{cnt.toLocaleString('es-CO')}<span className="text-muted-foreground text-xs font-normal"> filas</span></div>
            </div>
          );
        })}
      </div>

      {/* Sort controls */}
      <div className="flex gap-2 items-center text-xs">
        <span className="text-muted-foreground">Ordenar:</span>
        {(['coverage','name','irca'] as const).map(s => (
          <button type="button" key={s} onClick={() => setSortBy(s)}
            className={`px-2.5 py-1 rounded-full border transition text-xs font-medium ${
              sortBy === s ? 'bg-primary text-primary-foreground border-primary' : 'bg-secondary border-border text-muted-foreground hover:text-foreground'
            }`}>
            {s === 'coverage' ? 'Cobertura' : s === 'name' ? 'Nombre' : 'IRCA ↓'}
          </button>
        ))}
      </div>

      {/* Matrix */}
      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="bg-secondary/50 sticky top-0">
              <tr>
                <th className="text-left px-3 py-2.5 font-semibold text-muted-foreground">Municipio</th>
                <th className="text-center px-2 py-2.5 font-semibold text-muted-foreground" title="DIVIPOLA">DIV</th>
                <th className="text-center px-2 py-2.5 font-semibold text-muted-foreground" title="DANE Pob">POB</th>
                <th className="text-center px-2 py-2.5 font-semibold text-muted-foreground" title="REPS Camas">REPS</th>
                <th className="text-center px-2 py-2.5 font-semibold text-muted-foreground" title="UNGRD Emergencias">UNGRD</th>
                <th className="text-right px-3 py-2.5 font-semibold text-muted-foreground">Camas</th>
                <th className="text-right px-3 py-2.5 font-semibold text-muted-foreground">Eventos</th>
                {pipelineResult && <th className="text-right px-3 py-2.5 font-semibold text-muted-foreground">IRCA</th>}
                <th className="text-center px-3 py-2.5 font-semibold text-muted-foreground">Cob.</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(({ m, inDiv, inDane, inReps, inUngrd, cov, irca, camas, eventos }) => (
                <tr key={m.cod} className={`border-t border-border hover:bg-accent/20 ${cov < 2 ? 'bg-destructive/5' : ''}`}>
                  <td className="px-3 py-1.5 font-medium">{m.name}</td>
                  {[inDiv, inDane, inReps, inUngrd].map((ok, i) => (
                    <td key={i} className="text-center px-2 py-1.5">
                      <span className={ok ? 'text-[hsl(145,63%,55%)]' : 'text-destructive/40'}>
                        {ok ? '✓' : '✕'}
                      </span>
                    </td>
                  ))}
                  <td className={`px-3 py-1.5 text-right font-mono ${camas > 0 ? 'text-emerald-400' : 'text-muted-foreground/30'}`}>
                    {camas > 0 ? camas.toFixed(0) : '—'}
                  </td>
                  <td className={`px-3 py-1.5 text-right font-mono ${eventos > 0 ? 'text-amber-400' : 'text-muted-foreground/30'}`}>
                    {eventos > 0 ? eventos : '—'}
                  </td>
                  {pipelineResult && (
                    <td className={`px-3 py-1.5 text-right font-mono font-semibold ${IRCA_COLOR(irca)}`}>
                      {irca !== null ? (irca * 100).toFixed(1) : '—'}
                    </td>
                  )}
                  <td className="px-3 py-1.5 text-center">
                    <div className="flex justify-center gap-0.5">
                      {Array.from({ length: 4 }).map((_, i) => (
                        <div key={i} className={`w-2 h-2 rounded-sm ${i < cov ? 'bg-primary' : 'bg-secondary'}`} />
                      ))}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ── STATS VIEW ────────────────────────────────────────────────────────────────

function StatsView({ pipelineResult }: { pipelineResult: Municipio[] | null }) {
  if (!pipelineResult) {
    return (
      <div className="flex flex-col items-center justify-center py-16 gap-3 text-center">
        <div className="w-12 h-12 rounded-full bg-secondary flex items-center justify-center">
          <TrendingUp className="w-6 h-6 text-muted-foreground" />
        </div>
        <p className="font-semibold text-sm">Ejecuta el pipeline primero</p>
        <p className="text-xs text-muted-foreground max-w-xs">
          Las distribuciones y estadísticas descriptivas requieren haber corrido el pipeline IRCA.
          Ve a la pestaña <span className="font-semibold">Pipeline</span> y haz clic en "Ejecutar".
        </p>
      </div>
    );
  }

  const n = pipelineResult.length;

  const numStats = (vals: number[]) => {
    const sorted = [...vals].sort((a, b) => a - b);
    const sum = vals.reduce((s, v) => s + v, 0);
    const mean = sum / n;
    const variance = vals.reduce((s, v) => s + (v - mean) ** 2, 0) / n;
    return {
      min:    sorted[0],
      max:    sorted[n - 1],
      mean,
      median: sorted[Math.floor(n / 2)],
      std:    Math.sqrt(variance),
      p25:    sorted[Math.floor(n * 0.25)],
      p75:    sorted[Math.floor(n * 0.75)],
    };
  };

  const FIELDS: { key: keyof Municipio; label: string; fmt: (v: number) => string; color: string }[] = [
    { key: 'iraa_score',          label: 'IRCA score',           fmt: v => v.toFixed(3), color: 'bg-primary' },
    { key: 'pctl_vuln_salud',     label: 'pctl_vuln_salud',      fmt: v => v.toFixed(3), color: 'bg-violet-500' },
    { key: 'pctl_exposicion',     label: 'pctl_exposicion',      fmt: v => v.toFixed(3), color: 'bg-violet-500' },
    { key: 'pctl_severidad',      label: 'pctl_severidad',       fmt: v => v.toFixed(3), color: 'bg-violet-500' },
    { key: 'camas_por_1000_hab',  label: 'camas/1 000 hab',      fmt: v => v.toFixed(2), color: 'bg-emerald-500' },
    { key: 'total_eventos',       label: 'total_eventos',        fmt: v => v.toFixed(0), color: 'bg-amber-500' },
    { key: 'severidad_vial',      label: 'severidad_vial',       fmt: v => v.toFixed(2), color: 'bg-amber-500' },
    { key: 'poblacion',           label: 'poblacion',            fmt: v => v.toLocaleString('es-CO'), color: 'bg-blue-500' },
  ];

  const MicroHistogram = ({ vals, color }: { vals: number[]; color: string }) => {
    const min = Math.min(...vals), max = Math.max(...vals);
    const BINS = 8;
    const buckets = Array<number>(BINS).fill(0);
    vals.forEach(v => {
      const idx = max === min ? 0 : Math.min(Math.floor(((v - min) / (max - min)) * BINS), BINS - 1);
      buckets[idx]++;
    });
    const maxB = Math.max(...buckets);
    return (
      <div className="flex items-end gap-0.5 h-8">
        {buckets.map((b, i) => (
          <div key={i} className={`flex-1 rounded-sm ${color} opacity-80 transition-all [height:var(--bar-h)]`}
            style={{ '--bar-h': `${maxB > 0 ? Math.max(2, Math.round((b / maxB) * 32)) : 2}px` } as React.CSSProperties}
            title={`${b} valores`} />
        ))}
      </div>
    );
  };

  const statsTable = FIELDS.map(f => ({
    ...f,
    vals: pipelineResult.map(m => m[f.key] as number),
    s:    numStats(pipelineResult.map(m => m[f.key] as number)),
  }));

  // Correlation matrix between the 3 components and IRCA
  const corrFields = ['pctl_vuln_salud', 'pctl_exposicion', 'pctl_severidad', 'iraa_score'] as (keyof Municipio)[];
  const corrMatrix = corrFields.map(fa => corrFields.map(fb => {
    const va = pipelineResult.map(m => m[fa] as number);
    const vb = pipelineResult.map(m => m[fb] as number);
    const ma = va.reduce((s, v) => s + v, 0) / n;
    const mb = vb.reduce((s, v) => s + v, 0) / n;
    const cov = va.reduce((s, v, i) => s + (v - ma) * (vb[i] - mb), 0) / n;
    const sa  = Math.sqrt(va.reduce((s, v) => s + (v - ma) ** 2, 0) / n);
    const sb  = Math.sqrt(vb.reduce((s, v) => s + (v - mb) ** 2, 0) / n);
    return sa > 0 && sb > 0 ? cov / (sa * sb) : (fa === fb ? 1 : 0);
  }));

  const corrColor = (r: number) => {
    const abs = Math.abs(r);
    if (abs > 0.8) return r > 0 ? 'bg-primary/80 text-primary-foreground' : 'bg-destructive/80 text-destructive-foreground';
    if (abs > 0.5) return r > 0 ? 'bg-primary/40 text-primary' : 'bg-destructive/40 text-destructive';
    if (abs > 0.2) return 'bg-secondary text-muted-foreground';
    return 'bg-secondary/40 text-muted-foreground/50';
  };

  return (
    <div className="space-y-6">
      {/* Descriptive stats table */}
      <div className="space-y-2">
        <SectionLabel>Estadísticas descriptivas — {n} municipios</SectionLabel>
        <div className="bg-card border border-border rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="bg-secondary/50 sticky top-0">
                <tr>
                  <th className="text-left px-3 py-2.5 font-semibold text-muted-foreground">Campo</th>
                  <th className="text-right px-3 py-2.5 font-semibold text-muted-foreground">Min</th>
                  <th className="text-right px-3 py-2.5 font-semibold text-muted-foreground">P25</th>
                  <th className="text-right px-3 py-2.5 font-semibold text-muted-foreground">Mediana</th>
                  <th className="text-right px-3 py-2.5 font-semibold text-muted-foreground">Media</th>
                  <th className="text-right px-3 py-2.5 font-semibold text-muted-foreground">P75</th>
                  <th className="text-right px-3 py-2.5 font-semibold text-muted-foreground">Max</th>
                  <th className="text-right px-3 py-2.5 font-semibold text-muted-foreground">Std</th>
                  <th className="px-3 py-2.5 font-semibold text-muted-foreground">Distribución</th>
                </tr>
              </thead>
              <tbody>
                {statsTable.map(({ key, label, fmt, color, s, vals }) => (
                  <tr key={key as string} className="border-t border-border hover:bg-accent/20">
                    <td className="px-3 py-2 font-mono font-semibold text-foreground">{label}</td>
                    <td className="px-3 py-2 text-right font-mono text-muted-foreground">{fmt(s.min)}</td>
                    <td className="px-3 py-2 text-right font-mono text-muted-foreground">{fmt(s.p25)}</td>
                    <td className="px-3 py-2 text-right font-mono font-semibold">{fmt(s.median)}</td>
                    <td className="px-3 py-2 text-right font-mono">{fmt(s.mean)}</td>
                    <td className="px-3 py-2 text-right font-mono text-muted-foreground">{fmt(s.p75)}</td>
                    <td className="px-3 py-2 text-right font-mono text-muted-foreground">{fmt(s.max)}</td>
                    <td className="px-3 py-2 text-right font-mono text-muted-foreground">{fmt(s.std)}</td>
                    <td className="px-3 py-2 w-24"><MicroHistogram vals={vals} color={color} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Correlation matrix */}
      <div className="space-y-2">
        <SectionLabel>Matriz de correlación — componentes IRCA</SectionLabel>
        <div className="bg-card border border-border rounded-xl overflow-hidden w-fit">
          <table className="text-xs">
            <thead className="bg-secondary/50">
              <tr>
                <th className="px-3 py-2.5 text-muted-foreground"></th>
                {corrFields.map(f => (
                  <th key={f as string} className="px-4 py-2.5 text-muted-foreground font-mono text-center whitespace-nowrap">
                    {String(f).replace('pctl_', '').replace('iraa_', 'IRCA')}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {corrMatrix.map((row, i) => (
                <tr key={i} className="border-t border-border">
                  <td className="px-3 py-2 font-mono font-semibold text-foreground whitespace-nowrap">
                    {String(corrFields[i]).replace('pctl_', '').replace('iraa_', 'IRCA')}
                  </td>
                  {row.map((r, j) => (
                    <td key={j} className="px-1 py-1 text-center">
                      <div className={`w-14 h-8 flex items-center justify-center rounded-md text-[11px] font-semibold ${corrColor(r)}`}>
                        {i === j ? '1.00' : r.toFixed(2)}
                      </div>
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="text-[10px] text-muted-foreground">
          Correlación de Pearson. Valores {'>'} |0.8| = alta correlación. Los tres componentes son
          independientes por diseño (percentiles uniformes sobre variables distintas).
        </p>
      </div>

      {/* Anomaly flags */}
      <div className="space-y-2">
        <SectionLabel>Alertas de calidad — anomalías detectadas</SectionLabel>
        <div className="space-y-2">
          {(() => {
            const alerts: { label: string; muns: string[]; severity: 'warn' | 'info' }[] = [];
            const zeroBeds = pipelineResult.filter(m => m.camas_totales === 0);
            if (zeroBeds.length) alerts.push({ label: '0 camas registradas en REPS', muns: zeroBeds.map(m => m.municipio), severity: 'warn' });
            const noEvents = pipelineResult.filter(m => m.sin_eventos_reportados);
            if (noEvents.length) alerts.push({ label: 'Sin eventos UNGRD (subregistro potencial)', muns: noEvents.map(m => m.municipio), severity: 'info' });
            const criticos = pipelineResult.filter(m => m.nivel_riesgo === 'Crítico');
            if (criticos.length) alerts.push({ label: 'Nivel CRÍTICO — acción en 24 h', muns: criticos.map(m => m.municipio), severity: 'warn' });
            return alerts.map(a => (
              <div key={a.label} className={`flex items-start gap-3 rounded-xl border p-3 ${
                a.severity === 'warn' ? 'bg-destructive/8 border-destructive/25' : 'bg-secondary/50 border-border'
              }`}>
                <AlertCircle className={`w-4 h-4 shrink-0 mt-0.5 ${a.severity === 'warn' ? 'text-destructive' : 'text-muted-foreground'}`} />
                <div className="min-w-0">
                  <div className={`text-xs font-semibold ${a.severity === 'warn' ? 'text-destructive' : 'text-foreground'}`}>
                    {a.label} <span className="font-normal text-muted-foreground">({a.muns.length} municipios)</span>
                  </div>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {a.muns.map(m => (
                      <span key={m} className="text-[10px] px-1.5 py-0.5 rounded bg-background border border-border text-muted-foreground">{m}</span>
                    ))}
                  </div>
                </div>
              </div>
            ));
          })()}
        </div>
      </div>
    </div>
  );
}

// ── Shared helpers ────────────────────────────────────────────────────────────

function Pill({ children, color }: { children: React.ReactNode; color: string }) {
  return (
    <span className={`px-2.5 py-1 rounded-full bg-secondary text-xs font-medium ${color}`}>
      {children}
    </span>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">{children}</p>
  );
}

function QualityBar({ value }: { value: number }) {
  const color = value > 90 ? 'bg-[hsl(145,63%,55%)]' : value > 70 ? 'bg-yellow-400' : 'bg-red-400';
  return (
    <div className="flex items-center gap-1.5">
      <div className="w-16 h-1.5 rounded-full bg-secondary overflow-hidden">
        <div className={`h-full rounded-full [width:var(--bar-w)] ${color}`}
          style={{ '--bar-w': `${value}%` } as React.CSSProperties} />
      </div>
      <span className="text-[10px] text-muted-foreground">{value}% completo</span>
    </div>
  );
}

function NavBtn({ onClick, disabled, active, children }: {
  onClick: () => void; disabled?: boolean; active?: boolean; children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`w-7 h-7 flex items-center justify-center rounded text-xs transition ${
        active
          ? 'bg-primary text-primary-foreground font-bold'
          : 'hover:bg-accent disabled:opacity-30'
      }`}
    >
      {children}
    </button>
  );
}

function elapsedLabel(d: Date): string {
  const s = Math.floor((Date.now() - d.getTime()) / 1000);
  if (s < 60)   return `hace ${s}s`;
  if (s < 3600) return `hace ${Math.floor(s / 60)}min`;
  return `hace ${Math.floor(s / 3600)}h`;
}
