import { X, AlertTriangle } from 'lucide-react';
import type { Municipio } from '@/types/municipio';
import { RISK_COLORS } from '@/types/municipio';
import RiskBadge from './RiskBadge';

interface Props {
  municipio: Municipio;
  onClose: () => void;
}

const Bar = ({ label, value }: { label: string; value: number }) => (
  <div className="mb-3">
    <div className="flex justify-between text-xs text-muted-foreground mb-1">
      <span>{label}</span>
      <span>{(value * 100).toFixed(0)}%</span>
    </div>
    <div className="h-2 rounded-full bg-secondary overflow-hidden">
      <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${value * 100}%` }} />
    </div>
  </div>
);

const DetailPanel = ({ municipio: m, onClose }: Props) => {
  const lowConf = m.estado_confianza.toLowerCase().includes('baja');

  return (
    <div className="bg-card border-l border-border w-full lg:w-96 p-5 overflow-y-auto max-h-[calc(100vh-200px)]">
      <div className="flex justify-between items-start mb-4">
        <div>
          <h2 className="text-lg font-bold">{m.municipio}</h2>
          <RiskBadge nivel={m.nivel_riesgo} />
        </div>
        <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
          <X className="w-5 h-5" />
        </button>
      </div>

      {lowConf && (
        <div className="flex items-start gap-2 bg-risk-medio/15 border border-risk-medio/30 rounded-lg p-3 mb-4 text-xs">
          <AlertTriangle className="w-4 h-4 text-risk-medio shrink-0 mt-0.5" />
          <span>Confianza baja — posible subregistro. Validación requerida.</span>
        </div>
      )}

      <div className="text-center mb-5">
        <div className="text-4xl font-bold" style={{ color: RISK_COLORS[m.nivel_riesgo] }}>
          {(m.iraa_score * 100).toFixed(1)}
        </div>
        <div className="text-xs text-muted-foreground">Índice IRCA (0–100)</div>
      </div>

      <Bar label="Vulnerabilidad sanitaria" value={m.pctl_vuln_salud} />
      <Bar label="Exposición histórica" value={m.pctl_exposicion} />
      <Bar label="Severidad vial" value={m.pctl_severidad} />

      <div className="mt-5 space-y-2 text-sm">
        <Row label="Población" value={m.poblacion.toLocaleString()} />
        <Row label="Camas totales" value={m.camas_totales} />
        <Row label="Camas / 1000 hab" value={m.camas_por_1000_hab.toFixed(2)} />
        <Row label="Total eventos" value={m.total_eventos} />
        <Row label="Severidad vial" value={m.severidad_vial.toFixed(1)} />
      </div>

      <div
        className="mt-5 p-3 rounded-lg text-sm border"
        style={{
          borderColor: RISK_COLORS[m.nivel_riesgo] + '55',
          backgroundColor: RISK_COLORS[m.nivel_riesgo] + '15',
        }}
      >
        <div className="font-semibold text-xs mb-1">Recomendación operativa</div>
        {m.recomendacion}
      </div>
    </div>
  );
};

const Row = ({ label, value }: { label: string; value: string | number }) => (
  <div className="flex justify-between border-b border-border pb-1">
    <span className="text-muted-foreground">{label}</span>
    <span className="font-medium">{value}</span>
  </div>
);

export default DetailPanel;
