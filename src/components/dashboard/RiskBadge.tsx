import { RISK_COLORS } from '@/types/municipio';

const RiskBadge = ({ nivel }: { nivel: string }) => (
  <span
    className="inline-block px-2 py-0.5 rounded text-xs font-semibold"
    style={{ backgroundColor: RISK_COLORS[nivel] || '#888', color: '#fff' }}
  >
    {nivel}
  </span>
);

export default RiskBadge;
