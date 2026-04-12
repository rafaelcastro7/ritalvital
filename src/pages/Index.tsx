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
import {
  fetchReps, fetchUngrdHist, fetchUngrdRecent,
  runIrcaPipeline,
} from '@/lib/datasets';

// ── Fases de carga en vivo ────────────────────────────────────────────────────

type LoadPhase =
  | 'connecting'
  | 'reps'
  | 'ungrd'
  | 'pipeline'
  | 'done'
  | 'error';

const PHASE_LABELS: Record<LoadPhase, string> = {
  connecting: 'Conectando con datos.gov.co…',
  reps:       'Descargando REPS — Capacidad Instalada (MinSalud)…',
  ungrd:      'Descargando emergencias UNGRD (2019–2024)…',
  pipeline:   'Calculando IRCA para los 32 municipios de Chocó…',
  done:       'Listo',
  error:      'No se pudieron obtener datos en vivo',
};

const PHASE_PCT: Record<LoadPhase, number> = {
  connecting: 5,
  reps:       25,
  ungrd:      55,
  pipeline:   80,
  done:       100,
  error:      100,
};

// ── Componente de carga ───────────────────────────────────────────────────────

function LiveLoadingScreen({ phase, error }: { phase: LoadPhase; error: string }) {
  const pct = PHASE_PCT[phase];
  const isErr = phase === 'error';

  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-6 px-6">
      <div className="text-center space-y-1">
        <h1 className="text-2xl font-bold tracking-tight">
          <span className="text-primary">🏥</span> RutaVital IA
        </h1>
        <p className="text-sm text-muted-foreground">Priorización territorial · Chocó</p>
      </div>

      <div className="w-full max-w-sm space-y-3">
        {/* Barra de progreso */}
        <div className="h-2 rounded-full bg-secondary overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-700 [width:var(--progress-w)] ${
              isErr ? 'bg-destructive' : 'bg-primary'
            }`}
            style={{ '--progress-w': `${pct}%` } as React.CSSProperties}
          />
        </div>

        <p className={`text-sm text-center ${isErr ? 'text-destructive' : 'text-muted-foreground animate-pulse'}`}>
          {isErr ? error : PHASE_LABELS[phase]}
        </p>

        {/* Pasos */}
        <div className="mt-4 space-y-1.5 text-xs text-muted-foreground">
          {(
            [
              ['reps',     'REPS Capacidad Instalada',   's2ru-bqt6'],
              ['ungrd',    'Emergencias UNGRD hist+rec',  'wwkg-r6te · rgre-6ak4'],
              ['pipeline', 'Pipeline IRCA',               'TypeScript · 32 municipios'],
            ] as [LoadPhase, string, string][]
          ).map(([key, label, src]) => {
            const phasePct  = PHASE_PCT[phase];
            const keyPct    = PHASE_PCT[key];
            const done      = phasePct > keyPct;
            const active    = phase === key;
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
          Puedes usar{' '}
          <span className="font-semibold text-foreground">Gestión de datos</span>{' '}
          en el encabezado para reintentar o inspeccionar cada fuente individualmente.
        </p>
      )}
    </div>
  );
}

// ── Página principal ──────────────────────────────────────────────────────────

const Index = () => {
  const [data,              setData]              = useState<Municipio[]>([]);
  const [selected,          setSelected]          = useState<Municipio | null>(null);
  const [aboutOpen,         setAboutOpen]         = useState(false);
  const [datasetManagerOpen,setDatasetManagerOpen]= useState(false);
  const [pipelineDate,      setPipelineDate]      = useState('');
  const [isLiveData,        setIsLiveData]        = useState(false);
  const [loadPhase,         setLoadPhase]         = useState<LoadPhase>('connecting');
  const [loadError,         setLoadError]         = useState('');

  // ── Auto-carga al montar ──────────────────────────────────────────────────
  const runLivePipeline = useCallback(async () => {
    setLoadPhase('connecting');
    setLoadError('');

    try {
      // REPS y UNGRD en paralelo para minimizar tiempo total
      setLoadPhase('reps');
      const [repsRows, ungrdHistRows, ungrdRecentRows] = await Promise.all([
        fetchReps().catch((e: unknown) => {
          console.warn('[RutaVital] REPS falló:', e instanceof Error ? e.message : e);
          return [] as ReturnType<typeof fetchReps> extends Promise<infer T> ? T : never;
        }),
        // UNGRD hist primero, luego reciente (en paralelo entre sí)
        (async () => {
          setLoadPhase('ungrd');
          return fetchUngrdHist().catch((e: unknown) => {
            console.warn('[RutaVital] UNGRD hist falló:', e instanceof Error ? e.message : e);
            return [] as ReturnType<typeof fetchUngrdHist> extends Promise<infer T> ? T : never;
          });
        })(),
        fetchUngrdRecent().catch((e: unknown) => {
          console.warn('[RutaVital] UNGRD reciente falló:', e instanceof Error ? e.message : e);
          return [] as ReturnType<typeof fetchUngrdRecent> extends Promise<infer T> ? T : never;
        }),
      ]);

      const hasEnoughData = repsRows.length > 0 || ungrdHistRows.length > 0 || ungrdRecentRows.length > 0;
      if (!hasEnoughData) {
        throw new Error('Ninguna fuente devolvió datos. Verifica tu conexión a internet.');
      }

      setLoadPhase('pipeline');
      // setTimeout 0 para que React renderice el cambio de fase antes de bloquear
      await new Promise<void>(resolve => setTimeout(resolve, 30));

      const result = runIrcaPipeline(
        repsRows,
        ungrdHistRows,
        ungrdRecentRows,
        () => {},  // logs no necesarios en el auto-run
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

  useEffect(() => {
    void runLivePipeline();
  }, [runLivePipeline]);

  // ── Callback desde DatasetManager ─────────────────────────────────────────
  const handleDataUpdate = (newData: Municipio[], runAt: Date) => {
    setData(newData);
    setSelected(null);
    setIsLiveData(true);
    setPipelineDate(runAt.toLocaleDateString('es-CO'));
    setLoadPhase('done');
  };

  // ── Modales siempre disponibles ────────────────────────────────────────────
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

  // ── Pantalla de carga ──────────────────────────────────────────────────────
  if (loadPhase !== 'done' && loadPhase !== 'error') {
    return (
      <>
        {modals}
        <LiveLoadingScreen phase={loadPhase} error={loadError} />
      </>
    );
  }

  // ── Error al cargar — mostrar header + mensaje ─────────────────────────────
  if (loadPhase === 'error' && !data.length) {
    return (
      <div className="min-h-screen flex flex-col">
        <DashboardHeader
          totalMunicipios={0}
          pipelineDate=""
          isLiveData={false}
          onAboutOpen={() => setAboutOpen(true)}
          onDatasetManagerOpen={() => setDatasetManagerOpen(true)}
        />
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
            <p className="text-xs text-muted-foreground">
              También puedes abrir <span className="font-semibold">Gestión de datos</span> para
              cargar cada fuente individualmente y ejecutar el pipeline.
            </p>
          </div>
        </div>
      </div>
    );
  }

  // ── Dashboard principal ────────────────────────────────────────────────────
  return (
    <div className="min-h-screen flex flex-col">
      <DashboardHeader
        totalMunicipios={data.length}
        pipelineDate={pipelineDate}
        isLiveData={isLiveData}
        onAboutOpen={() => setAboutOpen(true)}
        onDatasetManagerOpen={() => setDatasetManagerOpen(true)}
      />
      {modals}
      <KpiCards data={data} />

      <div className="flex-1 px-6 pb-4 flex flex-col lg:flex-row gap-4">
        <div className="flex-1 flex flex-col gap-4">
          <div className="relative flex-1 min-h-[400px] rounded-lg overflow-hidden border border-border">
            <RiskMap data={data} onSelect={setSelected} selected={selected} />
            <MapLegend />
          </div>
          <RiskDistributionChart data={data} />
        </div>
        {selected && (
          <DetailPanel municipio={selected} onClose={() => setSelected(null)} />
        )}
      </div>

      <DataTable data={data} onSelect={setSelected} />
      <DashboardFooter />
    </div>
  );
};

export default Index;
