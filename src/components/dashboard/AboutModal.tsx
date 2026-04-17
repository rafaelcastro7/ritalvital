import { X, Database, Activity, AlertTriangle, Map, ShieldCheck, Sparkles, ArrowRight } from 'lucide-react';

interface Props {
  open: boolean;
  onClose: () => void;
}

const FADE_IN = (delay: number) =>
  ({
    animation: `fadeSlideIn 0.7s cubic-bezier(0.16, 1, 0.3, 1) ${delay}ms both`,
  }) as React.CSSProperties;

const AboutModal = ({ open, onClose }: Props) => {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[9999] bg-background overflow-y-auto">
      <style>{`
        @keyframes fadeSlideIn {
          from { opacity: 0; transform: translateY(24px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes pulseGlow {
          0%, 100% { box-shadow: 0 0 0 0 hsl(var(--primary) / 0.4); }
          50% { box-shadow: 0 0 0 12px hsl(var(--primary) / 0); }
        }
        @keyframes shimmer {
          0% { background-position: -200% center; }
          100% { background-position: 200% center; }
        }
        .hero-gradient {
          background: radial-gradient(ellipse at top, hsl(var(--primary) / 0.15) 0%, transparent 60%);
        }
        .text-shimmer {
          background: linear-gradient(90deg, hsl(var(--foreground)) 0%, hsl(var(--primary)) 50%, hsl(var(--foreground)) 100%);
          background-size: 200% auto;
          -webkit-background-clip: text;
          background-clip: text;
          -webkit-text-fill-color: transparent;
          animation: shimmer 4s linear infinite;
        }
        .card-hover {
          transition: all 0.3s cubic-bezier(0.16, 1, 0.3, 1);
        }
        .card-hover:hover {
          transform: translateY(-2px);
          border-color: hsl(var(--primary) / 0.4);
          box-shadow: 0 8px 24px -8px hsl(var(--primary) / 0.2);
        }
      `}</style>

      {/* Hero background gradient */}
      <div className="absolute top-0 left-0 right-0 h-[600px] hero-gradient pointer-events-none" />

      {/* Close button */}
      <button
        onClick={onClose}
        aria-label="Cerrar"
        className="fixed top-5 right-5 z-[10000] p-2.5 rounded-full bg-secondary/90 backdrop-blur hover:bg-accent text-foreground transition-all hover:scale-110 border border-border"
      >
        <X size={20} />
      </button>

      <div className="relative max-w-5xl mx-auto px-6 py-20 space-y-24">
        {/* ── SECTION 1 — Hero ── */}
        <section className="text-center space-y-6" style={FADE_IN(0)}>
          <div className="inline-flex items-center gap-2 text-xs font-semibold px-4 py-1.5 rounded-full bg-primary/10 text-primary border border-primary/20 backdrop-blur">
            <Sparkles className="w-3.5 h-3.5" />
            Concurso Datos al Ecosistema 2026 · IA para Colombia
          </div>
          <h1 className="text-6xl md:text-7xl font-extrabold tracking-tight leading-[0.95]">
            <span className="text-shimmer">RutaVital IA</span>
          </h1>
          <p className="text-xl md:text-2xl text-muted-foreground max-w-3xl mx-auto leading-relaxed font-light">
            Sistema de priorización territorial de continuidad asistencial ante emergencias
          </p>
          <div className="flex items-center justify-center gap-2 flex-wrap pt-3">
            {[
              { icon: '🟢', text: 'Datos 100% abiertos' },
              { icon: '🟢', text: 'Código auditable' },
              { icon: '🟢', text: 'Sin caja negra' },
            ].map((t) => (
              <span key={t.text} className="text-xs font-medium px-3.5 py-1.5 rounded-full bg-[hsl(145,63%,55%)]/10 text-[hsl(145,63%,65%)] border border-[hsl(145,63%,55%)]/20">
                {t.icon} {t.text}
              </span>
            ))}
          </div>
          <p className="text-sm text-muted-foreground/80 pt-2">
            Desarrollado con datos abiertos oficiales de Colombia · MVP departamento piloto: <span className="text-foreground font-medium">Chocó</span>
          </p>
        </section>

        {/* ── SECTION 2 — El problema ── */}
        <section className="space-y-8" style={FADE_IN(120)}>
          <SectionHeader
            eyebrow="El problema"
            title="¿Qué problema resuelve?"
            icon={<AlertTriangle className="w-5 h-5" />}
          />
          <p className="text-base text-muted-foreground leading-relaxed max-w-3xl">
            Cuando ocurre una emergencia o desastre, algunas comunidades quedan aisladas y sin acceso a atención en salud.
            Los datos existen — capacidad hospitalaria, historial de eventos, afectación vial — pero están dispersos en fuentes separadas.
            Ninguna herramienta los cruza para responder la pregunta clave:
          </p>
          <blockquote className="relative border-l-4 border-destructive pl-6 py-5 bg-gradient-to-r from-destructive/10 to-transparent rounded-r-xl">
            <p className="text-lg md:text-xl text-foreground italic font-medium leading-relaxed">
              "¿Qué municipios combinan alta exposición a emergencias, mayor impacto vial y menor capacidad sanitaria, y deben ser priorizados hoy?"
            </p>
          </blockquote>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
            {[
              { num: '1.122', desc: 'municipios en Colombia sin herramienta unificada de priorización asistencial' },
              { num: '32', desc: 'departamentos con datos abiertos disponibles pero desconectados' },
              { num: '4', desc: 'fuentes oficiales que nunca se habían cruzado en un solo índice auditable' },
            ].map((d) => (
              <div key={d.num} className="card-hover bg-card border border-border rounded-xl p-6 text-center">
                <div className="text-4xl font-extrabold text-primary tracking-tight">{d.num}</div>
                <p className="text-xs text-muted-foreground mt-2 leading-relaxed">{d.desc}</p>
              </div>
            ))}
          </div>
        </section>

        {/* ── SECTION 3 — Diagrama de arquitectura IRCA ── */}
        <section className="space-y-8" style={FADE_IN(220)}>
          <SectionHeader
            eyebrow="Arquitectura"
            title="El Índice de Riesgo de Continuidad Asistencial (IRCA)"
            icon={<Activity className="w-5 h-5" />}
          />
          <div className="bg-card/50 border border-border rounded-2xl p-6 md:p-8 backdrop-blur">
            <ArchitectureDiagram />
          </div>
        </section>

        {/* ── SECTION 4 — Fuentes de datos ── */}
        <section className="space-y-6" style={FADE_IN(320)}>
          <SectionHeader
            eyebrow="Fuentes"
            title="Datos abiertos oficiales"
            icon={<Database className="w-5 h-5" />}
          />
          <div className="space-y-2.5">
            {[
              { name: 'DIVIPOLA', inst: 'DANE', what: 'Llave territorial maestra de todos los municipios del país', id: 'cod_municipio' },
              { name: 'Proyecciones de población', inst: 'DANE', what: 'Normalización de capacidad sanitaria por habitante', id: '2018–2035' },
              { name: 'REPS nacional', inst: 'Ministerio de Salud', what: 'Camas habilitadas y sedes activas', id: 'c36g-9fc2' },
              { name: 'Registro de emergencias', inst: 'UNGRD', what: 'Historial de eventos, vías y puentes afectados', id: 'datos.gov.co' },
            ].map((s) => (
              <div key={s.name} className="card-hover flex items-center gap-4 bg-card border border-border rounded-xl px-5 py-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-baseline gap-2 flex-wrap">
                    <span className="font-semibold text-foreground">{s.name}</span>
                    <span className="text-muted-foreground text-sm">· {s.inst}</span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">{s.what}</p>
                </div>
                <span className="flex items-center gap-1 text-[10px] font-semibold px-2.5 py-1 rounded-full bg-[hsl(145,63%,55%)]/15 text-[hsl(145,63%,65%)] border border-[hsl(145,63%,55%)]/30 shrink-0">
                  <ShieldCheck className="w-3 h-3" />
                  Verificada
                </span>
                <span className="hidden sm:inline text-[10px] text-muted-foreground font-mono shrink-0 bg-secondary/50 px-2 py-1 rounded">{s.id}</span>
              </div>
            ))}
          </div>
        </section>

        {/* ── SECTION 5 — Niveles de riesgo ── */}
        <section className="space-y-6" style={FADE_IN(420)}>
          <SectionHeader
            eyebrow="Acción"
            title="Niveles de riesgo y acción recomendada"
            icon={<Map className="w-5 h-5" />}
          />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {[
              { color: 'hsl(4,68%,46%)', emoji: '🔴', nivel: 'Crítico', accion: 'Notificar al comité departamental y revisar la red de referencia en las próximas 24 horas' },
              { color: 'hsl(24,80%,52%)', emoji: '🟠', nivel: 'Alto', accion: 'Notificar al comité departamental y verificar disponibilidad operativa y planes de contingencia' },
              { color: 'hsl(37,90%,57%)', emoji: '🟡', nivel: 'Medio', accion: 'Solicitar validación del plan local de contingencia y seguimiento reforzado' },
              { color: 'hsl(145,63%,55%)', emoji: '🟢', nivel: 'Bajo', accion: 'Monitoreo rutinario e inclusión en reporte departamental mensual' },
            ].map((r) => (
              <div
                key={r.nivel}
                className="card-hover relative bg-card border border-border rounded-xl p-5 overflow-hidden"
              >
                <div
                  className="absolute left-0 top-0 bottom-0 w-1"
                  style={{ backgroundColor: r.color }}
                />
                <div className="flex items-start gap-3 pl-2">
                  <span
                    className="w-2.5 h-2.5 rounded-full mt-1.5 shrink-0"
                    style={{ backgroundColor: r.color, boxShadow: `0 0 12px ${r.color}` }}
                  />
                  <div>
                    <div className="font-semibold text-foreground text-sm uppercase tracking-wide">{r.nivel}</div>
                    <p className="text-xs text-muted-foreground mt-1.5 leading-relaxed">{r.accion}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* ── SECTION 6 — Limitaciones ── */}
        <section className="space-y-6" style={FADE_IN(520)}>
          <SectionHeader
            eyebrow="Honestidad"
            title="Lo que este modelo no hace"
            icon={<ShieldCheck className="w-5 h-5" />}
          />
          <ul className="space-y-2.5">
            {[
              'No predice colapsos hospitalarios futuros',
              'No monitorea en tiempo real',
              'No estima inventarios de medicamentos',
              'No reemplaza los sistemas operativos de respuesta de emergencias',
              'Un IRCA bajo en municipios sin eventos reportados puede reflejar subregistro, no seguridad real',
            ].map((t) => (
              <li key={t} className="flex items-start gap-3 text-sm text-muted-foreground bg-card/50 border border-border rounded-lg px-4 py-3">
                <span className="text-destructive font-bold shrink-0 text-base leading-tight">✗</span>
                <span className="leading-relaxed">{t}</span>
              </li>
            ))}
          </ul>
          <blockquote className="border-l-4 border-[hsl(45,90%,55%)] pl-6 py-5 bg-gradient-to-r from-[hsl(45,90%,55%)]/10 to-transparent rounded-r-xl text-sm text-foreground/90 leading-relaxed">
            <span className="font-semibold text-[hsl(45,90%,65%)]">Esta transparencia es intencional.</span> RutaVital IA no vende certezas — entrega priorización auditable
            para que los tomadores de decisión actúen con criterio, no con intuición.
          </blockquote>
        </section>

        {/* ── SECTION 7 — Escalabilidad ── */}
        <section className="space-y-8" style={FADE_IN(620)}>
          <SectionHeader
            eyebrow="Roadmap"
            title="¿Qué sigue?"
            icon={<ArrowRight className="w-5 h-5" />}
          />
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {[
              { label: 'MVP actual', desc: '32 municipios · Chocó · Datos oficiales abiertos', active: true },
              { label: 'Fase 2', desc: '32 departamentos · 1.122 municipios · Datos oficiales reales · Actualización periódica', active: false },
              { label: 'Fase 3', desc: 'Integración con sistemas de alerta temprana · API para secretarías de salud', active: false },
            ].map((p) => (
              <div
                key={p.label}
                className={`card-hover bg-card border rounded-xl p-5 ${
                  p.active ? 'border-primary/40 bg-primary/5' : 'border-border'
                }`}
              >
                <div className="flex items-center gap-2 mb-2">
                  {p.active && (
                    <span className="w-2 h-2 rounded-full bg-[hsl(145,63%,55%)]" style={{ animation: 'pulseGlow 2s infinite' }} />
                  )}
                  <div className={`text-sm font-semibold ${p.active ? 'text-primary' : 'text-foreground'}`}>{p.label}</div>
                </div>
                <p className="text-xs text-muted-foreground leading-relaxed">{p.desc}</p>
              </div>
            ))}
          </div>
          {/* Timeline */}
          <div className="relative flex items-center justify-between max-w-2xl mx-auto pt-6">
            <div className="absolute top-[calc(1.5rem+6px)] left-4 right-4 h-px bg-gradient-to-r from-[hsl(145,63%,55%)] via-border to-border" />
            {[
              { label: 'MVP · Chocó · 32 municipios', active: true },
              { label: 'Fase 2 · 32 deptos · 1.122 mun.', active: false },
              { label: 'Fase 3 · API pública · alertas', active: false },
            ].map((h, i) => (
              <div key={i} className="relative z-10 flex flex-col items-center text-center gap-2">
                <div
                  className={`w-3.5 h-3.5 rounded-full border-2 ${
                    h.active
                      ? 'bg-[hsl(145,63%,55%)] border-[hsl(145,63%,55%)]'
                      : 'bg-background border-border'
                  }`}
                  style={h.active ? { animation: 'pulseGlow 2s infinite' } : {}}
                />
                <span className={`text-[10px] max-w-[140px] leading-tight ${h.active ? 'text-foreground font-medium' : 'text-muted-foreground'}`}>
                  {h.label}
                </span>
              </div>
            ))}
          </div>
        </section>

        {/* ── SECTION 8 — Footer ── */}
        <section className="text-center space-y-6 pb-8" style={FADE_IN(720)}>
          <div className="max-w-2xl mx-auto p-8 rounded-2xl bg-gradient-to-br from-primary/10 via-card to-card border border-primary/20">
            <p className="text-sm md:text-base text-foreground/90 leading-relaxed mb-6">
              <span className="font-semibold text-primary">RutaVital IA</span> fue construido íntegramente con datos abiertos oficiales de Colombia.
              El código, la lógica del índice y las fuentes son <span className="font-semibold">públicos y auditables</span>.
            </p>
            <button
              onClick={onClose}
              className="inline-flex items-center gap-2 px-7 py-3 bg-primary text-primary-foreground rounded-lg font-semibold text-sm hover:opacity-90 transition-all hover:scale-105 shadow-lg shadow-primary/30"
            >
              Ver dashboard
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </section>
      </div>
    </div>
  );
};

export default AboutModal;

/* ─── Sub-components ─── */

const SectionHeader = ({
  eyebrow,
  title,
  icon,
}: {
  eyebrow: string;
  title: string;
  icon: React.ReactNode;
}) => (
  <div className="space-y-2">
    <div className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-primary">
      {icon}
      {eyebrow}
    </div>
    <h2 className="text-2xl md:text-3xl font-bold text-foreground tracking-tight">{title}</h2>
  </div>
);

/* ─── Architecture Diagram ─── */
const ArchitectureDiagram = () => {
  const boxBase = 'rounded-xl px-4 py-3 text-center backdrop-blur transition-all hover:scale-[1.02]';
  const labelSmall = 'text-[10px] text-muted-foreground';

  const Arrow = ({ label, delay }: { label: string; delay: number }) => (
    <div className="flex flex-col items-center gap-0.5 py-1.5" style={FADE_IN(delay)}>
      {label && <span className="text-[10px] text-muted-foreground italic">{label}</span>}
      <span className="text-muted-foreground/60 text-lg leading-none">▼</span>
    </div>
  );

  return (
    <div className="space-y-1">
      {/* Level 1 — Fuentes */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5" style={FADE_IN(240)}>
        {[
          { name: 'DIVIPOLA', sub: 'DANE', detail: 'cod_municipio' },
          { name: 'Población', sub: 'DANE proyecciones', detail: '2018–2035' },
          { name: 'REPS', sub: 'MinSalud', detail: 'c36g-9fc2' },
          { name: 'Emergencias', sub: 'UNGRD', detail: 'datos.gov.co' },
        ].map((s) => (
          <div key={s.name} className={`${boxBase} bg-[hsl(170,40%,15%)]/60 border border-[hsl(170,50%,35%)]/50`}>
            <div className="text-xs font-bold text-[hsl(170,60%,70%)]">{s.name}</div>
            <div className={labelSmall}>{s.sub}</div>
            <div className="text-[9px] text-muted-foreground/80 font-mono mt-0.5">{s.detail}</div>
          </div>
        ))}
      </div>

      <Arrow label="integración territorial" delay={280} />

      {/* Level 2 — ETL */}
      <div className={`${boxBase} bg-[hsl(270,30%,18%)]/60 border border-[hsl(270,40%,40%)]/50`} style={FADE_IN(320)}>
        <div className="text-sm font-bold text-[hsl(270,65%,78%)]">ETL · pipeline.py</div>
        <div className={labelSmall}>Limpieza · left join desde DIVIPOLA · imputación mediana departamental · ventana 5 años</div>
      </div>

      <Arrow label="tres componentes" delay={360} />

      {/* Level 3 — Tres componentes */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5" style={FADE_IN(400)}>
        {[
          { icon: '🏥', name: 'Vulnerabilidad sanitaria', formula: '1 – pctil(camas/1000 hab)', sub: 'Menos camas = más riesgo' },
          { icon: '⚡', name: 'Exposición histórica', formula: 'pctil(eventos – 5 años)', sub: 'Más eventos = más riesgo' },
          { icon: '🛣️', name: 'Severidad vial', formula: 'pctil((vías+puentes)/evento)', sub: 'Más daño vial = más riesgo' },
        ].map((c) => (
          <div key={c.name} className={`${boxBase} bg-[hsl(10,40%,18%)]/60 border border-[hsl(10,50%,40%)]/50`}>
            <div className="text-xl mb-0.5">{c.icon}</div>
            <div className="text-xs font-bold text-[hsl(10,65%,75%)]">{c.name}</div>
            <div className="text-[10px] font-mono text-muted-foreground mt-1 bg-background/40 rounded px-1.5 py-0.5 inline-block">{c.formula}</div>
            <div className="text-[9px] text-muted-foreground mt-1">{c.sub}</div>
          </div>
        ))}
      </div>

      <Arrow label="promedio simple · sin pesos arbitrarios" delay={440} />

      {/* Level 4 — IRCA */}
      <div className={`${boxBase} bg-gradient-to-r from-[hsl(35,55%,18%)]/70 to-[hsl(35,55%,22%)]/70 border border-[hsl(35,70%,45%)]/50`} style={FADE_IN(480)}>
        <div className="text-base font-bold text-[hsl(35,90%,70%)]">IRCA · Índice de Riesgo de Continuidad Asistencial</div>
        <div className={labelSmall}>Promedio simple · categorías: Bajo / Medio / Alto / Crítico</div>
      </div>

      <Arrow label="exportación" delay={520} />

      {/* Level 5 — CSV */}
      <div className={`${boxBase} bg-secondary/60 border border-border`} style={FADE_IN(560)}>
        <div className="text-xs font-bold text-foreground font-mono">outputs/municipios_riesgo.csv</div>
        <div className={labelSmall}>19 columnas · flags de confianza y subregistro · recomendaciones operativas</div>
      </div>

      <Arrow label="visualización" delay={600} />

      {/* Level 6 — Dashboard */}
      <div className={`${boxBase} bg-gradient-to-r from-primary/15 to-primary/10 border border-primary/40`} style={FADE_IN(640)}>
        <div className="text-base font-bold text-primary">Dashboard · React + Leaflet</div>
        <div className={labelSmall}>Mapa coroplético · tabla filtrable · panel lateral · alertas de baja confianza · metadatos</div>
      </div>
    </div>
  );
};
