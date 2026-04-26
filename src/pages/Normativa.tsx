import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft, BookOpen, ExternalLink, Search } from "lucide-react";

interface Articulo {
  id: string;
  norma: string;
  titulo: string;
  articulo: string | null;
  contenido: string;
  url_fuente: string | null;
}

const NORMAS = ["Todas", "Resolución 2115/2007", "Resolución 3100/2019", "Ley 1751/2015", "Decreto 1575/2007"];

export default function Normativa() {
  const navigate = useNavigate();
  const [items, setItems] = useState<Articulo[]>([]);
  const [query, setQuery] = useState("");
  const [norma, setNorma] = useState("Todas");
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    if (query.trim()) {
      const { data } = await supabase.rpc("buscar_normativa_fts", {
        query_text: query,
        match_count: 30,
        filter_norma: norma === "Todas" ? undefined : norma,
      });
      setItems((data ?? []) as Articulo[]);
    } else {
      let q = supabase.from("normativa_chunks").select("id,norma,titulo,articulo,contenido,url_fuente").order("norma").limit(100);
      if (norma !== "Todas") q = q.eq("norma", norma);
      const { data } = await q;
      setItems((data ?? []) as Articulo[]);
    }
    setLoading(false);
  };

  useEffect(() => { load(); }, [norma]);

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => navigate("/")}>
            <ArrowLeft className="w-4 h-4 mr-1" /> Volver
          </Button>
          <div>
            <h1 className="text-lg font-bold flex items-center gap-2">
              <BookOpen className="w-4 h-4 text-primary" /> Normativa de salud
            </h1>
            <p className="text-[11px] text-muted-foreground">
              Marco normativo colombiano consultable · {items.length} artículos
            </p>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto p-6 space-y-4">
        <Card>
          <CardContent className="p-4 space-y-3">
            <form
              onSubmit={(e) => { e.preventDefault(); load(); }}
              className="flex gap-2"
            >
              <div className="relative flex-1">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Buscar artículos (ej: vigilancia, IRCA, derecho fundamental)..."
                  className="pl-9"
                />
              </div>
              <Button type="submit">Buscar</Button>
            </form>
            <div className="flex flex-wrap gap-2">
              {NORMAS.map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => setNorma(n)}
                  className={`text-[11px] px-2.5 py-1 rounded-full transition ${
                    norma === n
                      ? "bg-primary text-primary-foreground"
                      : "bg-secondary text-secondary-foreground hover:bg-accent"
                  }`}
                >
                  {n}
                </button>
              ))}
            </div>
          </CardContent>
        </Card>

        {loading && <p className="text-sm text-muted-foreground">Cargando…</p>}
        {!loading && items.length === 0 && (
          <Card><CardContent className="p-6 text-sm text-muted-foreground text-center">
            No se encontraron resultados.
          </CardContent></Card>
        )}

        <div className="space-y-3">
          {items.map((a) => (
            <Card key={a.id}>
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-[10px] uppercase tracking-wider text-primary font-semibold">{a.norma}</p>
                    <CardTitle className="text-base">{a.articulo ?? a.titulo}</CardTitle>
                    {a.articulo && <p className="text-xs text-muted-foreground mt-0.5">{a.titulo}</p>}
                  </div>
                  {a.url_fuente && (
                    <a
                      href={a.url_fuente}
                      target="_blank"
                      rel="noreferrer"
                      className="text-[11px] text-primary hover:underline flex items-center gap-1 shrink-0"
                    >
                      Fuente <ExternalLink className="w-3 h-3" />
                    </a>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-sm leading-relaxed whitespace-pre-line text-foreground/90">
                  {a.contenido.length > 600 ? a.contenido.slice(0, 600) + "…" : a.contenido}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      </main>
    </div>
  );
}
