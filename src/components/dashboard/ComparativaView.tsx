import { useMemo, useState } from 'react';
import type { Municipio } from '@/types/municipio';
import { RISK_COLORS, RISK_LEVELS, type RiskLevel } from '@/types/municipio';
import { useFilters } from '@/context/FilterContext';
import { Trophy, ArrowUpDown } from 'lucide-react';

interface DeptoRow {
  cod: string;
  nom: string;
  total: number;
  pob: number;
  camas: number;
  irca: number;
  counts: Record<RiskLevel, number>;
  pctCritico: number;
  topMun?: Municipio;
}

const ComparativaView = ({ onSelectMunicipio }: { onSelectMunicipio: (m: Municipio) => void }) => {
  const { raw } = useFilters();
  const [sortBy, setSortBy] = useState<'irca' | 'pctCritico' | 'pob'>('irca');

  const deptos = useMemo<DeptoRow[]>(() => {
    const map = new Map<string, Municipio[]>();
    for (const m of raw) {
      const arr = map.get(m.cod_depto) ?? [];
      arr.push(m);
      map.set(m.cod_depto, arr);
    }
    const rows: DeptoRow[] = [];
    for (const [cod, list] of map) {
      const counts = { 'Crítico': 0, 'Alto': 0, 'Medio': 0, 'Bajo': 0 } as Record<RiskLevel, number>;
      let pob = 0, camas = 0, irca = 0;
      let topMun: Municipio | undefined;
      for (const m of list) {
        counts[m.nivel_riesgo]++;
        pob += m.poblacion;
        camas += m.camas_totales;
        irca += m.iraa_score;
        if (!topMun || m.iraa_score > topMun.iraa_score) topMun = m;
      }
      rows.push({
        cod,
        nom: list[0].depto,
        total: list.length,
        pob, camas,
        irca: irca / list.length,
        counts,
        pctCritico: counts['Crítico'] / list.length,
        topMun,
      });
    }
    rows.sort((a, b) => {
      if (sortBy === 'pob') return b.pob - a.pob;
      if (sortBy === 'pctCritico') return b.pctCritico - a.pctCritico;
      return b.irca - a.irca;
    });
    return rows;
  }, [raw, sortBy]);

  const top50 = useMemo(
    () => [...raw].sort((a, b) => b.iraa_score - a.iraa_score).slice(0, 50),
    [raw],
  );

  const fmt = (n: number) => n.toLocaleString('es-CO');
  const fmtPob = (n: number) => n >= 1e6 ? `${(n / 1e6).toFixed(2)}M` : n >= 1e3 ? `${Math.round(n / 1e3)}k` : `${n}`;

  return (
    <div className="px-6 py-6 space-y-8">
      {/* Header */}
      <div>
        <div className="text-xs font-semibold uppercase tracking-wider text-primary mb-1">
          Visión nacional
        </div>
        <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Comparativa por departamento</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Ranking nacional de continuidad asistencial — {fmt(raw.length)} municipios analizados en {deptos.length} entidades territoriales.
        </p>
      </div>

      {/* Departamentos */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-base font-semibold">Departamentos · ordenados por {
            sortBy === 'irca' ? 'IRCA promedio' : sortBy === 'pctCritico' ? '% críticos' : 'población'
          }</h2>
          <div className="flex items-center gap-1 text-xs">
            <ArrowUpDown className="w-3.5 h-3.5 text-muted-foreground" />
            {(['irca', 'pctCritico', 'pob'] as const).map(opt => (
              <button
                key={opt}
                type="button"
                onClick={() => setSortBy(opt)}
                className={`px-2.5 py-1 rounded-md transition ${
                  sortBy === opt
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-secondary text-secondary-foreground hover:bg-accent'
                }`}
              >
                {opt === 'irca' ? 'IRCA' : opt === 'pctCritico' ? '% críticos' : 'Población'}
              </button>
            ))}
          </div>
        </div>

        <div className="bg-card border border-border rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-secondary/50 text-[11px] uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="text-left px-3 py-2 font-semibold">#</th>
                  <th className="text-left px-3 py-2 font-semibold">Departamento</th>
                  <th className="text-right px-3 py-2 font-semibold">Mun.</th>
                  <th className="text-right px-3 py-2 font-semibold">Población</th>
                  <th className="text-right px-3 py-2 font-semibold">Camas</th>
                  <th className="text-right px-3 py-2 font-semibold">IRCA prom.</th>
                  <th className="text-left px-3 py-2 font-semibold w-[200px]">Distribución</th>
                  <th className="text-left px-3 py-2 font-semibold">Municipio top</th>
                </tr>
              </thead>
              <tbody>
                {deptos.map((d, i) => (
                  <tr key={d.cod} className="border-t border-border hover:bg-accent/30 transition">
                    <td className="px-3 py-2 text-xs text-muted-foreground tabular-nums">{i + 1}</td>
                    <td className="px-3 py-2 font-medium">{d.nom}</td>
                    <td className="px-3 py-2 text-right text-xs tabular-nums">{d.total}</td>
                    <td className="px-3 py-2 text-right text-xs tabular-nums">{fmtPob(d.pob)}</td>
                    <td className="px-3 py-2 text-right text-xs tabular-nums">{fmt(d.camas)}</td>
                    <td className="px-3 py-2 text-right text-xs font-semibold tabular-nums">
                      {(d.irca * 100).toFixed(1)}
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex h-2 rounded-full overflow-hidden bg-secondary" title={
                        RISK_LEVELS.map(n => `${n}: ${d.counts[n]}`).join(' · ')
                      }>
                        {RISK_LEVELS.map(n => (
                          <div
                            key={n}
                            style={{
                              width: `${(d.counts[n] / d.total) * 100}%`,
                              backgroundColor: RISK_COLORS[n],
                            }}
                          />
                        ))}
                      </div>
                      <div className="flex justify-between mt-1 text-[9px] text-muted-foreground tabular-nums">
                        <span style={{ color: RISK_COLORS['Crítico'] }}>{d.counts['Crítico']}c</span>
                        <span style={{ color: RISK_COLORS['Alto'] }}>{d.counts['Alto']}a</span>
                        <span style={{ color: RISK_COLORS['Medio'] }}>{d.counts['Medio']}m</span>
                        <span style={{ color: RISK_COLORS['Bajo'] }}>{d.counts['Bajo']}b</span>
                      </div>
                    </td>
                    <td className="px-3 py-2">
                      {d.topMun && (
                        <button
                          type="button"
                          onClick={() => onSelectMunicipio(d.topMun!)}
                          className="text-xs text-primary hover:underline"
                        >
                          {d.topMun.municipio} ({(d.topMun.iraa_score * 100).toFixed(0)})
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* Top 50 nacional */}
      <section>
        <div className="flex items-center gap-2 mb-3">
          <Trophy className="w-4 h-4 text-risk-critico" />
          <h2 className="text-base font-semibold">Top 50 municipios más críticos · Colombia</h2>
        </div>
        <div className="bg-card border border-border rounded-xl overflow-hidden">
          <div className="overflow-x-auto max-h-[600px] overflow-y-auto">
            <table className="w-full text-sm">
              <thead className="bg-secondary/50 text-[11px] uppercase tracking-wider text-muted-foreground sticky top-0">
                <tr>
                  <th className="text-left px-3 py-2 font-semibold">Rank</th>
                  <th className="text-left px-3 py-2 font-semibold">Municipio</th>
                  <th className="text-left px-3 py-2 font-semibold">Depto</th>
                  <th className="text-right px-3 py-2 font-semibold">IRCA</th>
                  <th className="text-right px-3 py-2 font-semibold">Pob.</th>
                  <th className="text-right px-3 py-2 font-semibold">Camas/1k</th>
                  <th className="text-right px-3 py-2 font-semibold">Eventos</th>
                  <th className="text-left px-3 py-2 font-semibold">Nivel</th>
                </tr>
              </thead>
              <tbody>
                {top50.map((m, i) => (
                  <tr
                    key={m.cod_municipio}
                    onClick={() => onSelectMunicipio(m)}
                    className="border-t border-border hover:bg-accent/30 cursor-pointer transition"
                  >
                    <td className="px-3 py-2 text-xs text-muted-foreground font-mono">#{i + 1}</td>
                    <td className="px-3 py-2 font-medium">{m.municipio}</td>
                    <td className="px-3 py-2 text-xs text-muted-foreground">{m.depto}</td>
                    <td className="px-3 py-2 text-right text-xs font-bold tabular-nums" style={{ color: RISK_COLORS[m.nivel_riesgo] }}>
                      {(m.iraa_score * 100).toFixed(1)}
                    </td>
                    <td className="px-3 py-2 text-right text-xs tabular-nums">{fmtPob(m.poblacion)}</td>
                    <td className="px-3 py-2 text-right text-xs tabular-nums">{m.camas_por_1000_hab.toFixed(2)}</td>
                    <td className="px-3 py-2 text-right text-xs tabular-nums">{m.total_eventos}</td>
                    <td className="px-3 py-2">
                      <span
                        className="text-[10px] font-semibold px-2 py-0.5 rounded-full"
                        style={{
                          backgroundColor: RISK_COLORS[m.nivel_riesgo] + '20',
                          color: RISK_COLORS[m.nivel_riesgo],
                          border: `1px solid ${RISK_COLORS[m.nivel_riesgo]}50`,
                        }}
                      >
                        {m.nivel_riesgo}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>
    </div>
  );
};

export default ComparativaView;
