import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AlertTriangle, X } from "lucide-react";

interface Alerta {
  id: string; titulo: string; descripcion: string | null;
  severidad: string; muni_code: string | null; created_at: string;
}

const SEV_COLOR: Record<string, string> = {
  critica: "bg-red-900/30 border-red-700 text-red-200",
  alta: "bg-red-500/20 border-red-500/40 text-red-300",
  media: "bg-amber-500/20 border-amber-500/40 text-amber-300",
  baja: "bg-blue-500/20 border-blue-500/40 text-blue-300",
  info: "bg-secondary border-border text-muted-foreground",
};

export default function AlertasBanner() {
  const [alertas, setAlertas] = useState<Alerta[]>([]);
  const [hidden, setHidden] = useState(false);

  useEffect(() => {
    supabase
      .from("alertas")
      .select("id,titulo,descripcion,severidad,muni_code,created_at")
      .in("severidad", ["alta", "critica"])
      .gte("created_at", new Date(Date.now() - 7 * 86400000).toISOString())
      .order("created_at", { ascending: false })
      .limit(5)
      .then(({ data }) => setAlertas((data as any) ?? []));

    const ch = supabase
      .channel("alertas-banner")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "alertas" }, (payload) => {
        const a = payload.new as Alerta;
        if (a.severidad === "alta" || a.severidad === "critica") {
          setAlertas((p) => [a, ...p].slice(0, 5));
          setHidden(false);
        }
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, []);

  if (hidden || alertas.length === 0) return null;

  return (
    <div className="border-b border-border bg-secondary/50 px-4 py-2 flex items-start gap-3">
      <AlertTriangle className="w-4 h-4 text-amber-500 mt-1 shrink-0" />
      <div className="flex-1 flex flex-wrap gap-2 items-center text-xs">
        <span className="font-bold">{alertas.length} alerta{alertas.length > 1 ? "s" : ""} reciente{alertas.length > 1 ? "s" : ""}:</span>
        {alertas.slice(0, 3).map((a) => (
          <span key={a.id} className={`px-2 py-0.5 rounded-full border ${SEV_COLOR[a.severidad] ?? SEV_COLOR.info}`}>
            {a.titulo}
          </span>
        ))}
        {alertas.length > 3 && <span className="text-muted-foreground">+{alertas.length - 3} más</span>}
      </div>
      <button onClick={() => setHidden(true)} className="text-muted-foreground hover:text-foreground">
        <X className="w-4 h-4" />
      </button>
    </div>
  );
}
