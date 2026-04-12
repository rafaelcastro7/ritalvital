import { supabase } from './supabase';

export interface Reporte {
  id: string;
  municipio: string;
  tipo: string;
  descripcion: string;
  created_at: string;
}

const LS_KEY = 'ritalvital_reportes';

function lsGetAll(): Reporte[] {
  try {
    return JSON.parse(localStorage.getItem(LS_KEY) ?? '[]');
  } catch {
    return [];
  }
}

function lsSave(reportes: Reporte[]) {
  localStorage.setItem(LS_KEY, JSON.stringify(reportes));
}

export async function insertReporte(
  data: Pick<Reporte, 'municipio' | 'tipo' | 'descripcion'>
): Promise<void> {
  if (supabase) {
    const { error } = await supabase.from('reportes').insert([data]);
    if (error) throw new Error(error.message);
    return;
  }
  const all = lsGetAll();
  all.unshift({
    ...data,
    id: crypto.randomUUID(),
    created_at: new Date().toISOString(),
  });
  lsSave(all);
}

export async function getReportes(municipio?: string): Promise<Reporte[]> {
  if (supabase) {
    let query = supabase
      .from('reportes')
      .select('*')
      .order('created_at', { ascending: false });
    if (municipio) query = query.eq('municipio', municipio);
    const { data } = await query;
    return (data ?? []) as Reporte[];
  }
  const all = lsGetAll();
  return municipio ? all.filter((r) => r.municipio === municipio) : all;
}
