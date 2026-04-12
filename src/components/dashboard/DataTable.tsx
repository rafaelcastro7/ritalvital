import { useState, useMemo } from 'react';
import type { Municipio } from '@/types/municipio';
import RiskBadge from './RiskBadge';

interface Props {
  data: Municipio[];
  onSelect: (m: Municipio) => void;
}

type SortKey = 'municipio' | 'iraa_score' | 'nivel_riesgo' | 'camas_por_1000_hab' | 'total_eventos' | 'severidad_vial' | 'estado_confianza';

const RISK_ORDER: Record<string, number> = { 'Crítico': 4, Alto: 3, Medio: 2, Bajo: 1 };

const DataTable = ({ data, onSelect }: Props) => {
  const [filterRisk, setFilterRisk] = useState<string>('');
  const [onlyLowConf, setOnlyLowConf] = useState(false);
  const [sortKey, setSortKey] = useState<SortKey>('iraa_score');
  const [sortAsc, setSortAsc] = useState(false);

  const filtered = useMemo(() => {
    let d = [...data];
    if (filterRisk) d = d.filter(m => m.nivel_riesgo === filterRisk);
    if (onlyLowConf) d = d.filter(m => m.estado_confianza.toLowerCase().includes('baja'));
    d.sort((a, b) => {
      let va: number | string = a[sortKey] as any;
      let vb: number | string = b[sortKey] as any;
      if (sortKey === 'nivel_riesgo') { va = RISK_ORDER[va as string] || 0; vb = RISK_ORDER[vb as string] || 0; }
      if (typeof va === 'string') return sortAsc ? (va as string).localeCompare(vb as string) : (vb as string).localeCompare(va as string);
      return sortAsc ? (va as number) - (vb as number) : (vb as number) - (va as number);
    });
    return d;
  }, [data, filterRisk, onlyLowConf, sortKey, sortAsc]);

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) setSortAsc(!sortAsc);
    else { setSortKey(key); setSortAsc(false); }
  };

  const th = (label: string, key: SortKey) => (
    <th
      className="text-left px-3 py-2 text-xs font-medium text-muted-foreground cursor-pointer hover:text-foreground select-none whitespace-nowrap"
      onClick={() => toggleSort(key)}
    >
      {label} {sortKey === key ? (sortAsc ? '↑' : '↓') : ''}
    </th>
  );

  return (
    <div className="px-6 pb-6">
      <div className="flex flex-wrap items-center gap-3 mb-3">
        <select
          value={filterRisk}
          onChange={e => setFilterRisk(e.target.value)}
          className="bg-secondary text-secondary-foreground text-sm rounded-md px-3 py-1.5 border border-border"
        >
          <option value="">Todos los niveles</option>
          {['Crítico', 'Alto', 'Medio', 'Bajo'].map(n => <option key={n} value={n}>{n}</option>)}
        </select>
        <label className="flex items-center gap-2 text-sm text-muted-foreground cursor-pointer">
          <input type="checkbox" checked={onlyLowConf} onChange={e => setOnlyLowConf(e.target.checked)} className="rounded" />
          Solo baja confianza
        </label>
        <span className="text-xs text-muted-foreground ml-auto">{filtered.length} municipios</span>
      </div>

      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="w-full text-sm">
          <thead className="bg-secondary/50">
            <tr>
              {th('Municipio', 'municipio')}
              {th('IRCA', 'iraa_score')}
              {th('Nivel', 'nivel_riesgo')}
              {th('Camas/1000', 'camas_por_1000_hab')}
              {th('Eventos', 'total_eventos')}
              {th('Sev. vial', 'severidad_vial')}
              {th('Confianza', 'estado_confianza')}
            </tr>
          </thead>
          <tbody>
            {filtered.map(m => (
              <tr
                key={m.cod_municipio}
                onClick={() => onSelect(m)}
                className="border-t border-border hover:bg-accent/50 cursor-pointer transition-colors"
              >
                <td className="px-3 py-2 font-medium">
                  {m.municipio}{m.poblacion_imputada ? ' *' : ''}
                </td>
                <td className="px-3 py-2">
                  <div className="flex items-center gap-2">
                    <div className="w-16 h-1.5 rounded-full bg-secondary overflow-hidden">
                      <div className="h-full rounded-full bg-primary" style={{ width: `${m.iraa_score * 100}%` }} />
                    </div>
                    <span className="text-xs">{(m.iraa_score * 100).toFixed(0)}</span>
                  </div>
                </td>
                <td className="px-3 py-2"><RiskBadge nivel={m.nivel_riesgo} /></td>
                <td className="px-3 py-2">{m.camas_por_1000_hab.toFixed(2)}</td>
                <td className="px-3 py-2">{m.total_eventos}</td>
                <td className="px-3 py-2">{m.severidad_vial.toFixed(1)}</td>
                <td className="px-3 py-2 text-xs">{m.estado_confianza.includes('Baja') ? '⚠ Baja' : 'Alta'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default DataTable;
