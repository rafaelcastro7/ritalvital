interface Props {
  totalMunicipios: number;
  pipelineDate: string;
}

const DashboardHeader = ({ pipelineDate }: Props) => (
  <header className="border-b border-border px-6 py-4 flex items-center justify-between flex-wrap gap-3">
    <div>
      <h1 className="text-2xl font-bold tracking-tight">
        <span className="text-primary">🏥</span> RutaVital IA
      </h1>
      <p className="text-sm text-muted-foreground">Priorización territorial · Chocó</p>
    </div>
    <span className="text-xs bg-secondary text-secondary-foreground px-3 py-1 rounded-full">
      Pipeline: {pipelineDate}
    </span>
  </header>
);

export default DashboardHeader;
