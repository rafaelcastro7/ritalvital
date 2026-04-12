import { X } from 'lucide-react';

interface Props {
  open: boolean;
  onClose: () => void;
}

const FADE_IN = (delay: number) =>
  ({
    animation: `fadeSlideIn 0.6s ease ${delay}ms both`,
  }) as React.CSSProperties;

const AboutModal = ({ open, onClose }: Props) => {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[9999] bg-background overflow-y-auto">
      <style>{`
        @keyframes fadeSlideIn {
          from { opacity: 0; transform: translateY(20px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>

      {/* Close button */}
      <button
        onClick={onClose}
        className="fixed top-5 right-5 z-[10000] p-2 rounded-full bg-secondary hover:bg-accent text-foreground transition"
      >
        <X size={22} />
      </button>

      <div className="max-w-4xl mx-auto px-6 py-16 space-y-20">
        {/* ── SECTION 1 — Hero ── */}
        <section className="text-center space-y-5" style={FADE_IN(0)}>
          <h1 className="text-5xl md:text-6xl font-extrabold tracking-tight text-foreground">
            <span className="text-primary">🏥</span> RutaVital IA
          </h1>
          <p className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto leading-relaxed">
            Sistema de priorización territorial de continuidad asistencial ante emergencias
          </p>
          <span className="inline-block text-xs font-semibold px-4 py-1.5 rounded-full bg-primary/15 text-primary border border-primary/30">
            Concurso Datos al Ecosistema 2026 · IA para Colombia
          </span>
          <div className="flex items-center justify-center gap-2 flex-wrap pt-1">
            {['Datos 100% abiertos', 'Código auditable', 'Sin caja negra'].map((t) => (
              <span key={t} className="text-[11px] font-medium px-3 py-1 rounded-full bg-[hsl(145,63%,55%)]/15 text-[hsl(145,63%,55%)] border border-[hsl(145,63%,55%)]/25">
                🟢 {t}
              </span>
            ))}
          </div>
          <p className="text-sm text-muted-foreground">
            Desarrollado con datos abiertos oficiales de Colombia · MVP departamento piloto: Chocó
          </p>
        </section>

        {/* ── SECTION 2 — El problema ── */}
        <section className="space-y-6" style={FADE_IN(100)}>
          <SectionTitle>¿Qué problema resuelve?</SectionTitle>
          <p className="text-muted-foreground leading-relaxed">
            Cuando ocurre una emergencia o desastre, algunas comunidades quedan aisladas y sin acceso a atención en salud.
            Los datos existen — capacidad hospitalaria, historial de eventos, afectación vial — pero están dispersos en fuentes separadas.
            Ninguna herramienta los cruza para responder la pregunta clave:
          </p>
          <blockquote className="border-l-4 border-destructive pl-5 py-3 bg-destructive/5 rounded-r-lg text-foreground italic">
            ¿Qué municipios combinan alta exposición a emergencias, mayor impacto vial y menor capacidad sanitaria, y deben ser priorizados hoy?
          </blockquote>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
            {[
              { num: '1.122', desc: 'municipios en Colombia sin herramienta unificada de priorización asistencial' },
              { num: '32', desc: 'departamentos con datos abiertos disponibles pero desconectados' },
              { num: '4', desc: 'fuentes oficiales que nunca se habían cruzado en un solo índice auditable' },
            ].map((d) => (
              <div key={d.num} className="bg-card border border-border rounded-lg p-5 text-center">
                <div className="text-3xl font-extrabold text-primary">{d.num}</div>
                <p className="text-xs text-muted-foreground mt-1.5 leading-snug">{d.desc}</p>
              </div>
            ))}
          </div>
        </section>

        {/* ── SECTION 3 — Diagrama de arquitectura IRCA ── */}
        <section className="space-y-6" style={FADE_IN(200)}>
          <SectionTitle>El Índice de Riesgo de Continuidad Asistencial (IRCA)</SectionTitle>
          <ArchitectureDiagram />
        </section>

        {/* ── SECTION 4 — Fuentes de datos ── */}
        <section className="space-y-4" style={FADE_IN(300)}>
          <SectionTitle>Datos abiertos oficiales</SectionTitle>
          <div className="space-y-2">
            {[
              { name: 'DIVIPOLA', inst: 'DANE', what: 'Llave territorial maestra de todos los municipios del país', id: 'cod_municipio' },
              { name: 'Proyecciones de población', inst: 'DANE', what: 'Normalización de capacidad sanitaria por habitante', id: '2018–2042' },
              { name: 'REPS nacional', inst: 'Ministerio de Salud', what: 'Camas habilitadas y sedes activas', id: 'c36g-9fc2' },
              { name: 'Registro de emergencias', inst: 'UNGRD', what: 'Historial de eventos, vías y puentes afectados', id: 'datos.gov.co' },
            ].map((s) => (
              <div key={s.name} className="flex items-center gap-4 bg-card border border-border rounded-lg px-5 py-3">
                <div className="flex-1">
                  <span className="font-semibold text-foreground text-sm">{s.name}</span>
                  <span className="text-muted-foreground text-sm"> · {s.inst}</span>
                  <p className="text-xs text-muted-foreground mt-0.5">{s.what}</p>
                </div>
                <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-[hsl(145,63%,55%)]/15 text-[hsl(145,63%,55%)] border border-[hsl(145,63%,55%)]/25 shrink-0">
                  Verificada
                </span>
                <span className="text-[10px] text-muted-foreground font-mono shrink-0">{s.id}</span>
              </div>
            ))}
          </div>
        </section>

        {/* ── SECTION 5 — Niveles de riesgo ── */}
        <section className="space-y-4" style={FADE_IN(400)}>
          <SectionTitle>Niveles de riesgo y acción recomendada</SectionTitle>
          <div className="space-y-2">
            {[
              { color: 'hsl(4,68%,46%)', emoji: '🔴', nivel: 'Crítico', accion: 'Notificar al comité departamental y revisar la red de referencia en las próximas 24 horas' },
              { color: 'hsl(24,80%,52%)', emoji: '🟠', nivel: 'Alto', accion: 'Notificar al comité departamental y verificar disponibilidad operativa y planes de contingencia' },
              { color: 'hsl(37,90%,57%)', emoji: '🟡', nivel: 'Medio', accion: 'Solicitar validación del plan local de contingencia y seguimiento reforzado' },
              { color: 'hsl(145,63%,55%)', emoji: '🟢', nivel: 'Bajo', accion: 'Monitoreo rutinario e inclusión en reporte departamental mensual' },
            ].map((r) => (
              <div key={r.nivel} className="flex items-start gap-3 bg-card border border-border rounded-lg px-5 py-3">
                <span
                  className="w-3 h-3 rounded-full mt-1 shrink-0"
                  style={{ backgroundColor: r.color }}
                />
                <div>
                  <span className="font-semibold text-foreground text-sm">{r.nivel}</span>
                  <p className="text-xs text-muted-foreground mt-0.5">{r.accion}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* ── SECTION 6 — Limitaciones ── */}
        <section className="space-y-4" style={FADE_IN(500)}>
          <SectionTitle>Lo que este modelo no hace</SectionTitle>
          <ul className="space-y-2">
            {[
              'No predice colapsos hospitalarios futuros',
              'No monitorea en tiempo real',
              'No estima inventarios de medicamentos',
              'No reemplaza los sistemas operativos de respuesta de emergencias',
              'Un IRCA bajo en municipios sin eventos reportados puede reflejar subregistro, no seguridad real',
            ].map((t) => (
              <li key={t} className="flex items-start gap-2.5 text-sm text-muted-foreground">
                <span className="text-destructive font-bold shrink-0">✗</span> {t}
              </li>
            ))}
          </ul>
          <blockquote className="border-l-4 border-[hsl(45,90%,55%)] pl-5 py-3 bg-[hsl(45,90%,55%)]/5 rounded-r-lg text-sm text-muted-foreground leading-relaxed">
            Esta transparencia es intencional. RutaVital IA no vende certezas — entrega priorización auditable
            para que los tomadores de decisión actúen con criterio, no con intuición.
          </blockquote>
        </section>

        {/* ── SECTION 7 — Escalabilidad ── */}
        <section className="space-y-6" style={FADE_IN(600)}>
          <SectionTitle>¿Qué sigue?</SectionTitle>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {[
              { label: 'MVP actual', desc: '31 municipios · Chocó · Datos sintéticos de demostración' },
              { label: 'Fase 2', desc: '32 departamentos · 1.122 municipios · Datos oficiales reales · Actualización periódica' },
              { label: 'Fase 3', desc: 'Integración con sistemas de alerta temprana · API para secretarías de salud' },
            ].map((p) => (
              <div key={p.label} className="bg-card border border-border rounded-lg p-5">
                <div className="text-sm font-semibold text-foreground mb-1">{p.label}</div>
                <p className="text-xs text-muted-foreground leading-snug">{p.desc}</p>
              </div>
            ))}
          </div>
          {/* Timeline */}
          <div className="relative flex items-center justify-between max-w-xl mx-auto pt-4">
            <div className="absolute top-[calc(1rem+6px)] left-0 right-0 h-px bg-border" />
            {[
              { label: 'MVP · Chocó · 31 municipios', active: true },
              { label: 'Fase 2 · 32 deptos · 1.122 mun.', active: false },
              { label: 'Fase 3 · API pública · alertas', active: false },
            ].map((h, i) => (
              <div key={i} className="relative z-10 flex flex-col items-center text-center gap-1.5">
                <div
                  className={`w-3 h-3 rounded-full border-2 ${
                    h.active
                      ? 'bg-[hsl(145,63%,55%)] border-[hsl(145,63%,55%)]'
                      : 'bg-muted border-border'
                  }`}
                />
                <span className="text-[10px] text-muted-foreground max-w-[140px] leading-tight">{h.label}</span>
              </div>
            ))}
          </div>
        </section>

        {/* ── SECTION 8 — Footer ── */}
        <section className="text-center space-y-4 pb-8" style={FADE_IN(700)}>
          <p className="text-sm text-muted-foreground max-w-xl mx-auto leading-relaxed">
            RutaVital IA fue construido íntegramente con datos abiertos oficiales de Colombia.
            El código, la lógica del índice y las fuentes son públicos y auditables.
          </p>
          <button
            onClick={onClose}
            className="px-6 py-2.5 bg-primary text-primary-foreground rounded-lg font-semibold text-sm hover:opacity-90 transition"
          >
            Ver dashboard
          </button>
        </section>
      </div>
    </div>
  );
};

export default AboutModal;

/* ─── Sub-components ─── */

const SectionTitle = ({ children }: { children: React.ReactNode }) => (
  <h2 className="text-xl font-bold text-foreground">{children}</h2>
);

/* ─── Architecture Diagram ─── */
const ArchitectureDiagram = () => {
  const boxBase = 'rounded-lg px-4 py-3 text-center';
  const labelSmall = 'text-[10px] text-muted-foreground';

  const Arrow = ({ label, delay }: { label: string; delay: number }) => (
    <div className="flex flex-col items-center gap-0.5 py-1" style={FADE_IN(delay)}>
      <span className="text-[10px] text-muted-foreground">{label}</span>
      <span className="text-muted-foreground text-lg leading-none">▼</span>
    </div>
  );

  return (
    <div className="space-y-1">
      {/* Level 1 — Fuentes */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2" style={FADE_IN(220)}>
        {[
          { name: 'DIVIPOLA', sub: 'DANE', detail: 'cod_municipio' },
          { name: 'Población', sub: 'DANE proyecciones', detail: '2018–2042' },
          { name: 'REPS', sub: 'MinSalud', detail: 'c36g-9fc2' },
          { name: 'Emergencias', sub: 'UNGRD', detail: 'datos.gov.co' },
        ].map((s) => (
          <div key={s.name} className={`${boxBase} bg-[hsl(170,40%,18%)] border border-[hsl(170,40%,28%)]`}>
            <div className="text-xs font-bold text-[hsl(170,50%,65%)]">{s.name}</div>
            <div className={labelSmall}>{s.sub}</div>
            <div className="text-[9px] text-muted-foreground font-mono mt-0.5">{s.detail}</div>
          </div>
        ))}
      </div>

      <Arrow label="integración territorial" delay={260} />

      {/* Level 2 — ETL */}
      <div className={`${boxBase} bg-[hsl(270,30%,20%)] border border-[hsl(270,30%,32%)]`} style={FADE_IN(300)}>
        <div className="text-sm font-bold text-[hsl(270,60%,72%)]">ETL · pipeline.py</div>
        <div className={labelSmall}>Limpieza · left join desde DIVIPOLA · imputación mediana departamental · ventana 5 años</div>
      </div>

      <Arrow label="tres componentes" delay={340} />

      {/* Level 3 — Tres componentes */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-2" style={FADE_IN(380)}>
        {[
          { icon: '🏥', name: 'Vulnerabilidad sanitaria', formula: '1 – pctil(camas/1000 hab)', sub: 'Menos camas = más riesgo' },
          { icon: '⚡', name: 'Exposición histórica', formula: 'pctil(eventos – 5 años)', sub: 'Más eventos = más riesgo' },
          { icon: '🛣️', name: 'Severidad vial', formula: 'pctil((vías+puentes)/evento)', sub: 'Más daño vial = más riesgo' },
        ].map((c) => (
          <div key={c.name} className={`${boxBase} bg-[hsl(10,40%,20%)] border border-[hsl(10,40%,32%)]`}>
            <div className="text-lg">{c.icon}</div>
            <div className="text-xs font-bold text-[hsl(10,60%,70%)]">{c.name}</div>
            <div className="text-[10px] font-mono text-muted-foreground mt-0.5">{c.formula}</div>
            <div className="text-[9px] text-muted-foreground mt-0.5">{c.sub}</div>
          </div>
        ))}
      </div>

      <Arrow label="promedio simple · sin pesos arbitrarios" delay={420} />

      {/* Level 4 — IRCA */}
      <div className={`${boxBase} bg-[hsl(35,50%,18%)] border border-[hsl(35,50%,30%)]`} style={FADE_IN(460)}>
        <div className="text-sm font-bold text-[hsl(35,80%,65%)]">IRCA · Índice de Riesgo de Continuidad Asistencial</div>
        <div className={labelSmall}>Promedio simple · categorías: Bajo / Medio / Alto / Crítico</div>
      </div>

      <Arrow label="" delay={500} />

      {/* Level 5 — CSV */}
      <div className={`${boxBase} bg-secondary border border-border`} style={FADE_IN(520)}>
        <div className="text-xs font-bold text-foreground">outputs/municipios_riesgo.csv</div>
        <div className={labelSmall}>19 columnas · flags de confianza y subregistro · recomendaciones operativas</div>
      </div>

      <Arrow label="" delay={560} />

      {/* Level 6 — Dashboard */}
      <div className={`${boxBase} bg-primary/15 border border-primary/30`} style={FADE_IN(600)}>
        <div className="text-sm font-bold text-primary">Dashboard · React + Leaflet</div>
        <div className={labelSmall}>Mapa coroplético · tabla filtrable · panel lateral · alertas de baja confianza · metadatos</div>
      </div>
    </div>
  );
};
