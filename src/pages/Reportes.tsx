import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ArrowLeft, FileText, Loader2, Download } from "lucide-react";
import { toast } from "sonner";

const DEPTOS: { code: string; name: string }[] = [
  { code: "27", name: "Chocó" }, { code: "44", name: "La Guajira" }, { code: "52", name: "Nariño" },
  { code: "94", name: "Guainía" }, { code: "97", name: "Vaupés" }, { code: "99", name: "Vichada" },
  { code: "05", name: "Antioquia" }, { code: "11", name: "Bogotá D.C." }, { code: "76", name: "Valle del Cauca" },
  { code: "13", name: "Bolívar" }, { code: "47", name: "Magdalena" },
];

export default function Reportes() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [reportes, setReportes] = useState<any[]>([]);
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    if (!loading && !user) navigate("/auth");
  }, [user, loading, navigate]);

  useEffect(() => { if (user) load(); }, [user]);

  const load = async () => {
    const { data } = await supabase
      .from("reportes").select("*").order("created_at", { ascending: false }).limit(50);
    setReportes(data ?? []);
  };

  const generar = async (depto_code: string, depto_nombre: string) => {
    setBusy(depto_code);
    try {
      const { data, error } = await supabase.functions.invoke("reporte-ejecutivo", {
        body: { depto_code, depto_nombre },
      });
      if (error) throw error;
      toast.success(`Reporte generado: ${depto_nombre}`);
      if (data.url) window.open(data.url, "_blank");
      await load();
    } catch (e: any) {
      toast.error("Falló", { description: e.message });
    } finally { setBusy(null); }
  };

  if (loading) return <div className="p-8 text-muted-foreground">Cargando…</div>;

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Button variant="ghost" onClick={() => navigate("/")}>
            <ArrowLeft className="w-4 h-4 mr-1" /> Volver
          </Button>
          <div>
            <h1 className="text-2xl font-bold">Reportes ejecutivos</h1>
            <p className="text-sm text-muted-foreground">Generados por el Agente Reportero (IA)</p>
          </div>
        </div>
      </div>

      <Card className="p-4 mb-6">
        <h3 className="font-bold mb-3">Generar nuevo reporte por departamento</h3>
        <div className="flex flex-wrap gap-2">
          {DEPTOS.map((d) => (
            <Button
              key={d.code} variant="outline" size="sm"
              disabled={!!busy} onClick={() => generar(d.code, d.name)}
            >
              {busy === d.code ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : <FileText className="w-3 h-3 mr-1" />}
              {d.name}
            </Button>
          ))}
        </div>
      </Card>

      <Card className="p-4">
        <h3 className="font-bold mb-3">Mis reportes ({reportes.length})</h3>
        {reportes.length === 0 ? (
          <p className="text-sm text-muted-foreground">Aún no has generado reportes.</p>
        ) : (
          <div className="space-y-2">
            {reportes.map((r) => (
              <div key={r.id} className="flex items-center justify-between border-b border-border pb-2">
                <div>
                  <div className="font-semibold text-sm">{r.titulo}</div>
                  <div className="text-xs text-muted-foreground">
                    {new Date(r.created_at).toLocaleString("es-CO")} · {r.tipo}
                  </div>
                </div>
                {r.pdf_url && (
                  <Button size="sm" variant="outline" asChild>
                    <a href={r.pdf_url} target="_blank" rel="noreferrer">
                      <Download className="w-3 h-3 mr-1" /> Abrir
                    </a>
                  </Button>
                )}
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
