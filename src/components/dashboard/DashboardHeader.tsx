import { Database, Wifi, WifiOff } from 'lucide-react';

interface Props {
  totalMunicipios: number;
  pipelineDate: string;
  isLiveData?: boolean;
  onAboutOpen?: () => void;
  onDatasetManagerOpen?: () => void;
}

const DashboardHeader = ({ pipelineDate, isLiveData, onAboutOpen, onDatasetManagerOpen }: Props) => (
  <header className="border-b border-border px-6 py-4 flex items-center justify-between flex-wrap gap-3">
    <div>
      <h1 className="text-2xl font-bold tracking-tight">
        <span className="text-primary">🏥</span> RutaVital IA
      </h1>
      <p className="text-sm text-muted-foreground">Priorización territorial · Chocó</p>
    </div>
    <div className="flex items-center gap-3">
      {/* Indicador de origen de datos */}
      {isLiveData !== undefined && (
        <span className={`flex items-center gap-1.5 text-xs px-3 py-1 rounded-full font-medium ${
          isLiveData
            ? 'bg-[hsl(145,63%,55%)]/15 text-[hsl(145,63%,45%)] border border-[hsl(145,63%,55%)]/30'
            : 'bg-destructive/10 text-destructive border border-destructive/20'
        }`}>
          {isLiveData
            ? <><Wifi className="w-3 h-3" /> Datos en vivo · datos.gov.co</>
            : <><WifiOff className="w-3 h-3" /> Sin conexión a fuentes</>}
        </span>
      )}
      <button
        type="button"
        onClick={onAboutOpen}
        className="text-xs bg-secondary hover:bg-accent text-secondary-foreground px-3 py-1.5 rounded-full transition"
      >
        ℹ️ Acerca de
      </button>
      <button
        type="button"
        onClick={onDatasetManagerOpen}
        className="flex items-center gap-1.5 text-xs bg-primary text-primary-foreground hover:opacity-90 px-3 py-1.5 rounded-full transition font-medium"
      >
        <Database className="w-3.5 h-3.5" />
        Gestión de datos
      </button>
      {pipelineDate && (
        <span className="text-xs bg-secondary text-secondary-foreground px-3 py-1 rounded-full">
          Actualizado: {pipelineDate}
        </span>
      )}
    </div>
  </header>
);

export default DashboardHeader;
