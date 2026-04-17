import { Database, Wifi, WifiOff, Map, BarChart3 } from 'lucide-react';

interface Props {
  totalMunicipios: number;
  pipelineDate: string;
  isLiveData?: boolean;
  view: 'mapa' | 'comparativa';
  onChangeView: (v: 'mapa' | 'comparativa') => void;
  onAboutOpen?: () => void;
  onDatasetManagerOpen?: () => void;
}

const DashboardHeader = ({
  pipelineDate, isLiveData, totalMunicipios, view, onChangeView,
  onAboutOpen, onDatasetManagerOpen,
}: Props) => (
  <header className="border-b border-border px-6 py-3 flex items-center justify-between flex-wrap gap-3">
    <div className="flex items-center gap-6">
      <div>
        <h1 className="text-xl font-bold tracking-tight leading-tight">
          <span className="text-primary">🏥</span> RutaVital IA
        </h1>
        <p className="text-[11px] text-muted-foreground">
          Priorización territorial · {totalMunicipios.toLocaleString('es-CO')} municipios
        </p>
      </div>

      {/* Nav */}
      <nav className="flex items-center gap-1 bg-secondary/50 rounded-lg p-1" role="tablist" aria-label="Vista">
        <button
          type="button"
          role="tab"
          aria-selected={view === 'mapa'}
          onClick={() => onChangeView('mapa')}
          className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-md transition ${
            view === 'mapa' ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          <Map className="w-3.5 h-3.5" />
          Mapa
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={view === 'comparativa'}
          onClick={() => onChangeView('comparativa')}
          className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-md transition ${
            view === 'comparativa' ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          <BarChart3 className="w-3.5 h-3.5" />
          Comparativa
        </button>
      </nav>
    </div>

    <div className="flex items-center gap-2">
      {isLiveData !== undefined && (
        <span className={`flex items-center gap-1.5 text-[11px] px-2.5 py-1 rounded-full font-medium ${
          isLiveData
            ? 'bg-[hsl(145,63%,55%)]/15 text-[hsl(145,63%,65%)] border border-[hsl(145,63%,55%)]/30'
            : 'bg-destructive/10 text-destructive border border-destructive/20'
        }`}>
          {isLiveData
            ? <><Wifi className="w-3 h-3" /> En vivo · datos.gov.co</>
            : <><WifiOff className="w-3 h-3" /> Sin conexión</>}
        </span>
      )}
      <button
        type="button"
        onClick={onAboutOpen}
        className="text-[11px] bg-secondary hover:bg-accent text-secondary-foreground px-2.5 py-1 rounded-full transition"
      >
        ℹ️ Acerca de
      </button>
      <button
        type="button"
        onClick={onDatasetManagerOpen}
        className="flex items-center gap-1.5 text-[11px] bg-primary text-primary-foreground hover:opacity-90 px-2.5 py-1 rounded-full transition font-medium"
      >
        <Database className="w-3 h-3" />
        Datos
      </button>
      {pipelineDate && (
        <span className="text-[11px] bg-secondary text-secondary-foreground px-2.5 py-1 rounded-full">
          {pipelineDate}
        </span>
      )}
    </div>
  </header>
);

export default DashboardHeader;
