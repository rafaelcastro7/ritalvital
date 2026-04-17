import { useMemo } from 'react';
import { Search, X, RotateCcw } from 'lucide-react';
import { useFilters } from '@/context/FilterContext';
import { RISK_COLORS, RISK_LEVELS, type RiskLevel } from '@/types/municipio';

interface Props {
  open: boolean;
  onToggle: () => void;
}

const fmtPob = (n: number) => {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${Math.round(n / 1_000)}k`;
  return String(n);
};

const FilterSidebar = ({ open, onToggle }: Props) => {
  const {
    state, filtered, raw, deptos, populationBounds,
    toggleRisk, setSearch, setDepto, setOnlyLowConf, setPopulationRange, resetFilters,
  } = useFilters();

  const counts = useMemo(() => {
    const c = { 'Crítico': 0, 'Alto': 0, 'Medio': 0, 'Bajo': 0 } as Record<RiskLevel, number>;
    for (const m of raw) c[m.nivel_riesgo]++;
    return c;
  }, [raw]);

  if (!open) {
    return (
      <button
        type="button"
        onClick={onToggle}
        className="absolute top-3 left-3 z-[1100] bg-card/95 backdrop-blur border border-border rounded-lg px-3 py-2 text-xs font-medium hover:bg-accent transition shadow-lg"
        aria-label="Abrir filtros"
      >
        ☰ Filtros · {filtered.length}
      </button>
    );
  }

  return (
    <aside className="absolute top-3 left-3 bottom-3 z-[1100] w-72 bg-card/95 backdrop-blur border border-border rounded-xl shadow-2xl flex flex-col overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 border-b border-border flex items-center justify-between shrink-0">
        <div>
          <div className="text-sm font-bold">Filtros</div>
          <div className="text-[10px] text-muted-foreground">
            {filtered.length.toLocaleString('es-CO')} de {raw.length.toLocaleString('es-CO')} municipios
          </div>
        </div>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={resetFilters}
            className="p-1.5 rounded-md hover:bg-accent text-muted-foreground hover:text-foreground transition"
            title="Restablecer filtros"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={onToggle}
            className="p-1.5 rounded-md hover:bg-accent text-muted-foreground hover:text-foreground transition"
            aria-label="Cerrar filtros"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-5">
        {/* Búsqueda */}
        <section>
          <label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Buscar</label>
          <div className="relative mt-1.5">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              value={state.search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Municipio o departamento…"
              className="w-full bg-background border border-border rounded-md pl-8 pr-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>
        </section>

        {/* Niveles de riesgo */}
        <section>
          <label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Nivel de riesgo</label>
          <div className="mt-2 space-y-1">
            {RISK_LEVELS.map(n => {
              const active = state.riskLevels.has(n);
              return (
                <button
                  key={n}
                  type="button"
                  onClick={() => toggleRisk(n)}
                  className={`w-full flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-md text-xs border transition ${
                    active ? 'bg-secondary border-border' : 'bg-transparent border-border/50 opacity-50 hover:opacity-80'
                  }`}
                >
                  <span className="flex items-center gap-2">
                    <span
                      className="w-2.5 h-2.5 rounded-full shrink-0"
                      style={{ backgroundColor: RISK_COLORS[n], boxShadow: active ? `0 0 8px ${RISK_COLORS[n]}` : 'none' }}
                    />
                    <span className="font-medium">{n}</span>
                  </span>
                  <span className="text-muted-foreground tabular-nums">{counts[n].toLocaleString('es-CO')}</span>
                </button>
              );
            })}
          </div>
        </section>

        {/* Departamento */}
        <section>
          <label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Departamento</label>
          <select
            value={state.depto}
            onChange={e => setDepto(e.target.value)}
            className="mt-1.5 w-full bg-background border border-border rounded-md px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
          >
            <option value="all">Todos · {deptos.length}</option>
            {deptos.map(d => (
              <option key={d.cod} value={d.cod}>{d.nom} ({d.count})</option>
            ))}
          </select>
        </section>

        {/* Población */}
        <section>
          <label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            Población
          </label>
          <div className="text-[11px] text-foreground mt-1 tabular-nums">
            {fmtPob(state.populationRange[0])} – {fmtPob(state.populationRange[1])} hab
          </div>
          <div className="space-y-1 mt-2">
            <input
              type="range"
              min={populationBounds[0]}
              max={populationBounds[1]}
              value={state.populationRange[0]}
              onChange={e => setPopulationRange([+e.target.value, state.populationRange[1]])}
              className="w-full accent-primary"
              aria-label="Población mínima"
            />
            <input
              type="range"
              min={populationBounds[0]}
              max={populationBounds[1]}
              value={state.populationRange[1]}
              onChange={e => setPopulationRange([state.populationRange[0], +e.target.value])}
              className="w-full accent-primary"
              aria-label="Población máxima"
            />
          </div>
        </section>

        {/* Confianza */}
        <section>
          <label className="flex items-center gap-2 text-xs cursor-pointer select-none">
            <input
              type="checkbox"
              checked={state.onlyLowConf}
              onChange={e => setOnlyLowConf(e.target.checked)}
              className="rounded accent-primary"
            />
            <span>Solo baja confianza</span>
          </label>
          <p className="text-[10px] text-muted-foreground mt-1 leading-snug pl-5">
            Municipios con posible subregistro de eventos.
          </p>
        </section>
      </div>
    </aside>
  );
};

export default FilterSidebar;
