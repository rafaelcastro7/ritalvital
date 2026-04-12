import { useEffect, useState } from "react";
import type { Reporte } from "@/lib/reportes";
import { getReportes } from "@/lib/reportes";

export default function ReportesPanel({ municipio }: { municipio?: string }) {
  const [reportes, setReportes] = useState<Reporte[]>([]);

  useEffect(() => {
    getReportes(municipio).then(setReportes);
  }, [municipio]);

  if (!reportes.length) {
    return (
      <div className="text-xs text-muted-foreground italic">
        Sin reportes recientes para este municipio.
      </div>
    );
  }

  return (
    <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
      {reportes.map((r) => (
        <div key={r.id} className="border border-border rounded-lg p-2 text-xs bg-secondary/30">
          <div className="font-semibold text-foreground">{r.tipo}</div>
          <div className="text-muted-foreground mt-0.5">{r.descripcion}</div>
          <div className="text-muted-foreground mt-1 text-[10px]">
            {r.municipio} — {new Date(r.created_at).toLocaleString("es-CO")}
          </div>
        </div>
      ))}
    </div>
  );
}
