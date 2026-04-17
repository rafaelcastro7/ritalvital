import { RISK_COLORS, RISK_LEVELS } from '@/types/municipio';
import { useFilters } from '@/context/FilterContext';

const MapLegend = () => {
  const { state, toggleRisk } = useFilters();

  return (
    <div className="absolute bottom-4 left-4 z-[1000] bg-card/95 backdrop-blur border border-border rounded-lg px-3 py-2.5 space-y-1.5 shadow-lg">
      <div className="text-[10px] font-semibold text-foreground uppercase tracking-wider mb-1.5">
        Nivel de riesgo · click para filtrar
      </div>
      {RISK_LEVELS.map(nivel => {
        const active = state.riskLevels.has(nivel);
        return (
          <button
            key={nivel}
            type="button"
            onClick={() => toggleRisk(nivel)}
            className={`w-full flex items-center gap-2 text-[11px] transition ${
              active ? 'text-foreground' : 'text-muted-foreground/50 line-through'
            }`}
            aria-pressed={active}
          >
            <span
              className="w-3 h-3 rounded-full shrink-0"
              style={{
                backgroundColor: active ? RISK_COLORS[nivel] : 'transparent',
                border: `1.5px solid ${RISK_COLORS[nivel]}`,
                boxShadow: active ? `0 0 6px ${RISK_COLORS[nivel]}` : 'none',
              }}
            />
            {nivel}
          </button>
        );
      })}
      <div className="border-t border-border pt-1.5 mt-1.5 flex items-center gap-2 text-[10px] text-muted-foreground">
        <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true">
          <circle cx="7" cy="7" r="5" fill="none" stroke="currentColor" strokeWidth="1.5" strokeDasharray="3 2" />
        </svg>
        Sin eventos reportados
      </div>
      <div className="text-[9px] text-muted-foreground/70 italic">Tamaño = población</div>
    </div>
  );
};

export default MapLegend;
