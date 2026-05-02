## Mejora de documentación para hackathon GobIA

**Cero cambios de funcionalidad.** Solo se reemplazan/crean archivos de documentación y se añaden comentarios en español a 3 edge functions (lógica intacta).

---

### 1. `README.md` — reemplazo completo

Nueva versión profesional en español con:

- **Badges de tecnología**: React 18, TypeScript 5, Vite 5, Tailwind 3, Supabase, Gemini 2.5 Flash/Pro, Leaflet, Socrata datos.gov.co, licencia CC BY 4.0.
- **El problema**: gestores de salud sin herramienta unificada que cruce DANE, REPS, UNGRD, BDUA + desconexión con normativa + vigilancia reactiva.
- **La solución**: descarga + cruce + IRCA v3 + 4 agentes IA + búsqueda normativa + reportes ejecutivos, todo público y open source.
- **Sección "🤖 Agentes de IA"**: tabla con los 4 agentes (Vigía, Validador, Analista, Reportero), modelo, inputs y outputs.
- **Sección "📊 Fuentes de datos abiertos"**: tabla con DIVIPOLA `gdxc-w37w`, REPS `s2ru-bqt6`, UNGRD `rgre-6ak4` + `wwkg-r6te`, BDUA `d7a5-cnra` + `tq4m-hmg2` con URLs canónicas a datos.gov.co.
- **Diagrama ASCII de arquitectura** mostrando flujo Socrata → Edge Functions → tablas → Frontend.
- **Stack tecnológico** organizado por capa: Frontend, Backend, IA, Base de datos, Datos abiertos.
- **Instalación local**: prerrequisitos, `git clone`, `bun install`, variables de entorno, primer disparo del pipeline desde `/admin`.
- **Vistas principales**: `/`, `/chat`, `/reportes`, `/normativa`, `/admin` con descripción.
- **Sección "🎯 Impacto"**: cobertura 1.122 municipios, distribución observada, 4 casos de uso (alcaldías, secretarías, MinSalud/UNGRD, veedurías), trazabilidad agéntica.
- Enlaces a `ARCHITECTURE.md`, `AGENTS.md`, `CHANGELOG.md`.

### 2. `CHANGELOG.md` — reemplazo completo

Formato Keep a Changelog con 4 versiones progresivas:

- **0.4.0 — Esta semana (2026-04-22)**: Pulido final, escalado nacional, documentación, RAG en reportes, normativa cargada, página `/normativa`, umbrales absolutos OMS, acceso público, fix `irca_score numeric(6,2)`.
- **0.3.0 — Semana 3 (2026-04-15)**: Agente Analista con 6 tools y loop ReAct, Agente Reportero con HTML público, system prompt riguroso, bucket `reportes`, extensión de `agent_runs`.
- **0.2.0 — Semana 2 (2026-04-08)**: Agente Vigía (deltas IRCA + severidad), Agente Validador (3 reglas anti-anomalía), tabla `normativa_chunks` con tsvector + pgvector, ingestar-normativa con 10 artículos preset, anti-duplicados.
- **0.1.0 — Semana 1 (2026-04-01)**: MVP — pipeline cliente IRCA v1 (3 percentiles), dashboard básico (Leaflet/KPI/tabla), DatasetManager, PanicButton, fallback localStorage.

Cada entrada con secciones `Added`, `Changed`, `Fixed`.

### 3. `ARCHITECTURE.md` — nuevo

Documento técnico con 5 secciones:

1. **¿Por qué este stack?** — tabla justificando React/TS/Vite, Tailwind/shadcn, Leaflet, TanStack Query, Supabase, Deno, Gemini, FTS.
2. **Pipeline IRCA v3 paso a paso** — 5 pasos (DIVIPOLA → BDUA → REPS → UNGRD → Cálculo) con las **3 tablas de tramos** completas (vulnerabilidad 45%, exposición 30%, contexto 25%), las penalizaciones duras y los rangos de clasificación.
3. **RAG con normativa colombiana** — indexación tsvector español, query SQL `buscar_normativa_fts`, inyección en Analista (function calling) y Reportero (proactivo), justificación de FTS sobre embeddings.
4. **Comunicación entre Edge Functions** — diagrama ASCII mostrando que la comunicación es vía estado en PostgreSQL, no llamadas directas; ventajas del patrón.
5. **Resumen de decisiones de diseño**: por qué RLS público, por qué sin auth obligatoria, por qué Gemini sobre OpenAI (contexto 1M, costo, gateway sin API keys), por qué umbrales absolutos, por qué pipeline server-side, por qué HTML sobre PDF, por qué auditoría agéntica obligatoria.

### 4. `AGENTS.md` — nuevo

Especificación detallada de los 4 agentes:

- Para cada uno: tabla con propósito, modelo, edge function, trigger, inputs, outputs.
- **Vigía**: lógica `severidadFromDelta`, ejemplo de registro `agent_runs`, caso de uso (La Niña → alerta Quibdó).
- **Validador**: tabla con las 3 reglas (subregistro_reps, sin_eventos_ungrd, outlier_camas) + caso real Riosucio.
- **Analista**: **system prompt exacto** transcrito, tabla con las 6 tools, loop ReAct de 5 iteraciones, registro en `agent_runs`, 2 ejemplos de preguntas con flujo esperado paso a paso.
- **Reportero**: pipeline interno de 6 pasos, prompt JSON-output transcrito, caso real Chocó.
- Sección final **"Trazabilidad agéntica"** con query SQL para auditar `agent_runs`.

### 5. Comentarios en código (sin tocar lógica)

**`supabase/functions/_shared/pipeline.ts`** — añadir comentarios de bloque explicando cada paso del IRCA: normalización de nombres, índices de matching, fallback de población BDUA, mapeo REPS, parsing de DIVIPOLA en UNGRD, fórmulas A/B/C con referencias OMS/UARIV, penalizaciones duras y umbrales de clasificación. (El archivo ya tiene comentarios; se enriquecen sin alterar código.)

**`supabase/functions/chat-analista/index.ts`** — comentarios explicando: rol del system prompt, las 6 tools y por qué cada una, el wrapper `findMuni` con búsqueda por código vs nombre, el loop ReAct (creación de conversación → carga de historial → llamada Gemini → ejecución de tools → re-loop), el manejo de errores 429/402 y el registro completo en `agent_runs`.

**`supabase/functions/vigia-monitor/index.ts`** — comentarios explicando: por qué se necesitan 2 snapshots, la función `severidadFromDelta` con sus umbrales, la regla mínima `delta < 3 → ignorar`, el matching de suscripciones (severidad mínima + filtros de depto/muni + umbral IRCA) y el envío opcional con Resend.

**Garantía**: solo se añaden líneas `//` y bloques `/* ... */`. No se modifica ningún identificador, expresión, condición ni return.

---

### Archivos no tocados

- Toda la lógica TypeScript/React.
- Todas las migraciones SQL.
- `supabase/functions/_shared/cors.ts`, `validador-cross/index.ts`, `reporte-ejecutivo/index.ts`, `ingestar-normativa/index.ts`, `snapshot-irca/index.ts` (ya están suficientemente claros y no son requeridos por el prompt).
- `package.json`, `vite.config.ts`, `tailwind.config.ts`, `index.html`, `.env`.
- `public/data/files/README.md` (es el README histórico de la versión Python; se preserva como referencia documental).

### Resultado esperado

Un repositorio que un jurado técnico pueda recorrer en 10 minutos y entender: qué resuelve, cómo está construido, qué decisiones tomamos, cómo razonan los agentes y cómo verificar todo en producción — sin abrir un solo archivo de código.
