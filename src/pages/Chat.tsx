import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import ReactMarkdown from "react-markdown";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { ArrowLeft, Send, Loader2, Bot, User, Wrench, Plus } from "lucide-react";

interface Mensaje {
  id: string;
  role: string;
  content: string;
  tool_name?: string | null;
  created_at: string;
}

interface Conv {
  id: string;
  titulo: string;
  updated_at: string;
}

export default function Chat() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [convs, setConvs] = useState<Conv[]>([]);
  const [convId, setConvId] = useState<string | null>(null);
  const [mensajes, setMensajes] = useState<Mensaje[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!loading && !user) navigate("/auth");
  }, [user, loading, navigate]);

  useEffect(() => {
    if (!user) return;
    supabase
      .from("conversaciones")
      .select("id,titulo,updated_at")
      .order("updated_at", { ascending: false })
      .limit(20)
      .then(({ data }) => setConvs(data ?? []));
  }, [user]);

  useEffect(() => {
    if (!convId) {
      setMensajes([]);
      return;
    }
    supabase
      .from("mensajes")
      .select("*")
      .eq("conversacion_id", convId)
      .order("created_at")
      .then(({ data }) => setMensajes((data as any) ?? []));
  }, [convId]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [mensajes]);

  const send = async () => {
    if (!input.trim() || sending) return;
    const text = input;
    setInput("");
    setSending(true);

    // Mensaje optimista
    const optimistic: Mensaje = {
      id: `tmp-${Date.now()}`, role: "user", content: text, created_at: new Date().toISOString(),
    };
    setMensajes((prev) => [...prev, optimistic]);

    try {
      const { data, error } = await supabase.functions.invoke("chat-analista", {
        body: { conversacion_id: convId, message: text },
      });
      if (error) throw error;
      const newConvId = data.conversacion_id;
      setConvId(newConvId);
      // Recargar mensajes
      const { data: msgs } = await supabase
        .from("mensajes").select("*").eq("conversacion_id", newConvId).order("created_at");
      setMensajes((msgs as any) ?? []);
      // Refrescar lista
      const { data: cs } = await supabase
        .from("conversaciones").select("id,titulo,updated_at").order("updated_at", { ascending: false }).limit(20);
      setConvs(cs ?? []);
    } catch (e: any) {
      setMensajes((prev) => [...prev, {
        id: `err-${Date.now()}`, role: "assistant",
        content: `⚠️ Error: ${e.message || "no se pudo procesar"}`,
        created_at: new Date().toISOString(),
      }]);
    } finally {
      setSending(false);
    }
  };

  if (loading) return <div className="p-8 text-muted-foreground">Cargando…</div>;

  return (
    <div className="h-screen flex flex-col bg-background">
      <header className="border-b border-border px-4 py-3 flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={() => navigate("/")}>
          <ArrowLeft className="w-4 h-4 mr-1" /> Volver
        </Button>
        <div>
          <h1 className="font-bold text-lg">Analista RutaVital</h1>
          <p className="text-xs text-muted-foreground">Copiloto agéntico de salud pública</p>
        </div>
      </header>

      <div className="flex-1 flex overflow-hidden">
        <aside className="w-64 border-r border-border bg-secondary/20 flex flex-col">
          <div className="p-3">
            <Button size="sm" className="w-full" onClick={() => { setConvId(null); setMensajes([]); }}>
              <Plus className="w-4 h-4 mr-1" /> Nueva conversación
            </Button>
          </div>
          <div className="flex-1 overflow-y-auto px-2 pb-2 space-y-1">
            {convs.map((c) => (
              <button
                key={c.id}
                onClick={() => setConvId(c.id)}
                className={`w-full text-left px-3 py-2 rounded-md text-sm truncate transition ${
                  convId === c.id ? "bg-primary/15 text-primary" : "hover:bg-secondary"
                }`}
              >
                {c.titulo}
              </button>
            ))}
          </div>
        </aside>

        <main className="flex-1 flex flex-col">
          <div className="flex-1 overflow-y-auto p-6 space-y-4">
            {mensajes.length === 0 && (
              <div className="max-w-2xl mx-auto text-center pt-12">
                <Bot className="w-12 h-12 mx-auto text-primary mb-3" />
                <h2 className="text-xl font-bold mb-2">¿En qué te ayudo hoy?</h2>
                <p className="text-sm text-muted-foreground mb-6">
                  Pregunta sobre IRCA municipal, compara territorios, consulta tendencias y alertas activas.
                </p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-left max-w-xl mx-auto">
                  {[
                    "¿Cuáles son los 10 municipios con mayor IRCA hoy?",
                    "Compara Quibdó, Tumaco y Buenaventura",
                    "Muéstrame la tendencia de IRCA en Riosucio (Chocó)",
                    "¿Qué alertas críticas hay en Chocó esta semana?",
                  ].map((p) => (
                    <button
                      key={p}
                      onClick={() => setInput(p)}
                      className="border border-border rounded-lg p-3 text-sm hover:bg-secondary text-left"
                    >
                      {p}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {mensajes.filter((m) => m.role !== "tool").map((m) => (
              <div key={m.id} className={`flex gap-3 ${m.role === "user" ? "justify-end" : ""}`}>
                {m.role !== "user" && (
                  <div className="w-8 h-8 rounded-full bg-primary/15 text-primary flex items-center justify-center shrink-0">
                    <Bot className="w-4 h-4" />
                  </div>
                )}
                <Card className={`p-3 max-w-[75%] ${m.role === "user" ? "bg-primary text-primary-foreground" : ""}`}>
                  <div className="prose prose-sm dark:prose-invert max-w-none">
                    <ReactMarkdown>{m.content}</ReactMarkdown>
                  </div>
                </Card>
                {m.role === "user" && (
                  <div className="w-8 h-8 rounded-full bg-secondary flex items-center justify-center shrink-0">
                    <User className="w-4 h-4" />
                  </div>
                )}
              </div>
            ))}
            {mensajes.some((m) => m.role === "tool") && (
              <div className="text-xs text-muted-foreground flex items-center gap-1 ml-11">
                <Wrench className="w-3 h-3" /> Herramientas usadas: {mensajes.filter((m) => m.role === "tool").length}
              </div>
            )}
            {sending && (
              <div className="flex gap-3 items-center text-sm text-muted-foreground">
                <Loader2 className="w-4 h-4 animate-spin" /> Pensando…
              </div>
            )}
            <div ref={endRef} />
          </div>

          <div className="border-t border-border p-4">
            <form
              onSubmit={(e) => { e.preventDefault(); send(); }}
              className="flex gap-2 max-w-3xl mx-auto"
            >
              <Input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Pregunta sobre IRCA, alertas o municipios…"
                disabled={sending}
                className="flex-1"
              />
              <Button type="submit" disabled={sending || !input.trim()}>
                <Send className="w-4 h-4" />
              </Button>
            </form>
            <p className="text-[10px] text-muted-foreground text-center mt-2">
              IA: gemini-2.5-flash · Datos: snapshot diario IRCA · Validar siempre con equipo territorial
            </p>
          </div>
        </main>
      </div>
    </div>
  );
}
