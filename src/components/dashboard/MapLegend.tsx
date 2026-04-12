import { RISK_COLORS } from '@/types/municipio';

const LEVELS = ['Bajo', 'Medio', 'Alto', 'Crítico'] as const;

const MapLegend = () => (
  <div className="absolute bottom-4 left-4 z-[1000] bg-card/90 backdrop-blur border border-border rounded-lg px-3 py-2.5 space-y-1.5">
    <div className="text-[11px] font-semibold text-foreground mb-1">Nivel de riesgo</div>
    {LEVELS.map(nivel => (
      <div key={nivel} className="flex items-center gap-2 text-[11px] text-muted-foreground">
        <span className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: RISK_COLORS[nivel] }} />
        {nivel}
      </div>
    ))}
    <div className="border-t border-border pt-1.5 mt-1.5 flex items-center gap-2 text-[11px] text-muted-foreground">
      <svg width="14" height="14" viewBox="0 0 14 14">
        <circle cx="7" cy="7" r="5" fill="none" stroke="currentColor" strokeWidth="1.5" strokeDasharray="3 2" />
      </svg>
      Sin eventos reportados
    </div>
  </div>
);

export default MapLegend;
