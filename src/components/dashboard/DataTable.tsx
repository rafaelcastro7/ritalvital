import { useMemo } from 'react';
import { Download } from 'lucide-react';
import type { Municipio } from '@/types/municipio';
import { useFilters, type SortKey } from '@/context/FilterContext';
import RiskBadge from './RiskBadge';

interface Props {
  onSelect: (m: Municipio) => void;
}

const COLS: { key: SortKey; label: string }[] = [
  { key: 'municipio', label: 'Municipio' },
  { key: 'depto', label: 'Depto' },
  { key: 'iraa_score', label: 'IRCA' },
  { key: 'poblacion', label: 'Población' },
  { key: 'camas_por_1000_hab', label: 'Camas/1k' },
  { key: 'total_eventos', label: 'Eventos' },
];

function downloadCSV(data: Municipio[]) {
  const headers = [
    'cod_municipio', 'municipio', 'depto', 'cod_depto', 'poblacion',
    'camas_totales', 'camas_por_1000_hab', 'total_eventos', 'severidad_vial',
    'iraa_score', 'nivel_riesgo', 'estado_confianza', 'recomendacion',
  ];
  const esc = (v: unknown) => {
    const s = String(v ?? '');
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const lines = [
    headers.join(','),
    ...data.map(r => headers.map(h => esc((r as unknown as Record<string, unknown>)[h])).join(',')),
  ];
  const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `rutavital_municipios_${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

const DataTable = ({ onSelect }: Props) => {
  const { filtered, state, setSort } = useFilters();

  // Limitar render a 200 filas para performance — si el usuario quiere más, exporta CSV
  const display = useMemo(() => filtered.slice(0, 200), [filtered]);

  const th = (label: string, key: SortKey) => (
    <th
      key={key}
      className="text-left px-3 py-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground cursor-pointer hover:text-foreground select-none whitespace-nowrap"
      onClick={() => setSort(key)}
      scope="col"
    >
      {label} {state.sortKey === key ? (state.sortAsc ? '↑' : '↓') : ''}
    </th>
  );

  return (
    <div className="px-6 pb-6">
      <div className="flex flex-wrap items-center gap-3 mb-3">
        <h3 className="text-sm font-semibold">Detalle por municipio</h3>
        <span className="text-xs text-muted-foreground">
          {filtered.length.toLocaleString('es-CO')} resultados
          {filtered.length > display.length && ` · mostrando primeros ${display.length}`}
        </span>
        <button
          type="button"
          onClick={() => downloadCSV(filtered)}
          disabled={!filtered.length}
          className="ml-auto flex items-center gap-1.5 text-xs bg-secondary hover:bg-accent text-secondary-foreground px-3 py-1.5 rounded-md transition disabled:opacity-50"
          title="Descargar resultados filtrados"
        >
          <Download className="w-3.5 h-3.5" />
          Exportar CSV
        </button>
      </div>

      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="w-full text-sm">
          <thead className="bg-secondary/50 sticky top-0 z-10">
            <tr>
              {COLS.map(c => th(c.label, c.key))}
              <th className="text-left px-3 py-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Nivel</th>
              <th className="text-left px-3 py-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Confianza</th>
            </tr>
          </thead>
          <tbody>
            {display.map(m => (
              <tr
                key={m.cod_municipio}
                onClick={() => onSelect(m)}
                className="border-t border-border hover:bg-accent/40 cursor-pointer transition-colors"
              >
                <td className="px-3 py-2 font-medium">{m.municipio}{m.poblacion_imputada ? ' *' : ''}</td>
                <td className="px-3 py-2 text-muted-foreground text-xs">{m.depto}</td>
                <td className="px-3 py-2">
                  <div className="flex items-center gap-2">
                    <div className="w-14 h-1.5 rounded-full bg-secondary overflow-hidden">
                      <div className="h-full rounded-full bg-primary" style={{ width: `${m.iraa_score * 100}%` }} />
                    </div>
                    <span className="text-xs tabular-nums">{(m.iraa_score * 100).toFixed(0)}</span>
                  </div>
                </td>
                <td className="px-3 py-2 text-xs tabular-nums">{m.poblacion.toLocaleString('es-CO')}</td>
                <td className="px-3 py-2 text-xs tabular-nums">{m.camas_por_1000_hab.toFixed(2)}</td>
                <td className="px-3 py-2 text-xs tabular-nums">{m.total_eventos}</td>
                <td className="px-3 py-2"><RiskBadge nivel={m.nivel_riesgo} /></td>
                <td className="px-3 py-2 text-xs">{m.estado_confianza.toLowerCase().includes('baja') ? '⚠ Baja' : 'Alta'}</td>
              </tr>
            ))}
            {display.length === 0 && (
              <tr>
                <td colSpan={8} className="px-3 py-10 text-center text-sm text-muted-foreground">
                  No hay municipios con los filtros actuales.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default DataTable;
