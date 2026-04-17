import { AlertTriangle, MapPin, Building2, Activity, Gauge } from 'lucide-react';
import { useFilters } from '@/context/FilterContext';
import { RISK_COLORS } from '@/types/municipio';

const KpiCards = () => {
  const { filtered, raw } = useFilters();

  const criticos = filtered.filter(m => m.nivel_riesgo === 'Crítico').length;
  const altos = filtered.filter(m => m.nivel_riesgo === 'Alto').length;
  const sinEventos = filtered.filter(m => m.sin_eventos_reportados).length;
  const avgIrca = filtered.length ? filtered.reduce((s, m) => s + m.iraa_score, 0) / filtered.length : 0;
  const totalPob = filtered.reduce((s, m) => s + m.poblacion, 0);
  const totalCamas = filtered.reduce((s, m) => s + m.camas_totales, 0);

  // Mini-distribución horizontal (sparkbar por nivel)
  const dist = ['Crítico', 'Alto', 'Medio', 'Bajo'] as const;
  const counts = dist.map(n => filtered.filter(m => m.nivel_riesgo === n).length);
  const max = Math.max(1, ...counts);

  const fmt = (n: number) => n.toLocaleString('es-CO');
  const fmtPob = (n: number) => n >= 1e6 ? `${(n / 1e6).toFixed(1)}M` : n >= 1e3 ? `${Math.round(n / 1e3)}k` : `${n}`;

  const cards = [
    {
      label: 'Municipios analizados',
      value: fmt(filtered.length),
      sub: `${fmt(raw.length - filtered.length)} ocultos por filtros`,
      Icon: MapPin,
      tint: 'text-primary',
    },
    {
      label: 'Críticos',
      value: fmt(criticos),
      sub: `${altos} en riesgo alto`,
      Icon: AlertTriangle,
      tint: 'text-risk-critico',
    },
    {
      label: 'Población cubierta',
      value: fmtPob(totalPob),
      sub: `${fmt(totalCamas)} camas totales`,
      Icon: Building2,
      tint: 'text-foreground',
    },
    {
      label: 'IRCA promedio',
      value: (avgIrca * 100).toFixed(1),
      sub: 'sobre 100',
      Icon: Gauge,
      tint: 'text-primary',
    },
    {
      label: 'Sin eventos reportados',
      value: fmt(sinEventos),
      sub: 'posible subregistro',
      Icon: Activity,
      tint: 'text-risk-medio',
    },
  ];

  return (
    <div className="px-6 pt-4 pb-3 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
      {cards.map(c => (
        <div
          key={c.label}
          className="bg-card border border-border rounded-xl p-3.5 hover:border-primary/30 transition-colors"
        >
          <div className="flex items-start justify-between gap-2">
            <div>
              <div className={`text-2xl font-bold tabular-nums ${c.tint}`}>{c.value}</div>
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground mt-0.5">{c.label}</div>
            </div>
            <c.Icon className={`w-4 h-4 mt-0.5 ${c.tint} opacity-70`} aria-hidden="true" />
          </div>
          <div className="text-[10px] text-muted-foreground mt-1.5">{c.sub}</div>

          {c.label === 'Municipios analizados' && (
            <div className="mt-2 flex h-1 rounded-full overflow-hidden bg-secondary">
              {dist.map((n, i) => (
                <div
                  key={n}
                  className="h-full transition-all"
                  style={{
                    width: `${(counts[i] / Math.max(1, filtered.length)) * 100}%`,
                    backgroundColor: RISK_COLORS[n],
                  }}
                  title={`${n}: ${counts[i]}`}
                />
              ))}
            </div>
          )}

          {c.label === 'Críticos' && counts[0] > 0 && (
            <div className="mt-2 flex items-end gap-0.5 h-4">
              {dist.map((n, i) => (
                <div
                  key={n}
                  className="flex-1 rounded-sm"
                  style={{
                    height: `${(counts[i] / max) * 100}%`,
                    minHeight: 2,
                    backgroundColor: RISK_COLORS[n],
                    opacity: 0.85,
                  }}
                  title={`${n}: ${counts[i]}`}
                />
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );
};

export default KpiCards;
