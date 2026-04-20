import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ArrowLeft, Activity, AlertTriangle, FileText, ShieldCheck, Loader2, Play } from "lucide-react";
import { toast } from "sonner";

interface Run {
  id: string; agente: string; trigger: string; status: string;
  duracion_ms: number | null; created_at: string; error: string | null;
  output: any; herramientas_usadas: any;
}

export default function Admin() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [runs, setRuns] = useState<Run[]>([]);
  const [alertas, setAlertas] = useState<any[]>([]);
  const [validaciones, setValidaciones] = useState<any[]>([]);
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    if (!loading && !user) navigate("/auth");
  }, [user, loading, navigate]);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data } = await supabase.from("user_roles").select("role").eq("user_id", user.id);
      const adm = (data ?? []).some((r) => r.role === "admin");
      setIsAdmin(adm);
      if (adm) refresh();
    })();
  }, [user]);

  const refresh = async () => {
    const [r, a, v] = await Promise.all([
      supabase.from("agent_runs").select("*").order("created_at", { ascending: false }).limit(30),
      supabase.from("alertas").select("*").order("created_at", { ascending: false }).limit(20),
      supabase.from("validaciones").select("*").order("created_at", { ascending: false }).limit(20),
    ]);
    setRuns((r.data as any) ?? []);
    setAlertas(a.data ?? []);
    setValidaciones(v.data ?? []);
  };

  const trigger = async (fn: string, body: any = {}) => {
    setBusy(fn);
    try {
      const { data, error } = await supabase.functions.invoke(fn, { body });
      if (error) throw error;
      toast.success(`${fn}: OK`, { description: JSON.stringify(data).slice(0, 120) });
      await refresh();
    } catch (e: any) {
      toast.error(`${fn} falló`, { description: e.message });
    } finally {
      setBusy(null);
    }
  };

  const becomeAdmin = async () => {
    // Solo permitido si NO existe ningún admin todavía (bootstrap)
    const { count } = await supabase.from("user_roles").select("*", { count: "exact", head: true }).eq("role", "admin");
    if ((count ?? 0) > 0) {
      toast.error("Ya existe un admin. Pídele que te asigne el rol.");
      return;
    }
    const { error } = await supabase.from("user_roles").insert({ user_id: user!.id, role: "admin" });
    if (error) toast.error(error.message);
    else { toast.success("Eres admin"); window.location.reload(); }
  };

  if (loading || isAdmin === null) return <div className="p-8 text-muted-foreground">Cargando…</div>;

  if (!isAdmin) {
    return (
      <div className="min-h-screen bg-background p-8">
        <Button variant="ghost" onClick={() => navigate("/")} className="mb-4">
          <ArrowLeft className="w-4 h-4 mr-1" /> Volver
        </Button>
        <Card className="p-6 max-w-md mx-auto text-center">
          <ShieldCheck className="w-10 h-10 mx-auto text-primary mb-2" />
          <h2 className="text-lg font-bold">Panel restringido</h2>
          <p className="text-sm text-muted-foreground mb-4">
            Solo administradores pueden acceder. Si eres el primer usuario, puedes auto-asignarte el rol.
          </p>
          <Button onClick={becomeAdmin}>Auto-asignarme admin (solo si nadie lo es)</Button>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Button variant="ghost" onClick={() => navigate("/")}>
            <ArrowLeft className="w-4 h-4 mr-1" /> Volver
          </Button>
          <h1 className="text-2xl font-bold">Panel de Agentes</h1>
        </div>
        <Button variant="outline" onClick={refresh}>Refrescar</Button>
      </div>

      <div className="grid md:grid-cols-4 gap-3 mb-6">
        {[
          { fn: "snapshot-irca", label: "Snapshot IRCA", icon: Activity, color: "text-primary" },
          { fn: "vigia-monitor", label: "Agente Vigía", icon: AlertTriangle, color: "text-amber-500" },
          { fn: "validador-cross", label: "Agente Validador", icon: ShieldCheck, color: "text-emerald-500" },
          { fn: "reporte-ejecutivo", label: "Reporte (Chocó)", icon: FileText, color: "text-violet-500", body: { depto_code: "27", depto_nombre: "Chocó" } },
        ].map((b) => (
          <Card key={b.fn} className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <b.icon className={`w-4 h-4 ${b.color}`} />
              <h3 className="text-sm font-semibold">{b.label}</h3>
            </div>
            <Button
              size="sm" className="w-full"
              disabled={!!busy}
              onClick={() => trigger(b.fn, b.body ?? {})}
            >
              {busy === b.fn ? <Loader2 className="w-3 h-3 animate-spin" /> : <><Play className="w-3 h-3 mr-1" /> Ejecutar</>}
            </Button>
          </Card>
        ))}
      </div>

      <div className="grid lg:grid-cols-3 gap-4">
        <Card className="p-4">
          <h3 className="font-bold mb-3">Últimas ejecuciones</h3>
          <div className="space-y-2 max-h-96 overflow-y-auto">
            {runs.map((r) => (
              <div key={r.id} className="text-xs border-b border-border pb-2">
                <div className="flex justify-between">
                  <span className="font-semibold">{r.agente}</span>
                  <span className={r.status === "success" ? "text-emerald-500" : r.status === "error" ? "text-destructive" : "text-amber-500"}>
                    {r.status}
                  </span>
                </div>
                <div className="text-muted-foreground">{new Date(r.created_at).toLocaleString("es-CO")} · {r.duracion_ms}ms</div>
                {r.error && <div className="text-destructive mt-1">{r.error.slice(0, 100)}</div>}
              </div>
            ))}
          </div>
        </Card>

        <Card className="p-4">
          <h3 className="font-bold mb-3">Alertas recientes</h3>
          <div className="space-y-2 max-h-96 overflow-y-auto">
            {alertas.length === 0 && <p className="text-xs text-muted-foreground">Sin alertas aún. Necesita 2 snapshots.</p>}
            {alertas.map((a) => (
              <div key={a.id} className="text-xs border-b border-border pb-2">
                <div className="font-semibold">{a.titulo}</div>
                <div className="text-muted-foreground">[{a.severidad}] {a.descripcion}</div>
              </div>
            ))}
          </div>
        </Card>

        <Card className="p-4">
          <h3 className="font-bold mb-3">Validaciones</h3>
          <div className="space-y-2 max-h-96 overflow-y-auto">
            {validaciones.length === 0 && <p className="text-xs text-muted-foreground">Sin anomalías detectadas.</p>}
            {validaciones.map((v) => (
              <div key={v.id} className="text-xs border-b border-border pb-2">
                <div className="font-semibold">{v.tipo_anomalia} <span className="text-muted-foreground">[{v.fuente}]</span></div>
                <div className="text-muted-foreground">{v.descripcion}</div>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}
