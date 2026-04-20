import React, { useState, useEffect, useCallback } from 'react';
import type { Municipio } from '@/types/municipio';
import DashboardHeader from '@/components/dashboard/DashboardHeader';
import AboutModal from '@/components/dashboard/AboutModal';
import DatasetManager from '@/components/dashboard/DatasetManager';
import KpiCards from '@/components/dashboard/KpiCards';
import RiskMap from '@/components/dashboard/RiskMap';
import MapLegend from '@/components/dashboard/MapLegend';
import RiskDistributionChart from '@/components/dashboard/RiskDistributionChart';
import DetailPanel from '@/components/dashboard/DetailPanel';
import DataTable from '@/components/dashboard/DataTable';
import DashboardFooter from '@/components/dashboard/DashboardFooter';
import FilterSidebar from '@/components/dashboard/FilterSidebar';
import ComparativaView from '@/components/dashboard/ComparativaView';
import AlertasBanner from '@/components/dashboard/AlertasBanner';
import { FilterProvider, useFilters } from '@/context/FilterContext';
import {
  fetchDivipola, fetchReps, fetchUngrdHist, fetchUngrdRecent,
  runIrcaPipelineNational,
} from '@/lib/datasets';

// ── Fases de carga ────────────────────────────────────────────────────────────

type LoadPhase =
  | 'connecting'
  | 'divipola'
  | 'reps'
  | 'ungrd'
  | 'pipeline'
  | 'done'
  | 'error';

const PHASE_LABELS: Record<LoadPhase, string> = {
  connecting: 'Conectando con datos.gov.co…',
  divipola:   'Descargando DIVIPOLA — 1.122 municipios (DANE)…',
  reps:       'Descargando REPS — capacidad instalada nacional (MinSalud)…',
  ungrd:      'Descargando emergencias UNGRD nacional (2019–2024)…',
  pipeline:   'Calculando IRCA para Colombia entera…',
  done:       'Listo',
  error:      'No se pudieron obtener datos en vivo',
};

const PHASE_PCT: Record<LoadPhase, number> = {
  connecting: 5,
  divipola:   20,
  reps:       45,
  ungrd:      70,
  pipeline:   90,
  done:       100,
  error:      100,
};

function LiveLoadingScreen({ phase, error }: { phase: LoadPhase; error: string }) {
  const pct = PHASE_PCT[phase];
  const isErr = phase === 'error';

  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-6 px-6">
      <div className="text-center space-y-1">
        <h1 className="text-2xl font-bold tracking-tight">
          <span className="text-primary">🏥</span> RutaVital IA
        </h1>
        <p className="text-sm text-muted-foreground">Priorización territorial · Colombia</p>
      </div>

      <div className="w-full max-w-md space-y-3">
        <div className="h-2 rounded-full bg-secondary overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-700 ${
              isErr ? 'bg-destructive' : 'bg-primary'
            }`}
            style={{ width: `${pct}%` }}
          />
        </div>

        <p className={`text-sm text-center ${isErr ? 'text-destructive' : 'text-muted-foreground animate-pulse'}`}>
          {isErr ? error : PHASE_LABELS[phase]}
        </p>

        <div className="mt-4 space-y-1.5 text-xs text-muted-foreground">
          {(
            [
              ['divipola', 'DIVIPOLA Nacional',          'gdxc-w37w'],
              ['reps',     'REPS Capacidad Instalada',   's2ru-bqt6'],
              ['ungrd',    'Emergencias UNGRD hist+rec', 'wwkg-r6te · rgre-6ak4'],
              ['pipeline', 'Pipeline IRCA Nacional',     'TypeScript · 32 deptos'],
            ] as [LoadPhase, string, string][]
          ).map(([key, label, src]) => {
            const phasePct = PHASE_PCT[phase];
            const keyPct   = PHASE_PCT[key];
            const done     = phasePct > keyPct;
            const active   = phase === key;
            return (
              <div key={key} className={`flex items-center gap-2 transition-opacity ${
                done ? 'opacity-100' : active ? 'opacity-80' : 'opacity-30'
              }`}>
                <span>{done ? '✓' : active ? '⟳' : '○'}</span>
                <span className={done ? 'text-foreground' : ''}>{label}</span>
                <span className="ml-auto font-mono opacity-50">{src}</span>
              </div>
            );
          })}
        </div>
      </div>

      {isErr && (
        <p className="text-xs text-muted-foreground max-w-sm text-center">
          Reintenta o usa <span className="font-semibold text-foreground">Gestión de datos</span> para inspeccionar fuentes individualmente.
        </p>
      )}
    </div>
  );
}

// ── Inner: usa FilterProvider y maneja vistas ────────────────────────────────

function DashboardInner({
  data, pipelineDate, isLiveData,
  onAboutOpen, onDatasetManagerOpen,
}: {
  data: Municipio[];
  pipelineDate: string;
  isLiveData: boolean;
  onAboutOpen: () => void;
  onDatasetManagerOpen: () => void;
}) {
  const [view, setView] = useState<'mapa' | 'comparativa'>('mapa');
  const [selected, setSelected] = useState<Municipio | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const { filtered } = useFilters();

  // Atajo teclado: F → toggle filtros, ESC → cerrar detalle
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
      if (e.key === 'f' || e.key === 'F') setSidebarOpen(s => !s);
      if (e.key === 'Escape') setSelected(null);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  return (
    <div className="min-h-screen flex flex-col">
      <DashboardHeader
        totalMunicipios={data.length}
        pipelineDate={pipelineDate}
        isLiveData={isLiveData}
        view={view}
        onChangeView={setView}
        onAboutOpen={onAboutOpen}
        onDatasetManagerOpen={onDatasetManagerOpen}
      />
      <AlertasBanner />

      {view === 'mapa' ? (
        <>
          <KpiCards />

          <div className="flex-1 px-6 pb-4 flex flex-col lg:flex-row gap-4">
            <div className="flex-1 flex flex-col gap-4">
              <div className="relative flex-1 min-h-[480px] rounded-xl overflow-hidden border border-border">
                <RiskMap data={filtered} onSelect={setSelected} selected={selected} />
                <FilterSidebar open={sidebarOpen} onToggle={() => setSidebarOpen(s => !s)} />
                <MapLegend />
              </div>
              <RiskDistributionChart data={filtered} />
            </div>
            {selected && (
              <DetailPanel municipio={selected} onClose={() => setSelected(null)} />
            )}
          </div>

          <DataTable onSelect={setSelected} />
        </>
      ) : (
        <ComparativaView onSelectMunicipio={(m) => { setSelected(m); setView('mapa'); }} />
      )}

      <DashboardFooter />
    </div>
  );
}

// ── Página principal ──────────────────────────────────────────────────────────

const Index = () => {
  const [data,              setData]              = useState<Municipio[]>([]);
  const [aboutOpen,         setAboutOpen]         = useState(false);
  const [datasetManagerOpen,setDatasetManagerOpen]= useState(false);
  const [pipelineDate,      setPipelineDate]      = useState('');
  const [isLiveData,        setIsLiveData]        = useState(false);
  const [loadPhase,         setLoadPhase]         = useState<LoadPhase>('connecting');
  const [loadError,         setLoadError]         = useState('');

  const runLivePipeline = useCallback(async () => {
    setLoadPhase('connecting');
    setLoadError('');

    try {
      // 1. DIVIPOLA primero (necesario para universo nacional)
      setLoadPhase('divipola');
      const divipolaRows = await fetchDivipola().catch((e: unknown) => {
        console.warn('[RutaVital] DIVIPOLA falló:', e instanceof Error ? e.message : e);
        return [] as Record<string, string>[];
      });

      // 2. REPS y UNGRD en paralelo
      setLoadPhase('reps');
      const [repsRows, ungrdHistRows, ungrdRecentRows] = await Promise.all([
        fetchReps().catch((e: unknown) => {
          console.warn('[RutaVital] REPS falló:', e instanceof Error ? e.message : e);
          return [] as Record<string, string>[];
        }),
        (async () => {
          setLoadPhase('ungrd');
          return fetchUngrdHist().catch((e: unknown) => {
            console.warn('[RutaVital] UNGRD hist falló:', e instanceof Error ? e.message : e);
            return [] as Record<string, string>[];
          });
        })(),
        fetchUngrdRecent().catch((e: unknown) => {
          console.warn('[RutaVital] UNGRD recent falló:', e instanceof Error ? e.message : e);
          return [] as Record<string, string>[];
        }),
      ]);

      const hasEnoughData = divipolaRows.length > 0 || repsRows.length > 0 || ungrdHistRows.length > 0 || ungrdRecentRows.length > 0;
      if (!hasEnoughData) {
        throw new Error('Ninguna fuente devolvió datos. Verifica tu conexión a internet.');
      }

      setLoadPhase('pipeline');
      await new Promise<void>(resolve => setTimeout(resolve, 30));

      const result = await runIrcaPipelineNational(
        divipolaRows,
        repsRows,
        ungrdHistRows,
        ungrdRecentRows,
        () => {},
      );

      const now = new Date();
      setData(result);
      setIsLiveData(true);
      setPipelineDate(now.toLocaleDateString('es-CO'));
      setLoadPhase('done');
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      setLoadError(msg);
      setLoadPhase('error');
    }
  }, []);

  useEffect(() => { void runLivePipeline(); }, [runLivePipeline]);

  const handleDataUpdate = (newData: Municipio[], runAt: Date) => {
    setData(newData);
    setIsLiveData(true);
    setPipelineDate(runAt.toLocaleDateString('es-CO'));
    setLoadPhase('done');
  };

  const modals = (
    <>
      <AboutModal open={aboutOpen} onClose={() => setAboutOpen(false)} />
      <DatasetManager
        open={datasetManagerOpen}
        onClose={() => setDatasetManagerOpen(false)}
        onDataUpdate={handleDataUpdate}
      />
    </>
  );

  // Carga
  if (loadPhase !== 'done' && loadPhase !== 'error') {
    return (
      <>
        {modals}
        <LiveLoadingScreen phase={loadPhase} error={loadError} />
      </>
    );
  }

  // Error
  if (loadPhase === 'error' && !data.length) {
    return (
      <div className="min-h-screen flex flex-col">
        <header className="border-b border-border px-6 py-3">
          <h1 className="text-xl font-bold tracking-tight">
            <span className="text-primary">🏥</span> RutaVital IA
          </h1>
        </header>
        {modals}
        <div className="flex-1 flex items-center justify-center px-6">
          <div className="text-center space-y-4 max-w-sm">
            <p className="text-destructive font-semibold">Error al conectar con datos.gov.co</p>
            <p className="text-sm text-muted-foreground">{loadError}</p>
            <button
              type="button"
              onClick={() => void runLivePipeline()}
              className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 transition"
            >
              Reintentar
            </button>
            <button
              type="button"
              onClick={() => setDatasetManagerOpen(true)}
              className="block mx-auto text-xs text-primary hover:underline"
            >
              Abrir Gestión de datos
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <FilterProvider data={data}>
      {modals}
      <DashboardInner
        data={data}
        pipelineDate={pipelineDate}
        isLiveData={isLiveData}
        onAboutOpen={() => setAboutOpen(true)}
        onDatasetManagerOpen={() => setDatasetManagerOpen(true)}
      />
    </FilterProvider>
  );
};

export default Index;
