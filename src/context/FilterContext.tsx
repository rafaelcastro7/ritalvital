import React, { createContext, useContext, useMemo, useState, useCallback } from 'react';
import type { Municipio, RiskLevel } from '@/types/municipio';
import { RISK_LEVELS } from '@/types/municipio';

export type SortKey =
  | 'iraa_score'
  | 'municipio'
  | 'depto'
  | 'poblacion'
  | 'camas_por_1000_hab'
  | 'total_eventos';

export interface FilterState {
  riskLevels: Set<RiskLevel>;       // niveles activos
  search: string;                   // texto: municipio o depto
  depto: string;                    // 'all' o código de depto
  onlyLowConf: boolean;
  populationRange: [number, number]; // min, max
  sortKey: SortKey;
  sortAsc: boolean;
}

interface Ctx {
  state: FilterState;
  filtered: Municipio[];
  raw: Municipio[];
  deptos: { cod: string; nom: string; count: number }[];
  populationBounds: [number, number];
  toggleRisk: (n: RiskLevel) => void;
  setRisks: (risks: RiskLevel[]) => void;
  setSearch: (s: string) => void;
  setDepto: (d: string) => void;
  setOnlyLowConf: (b: boolean) => void;
  setPopulationRange: (r: [number, number]) => void;
  setSort: (k: SortKey, asc?: boolean) => void;
  resetFilters: () => void;
}

const FilterCtx = createContext<Ctx | null>(null);

const RISK_ORDER: Record<RiskLevel, number> = { 'Crítico': 4, 'Alto': 3, 'Medio': 2, 'Bajo': 1 };

const initialState = (bounds: [number, number]): FilterState => ({
  riskLevels: new Set(RISK_LEVELS),
  search: '',
  depto: 'all',
  onlyLowConf: false,
  populationRange: bounds,
  sortKey: 'iraa_score',
  sortAsc: false,
});

export function FilterProvider({
  data,
  children,
}: {
  data: Municipio[];
  children: React.ReactNode;
}) {
  const populationBounds = useMemo<[number, number]>(() => {
    if (!data.length) return [0, 0];
    let min = Infinity, max = -Infinity;
    for (const m of data) {
      if (m.poblacion < min) min = m.poblacion;
      if (m.poblacion > max) max = m.poblacion;
    }
    return [Math.floor(min), Math.ceil(max)];
  }, [data]);

  const [state, setState] = useState<FilterState>(() => initialState(populationBounds));

  // Re-alinear bounds cuando cambian los datos (auto-expand range si era full)
  React.useEffect(() => {
    setState(s => ({
      ...s,
      populationRange:
        s.populationRange[0] === 0 && s.populationRange[1] === 0
          ? populationBounds
          : s.populationRange,
    }));
  }, [populationBounds]);

  const deptos = useMemo(() => {
    const map = new Map<string, { cod: string; nom: string; count: number }>();
    for (const m of data) {
      const k = m.cod_depto;
      const cur = map.get(k);
      if (cur) cur.count++;
      else map.set(k, { cod: k, nom: m.depto, count: 1 });
    }
    return [...map.values()].sort((a, b) => a.nom.localeCompare(b.nom, 'es'));
  }, [data]);

  const filtered = useMemo(() => {
    const s = state;
    const term = s.search.trim().toLowerCase();
    let out = data.filter(m => {
      if (!s.riskLevels.has(m.nivel_riesgo)) return false;
      if (s.depto !== 'all' && m.cod_depto !== s.depto) return false;
      if (s.onlyLowConf && !m.estado_confianza.toLowerCase().includes('baja')) return false;
      if (m.poblacion < s.populationRange[0] || m.poblacion > s.populationRange[1]) return false;
      if (term) {
        const hay = `${m.municipio} ${m.depto}`.toLowerCase();
        if (!hay.includes(term)) return false;
      }
      return true;
    });

    out = [...out].sort((a, b) => {
      const k = s.sortKey;
      let va: number | string;
      let vb: number | string;
      if (k === 'municipio' || k === 'depto') {
        va = a[k]; vb = b[k];
      } else {
        va = a[k]; vb = b[k];
      }
      if (typeof va === 'string' && typeof vb === 'string') {
        return s.sortAsc ? va.localeCompare(vb, 'es') : vb.localeCompare(va, 'es');
      }
      return s.sortAsc ? (va as number) - (vb as number) : (vb as number) - (va as number);
    });
    return out;
  }, [data, state]);

  const toggleRisk = useCallback((n: RiskLevel) => {
    setState(s => {
      const next = new Set(s.riskLevels);
      if (next.has(n)) next.delete(n); else next.add(n);
      // No permitir vacío total (UX)
      if (next.size === 0) return s;
      return { ...s, riskLevels: next };
    });
  }, []);
  const setRisks = useCallback((risks: RiskLevel[]) => setState(s => ({ ...s, riskLevels: new Set(risks) })), []);
  const setSearch = useCallback((search: string) => setState(s => ({ ...s, search })), []);
  const setDepto = useCallback((depto: string) => setState(s => ({ ...s, depto })), []);
  const setOnlyLowConf = useCallback((onlyLowConf: boolean) => setState(s => ({ ...s, onlyLowConf })), []);
  const setPopulationRange = useCallback((populationRange: [number, number]) => setState(s => ({ ...s, populationRange })), []);
  const setSort = useCallback((k: SortKey, asc?: boolean) => setState(s => ({
    ...s,
    sortKey: k,
    sortAsc: asc !== undefined ? asc : (s.sortKey === k ? !s.sortAsc : false),
  })), []);
  const resetFilters = useCallback(() => setState(initialState(populationBounds)), [populationBounds]);

  // helper para sort por riesgo numérico
  void RISK_ORDER;

  const value: Ctx = {
    state, filtered, raw: data, deptos, populationBounds,
    toggleRisk, setRisks, setSearch, setDepto, setOnlyLowConf, setPopulationRange, setSort, resetFilters,
  };

  return <FilterCtx.Provider value={value}>{children}</FilterCtx.Provider>;
}

export function useFilters() {
  const ctx = useContext(FilterCtx);
  if (!ctx) throw new Error('useFilters debe usarse dentro de FilterProvider');
  return ctx;
}
