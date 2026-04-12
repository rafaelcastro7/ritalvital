import { useRef, useState } from "react";

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL ?? "http://localhost:8000";

export default function UploadPipelineButton({ onUploaded }: { onUploaded: () => void }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [loading, setLoading] = useState(false);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length !== 4) {
      alert("Debes seleccionar exactamente los 4 archivos CSV oficiales (DIVIPOLA, Población, REPS, UNGRD).");
      return;
    }
    const formData = new FormData();
    Array.from(files).forEach((file, idx) => {
      formData.append(`file${idx + 1}`, file);
    });
    setLoading(true);
    try {
      const res = await fetch(`${BACKEND_URL}/procesar`, {
        method: "POST",
        body: formData,
      });
      if (res.ok) {
        const blob = await res.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = "municipios_riesgo.csv";
        a.click();
        window.URL.revokeObjectURL(url);
        onUploaded();
      } else {
        const msg = await res.text().catch(() => "Error desconocido");
        alert(`Error procesando los archivos: ${msg}`);
      }
    } catch {
      alert("No se pudo conectar con el servidor de pipeline. Verifica que esté corriendo en " + BACKEND_URL);
    } finally {
      setLoading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  return (
    <div>
      <input
        ref={inputRef}
        type="file"
        accept=".csv"
        multiple
        style={{ display: "none" }}
        onChange={handleUpload}
      />
      <button
        className="text-xs bg-primary text-primary-foreground hover:opacity-90 px-3 py-1.5 rounded-full transition disabled:opacity-50"
        disabled={loading}
        onClick={() => inputRef.current?.click()}
      >
        {loading ? "Procesando…" : "Cargar datos actualizados"}
      </button>
    </div>
  );
}
