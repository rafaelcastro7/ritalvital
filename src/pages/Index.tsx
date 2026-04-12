import { useState, useEffect } from 'react';
import Papa from 'papaparse';
import type { Municipio } from '@/types/municipio';
import DashboardHeader from '@/components/dashboard/DashboardHeader';
import AboutModal from '@/components/dashboard/AboutModal';
import KpiCards from '@/components/dashboard/KpiCards';
import RiskMap from '@/components/dashboard/RiskMap';
import MapLegend from '@/components/dashboard/MapLegend';
import RiskDistributionChart from '@/components/dashboard/RiskDistributionChart';
import DetailPanel from '@/components/dashboard/DetailPanel';
import DataTable from '@/components/dashboard/DataTable';
import DashboardFooter from '@/components/dashboard/DashboardFooter';

const parseBool = (v: string) => v === 'True' || v === 'true';

const Index = () => {
  const [data, setData] = useState<Municipio[]>([]);
  const [selected, setSelected] = useState<Municipio | null>(null);
  const [aboutOpen, setAboutOpen] = useState(false);

  useEffect(() => {
    fetch('/data/municipios_riesgo.csv')
      .then(r => r.text())
      .then(text => {
        const result = Papa.parse(text, { header: true, skipEmptyLines: true });
        const rows: Municipio[] = (result.data as Record<string, string>[]).map(r => ({
          cod_municipio: Number(r.cod_municipio),
          municipio: r.municipio,
          depto: r.depto,
          poblacion: Number(r.poblacion),
          poblacion_imputada: parseBool(r.poblacion_imputada),
          camas_totales: Number(r.camas_totales),
          camas_por_1000_hab: Number(r.camas_por_1000_hab),
          total_eventos: Number(r.total_eventos),
          severidad_vial: Number(r.severidad_vial),
          expuestos: parseBool(r.expuestos),
          sin_eventos_reportados: parseBool(r.sin_eventos_reportados),
          pctl_vuln_salud: Number(r.pctl_vuln_salud),
          pctl_exposicion: Number(r.pctl_exposicion),
          pctl_severidad: Number(r.pctl_severidad),
          iraa_score: Number(r.iraa_score),
          nivel_riesgo: r.nivel_riesgo as Municipio['nivel_riesgo'],
          estado_confianza: r.estado_confianza,
          recomendacion: r.recomendacion,
        }));
        setData(rows);
      });
  }, []);

  if (!data.length) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-muted-foreground animate-pulse">Cargando datos…</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col">
      <DashboardHeader totalMunicipios={data.length} pipelineDate="2026-04-12" onAboutOpen={() => setAboutOpen(true)} />
      <AboutModal open={aboutOpen} onClose={() => setAboutOpen(false)} />
      <KpiCards data={data} />

      <div className="flex-1 px-6 pb-4 flex flex-col lg:flex-row gap-4">
        <div className="flex-1 flex flex-col gap-4">
          <div className="relative flex-1 min-h-[400px] rounded-lg overflow-hidden border border-border">
            <RiskMap data={data} onSelect={setSelected} selected={selected} />
            <MapLegend />
          </div>
          <RiskDistributionChart data={data} />
        </div>
        {selected && (
          <DetailPanel municipio={selected} onClose={() => setSelected(null)} />
        )}
      </div>

      <DataTable data={data} onSelect={setSelected} />
      <DashboardFooter />
    </div>
  );
};

export default Index;
