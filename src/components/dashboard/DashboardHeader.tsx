import UploadPipelineButton from "./UploadPipelineButton";

interface Props {
  totalMunicipios: number;
  pipelineDate: string;
  onAboutOpen?: () => void;
  onPipelineUploaded?: () => void;
}

const DashboardHeader = ({ pipelineDate, onAboutOpen, onPipelineUploaded }: Props) => (
  <header className="border-b border-border px-6 py-4 flex items-center justify-between flex-wrap gap-3">
    <div>
      <h1 className="text-2xl font-bold tracking-tight">
        <span className="text-primary">🏥</span> RutaVital IA
      </h1>
      <p className="text-sm text-muted-foreground">Priorización territorial · Chocó</p>
    </div>
    <div className="flex items-center gap-3">
      <button
        onClick={onAboutOpen}
        className="text-xs bg-secondary hover:bg-accent text-secondary-foreground px-3 py-1.5 rounded-full transition"
      >
        ℹ️ Acerca de
      </button>
      <UploadPipelineButton onUploaded={onPipelineUploaded || (() => window.location.reload())} />
      <span className="text-xs bg-secondary text-secondary-foreground px-3 py-1 rounded-full">
        Pipeline: {pipelineDate}
      </span>
    </div>
  </header>
);

export default DashboardHeader;
