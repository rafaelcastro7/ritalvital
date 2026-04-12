import { AlertTriangle } from 'lucide-react';
import type { Municipio } from '@/types/municipio';

interface Props {
  data: Municipio[];
}

const KpiCards = ({ data }: Props) => {
  const criticos = data.filter(m => m.nivel_riesgo === 'Crítico').length;
  const altos = data.filter(m => m.nivel_riesgo === 'Alto').length;
  const sinEventos = data.filter(m => m.sin_eventos_reportados).length;
  const avgIrca = data.length ? data.reduce((s, m) => s + m.iraa_score, 0) / data.length : 0;

  const cards = [
    { label: 'Total municipios', value: data.length, color: 'text-primary' },
    { label: 'Críticos', value: criticos, color: 'text-risk-critico' },
    { label: 'Alto riesgo', value: altos, color: 'text-risk-alto' },
    { label: 'Sin eventos reportados', value: sinEventos, color: 'text-risk-medio', icon: true },
    { label: 'IRCA promedio', value: avgIrca.toFixed(2), color: 'text-primary' },
  ];

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4 px-6 py-4">
      {cards.map(c => (
        <div key={c.label} className="bg-card rounded-lg p-4 border border-border">
          <div className={`text-3xl font-bold ${c.color} flex items-center gap-2`}>
            {c.icon && <AlertTriangle className="w-6 h-6" />}
            {c.value}
          </div>
          <div className="text-xs text-muted-foreground mt-1">{c.label}</div>
        </div>
      ))}
    </div>
  );
};

export default KpiCards;
