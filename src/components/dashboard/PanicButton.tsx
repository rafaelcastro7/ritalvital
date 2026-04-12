import { useState } from "react";
import { toast } from "sonner";
import { insertReporte } from "@/lib/reportes";

export default function PanicButton({
  municipio,
  onSent,
}: {
  municipio: string;
  onSent?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [tipo, setTipo] = useState("");
  const [descripcion, setDescripcion] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await insertReporte({ municipio, tipo, descripcion });
      toast.success("Reporte enviado", {
        description: `${tipo} en ${municipio} registrado correctamente.`,
      });
      setOpen(false);
      setTipo("");
      setDescripcion("");
      onSent?.();
    } catch {
      toast.error("Error al enviar el reporte", {
        description: "Intenta nuevamente en unos segundos.",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <button
        type="button"
        className="w-full text-sm font-semibold px-3 py-2 rounded-lg bg-destructive text-destructive-foreground hover:opacity-90 transition"
        onClick={() => setOpen(true)}
      >
        🚨 Reportar evento
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
          onClick={(e) => { if (e.target === e.currentTarget) setOpen(false); }}
        >
          <form
            className="bg-card border border-border rounded-xl p-6 w-full max-w-sm shadow-xl space-y-4"
            onSubmit={handleSubmit}
          >
            <h3 className="font-bold text-base">Reportar evento en {municipio}</h3>

            <label className="block text-sm">
              <span className="text-muted-foreground">Tipo de evento</span>
              <input
                required
                autoFocus
                className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                placeholder="Ej: inundación, deslizamiento, accidente…"
                value={tipo}
                onChange={(e) => setTipo(e.target.value)}
              />
            </label>

            <label className="block text-sm">
              <span className="text-muted-foreground">Descripción</span>
              <textarea
                required
                rows={3}
                className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary resize-none"
                placeholder="Describe brevemente el evento…"
                value={descripcion}
                onChange={(e) => setDescripcion(e.target.value)}
              />
            </label>

            <div className="flex justify-end gap-2 pt-1">
              <button
                type="button"
                className="px-4 py-2 rounded-lg text-sm bg-secondary text-secondary-foreground hover:bg-accent transition"
                onClick={() => setOpen(false)}
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={loading}
                className="px-4 py-2 rounded-lg text-sm bg-primary text-primary-foreground hover:opacity-90 transition disabled:opacity-50"
              >
                {loading ? "Enviando…" : "Enviar"}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
