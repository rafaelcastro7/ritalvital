# RutaVital IA

![React](https://img.shields.io/badge/React-18-61DAFB?logo=react&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?logo=typescript&logoColor=white)
![Vite](https://img.shields.io/badge/Vite-5-646CFF?logo=vite&logoColor=white)
![Tailwind](https://img.shields.io/badge/Tailwind-3-06B6D4?logo=tailwindcss&logoColor=white)
![Supabase](https://img.shields.io/badge/Supabase-Cloud-3FCF8E?logo=supabase&logoColor=white)
![Gemini](https://img.shields.io/badge/Gemini%202.5-Flash%20%2F%20Pro-4285F4?logo=google&logoColor=white)
![Leaflet](https://img.shields.io/badge/Leaflet-Maps-199900?logo=leaflet&logoColor=white)
![Datos abiertos](https://img.shields.io/badge/datos.gov.co-Socrata-FFC107)
![Licencia](https://img.shields.io/badge/datos-CC%20BY%204.0-blue)

> **Sistema agéntico de priorización territorial de salud pública para los 1.122 municipios de Colombia, alimentado 100 % con datos abiertos oficiales del Estado.**

---

## El problema

Los gestores de salud en Colombia — alcaldías, secretarías departamentales, Ministerio de Salud, UNGRD y veedurías ciudadanas — **no cuentan con una herramienta unificada** que integre las múltiples fuentes oficiales (DANE, MinSalud-REPS, UNGRD, BDUA) y las traduzca en una decisión accionable: *¿dónde estamos a punto de fallar en la prestación del servicio de salud?*

Cada entidad publica datos valiosos en `datos.gov.co`, pero:

- Los formatos, granularidades y llaves territoriales son **inconsistentes** entre fuentes.
- No existe un **índice compuesto** público que combine vulnerabilidad sanitaria, exposición a desastres y contexto territorial.
- El conocimiento normativo (Resolución 2115/2007, Ley 1751/2015, Resolución 3100/2019) **no está conectado** a los datos operativos.
- La vigilancia es **reactiva**: las alertas llegan cuando ya hubo una crisis, no antes.

El resultado son brechas críticas — especialmente en el Pacífico, la Amazonía y la Orinoquía — donde poblaciones enteras quedan sin red asistencial durante emergencias y nadie lo nota hasta que aparece en prensa.

---

## La solución

**RutaVital IA** descarga, cruza, valida y prioriza datos abiertos oficiales en tiempo real, calcula el **Índice de Riesgo de Continuidad Asistencial (IRCA v3)** para cada municipio del país y lo expone en un dashboard público con:

- **Mapa coroplético nacional** con clasificación Bajo / Medio / Alto / Crítico.
- **4 agentes de IA** que monitorean, validan, conversan y reportan automáticamente.
- **Búsqueda semántica de normativa** colombiana de salud (RAG con FTS español).
- **Reportes ejecutivos** generados por IA que citan el marco normativo aplicable.

Todo el código es **open source**, todos los datos son **oficiales y abiertos**, y todo el sistema funciona **sin requerir registro** del usuario final.

---

## 🤖 Agentes de IA

El sistema opera como una **red de agentes especializados** orquestados desde Edge Functions. Cada ejecución queda auditada en la tabla `agent_runs` (modelo, tokens, duración, status, herramientas usadas).

| Agente | Modelo | Inputs | Outputs |
|---|---|---|---|
| **🛰️ Vigía** | Motor de reglas (`rule-engine-v1`) | Últimos 2 snapshots de `irca_snapshots` | Inserta en `alertas` cuando detecta deltas IRCA ≥ 3 pts; clasifica severidad y notifica suscriptores por email |
| **🔍 Validador** | Motor de reglas (`rule-engine-v1`) | Snapshot vigente + componentes (camas, eventos, población) | Inserta en `validaciones` anomalías cruzadas: subregistro REPS, ausencia de eventos UNGRD en municipios críticos, outliers de capacidad hospitalaria |
| **💬 Analista** | `google/gemini-2.5-flash` | Pregunta del usuario + 6 herramientas (consultar municipio, top críticos, comparar, tendencia, alertas, buscar normativa) | Respuesta conversacional con citas DIVIPOLA + artículos normativos. Loop ReAct hasta 5 iteraciones |
| **📄 Reportero** | `google/gemini-2.5-flash` | Código de departamento | Resumen ejecutivo + recomendaciones operativas + marco normativo aplicable (RAG), entregado como HTML en bucket público |

Todos los modelos se invocan vía **Lovable AI Gateway** — no se requiere API key del usuario.

Detalle completo en [`AGENTS.md`](./AGENTS.md).

---

## 📊 Fuentes de datos abiertos

Toda la información proviene de portales oficiales del Estado colombiano bajo licencia **CC BY 4.0**:

| Fuente | Entidad | Dataset Socrata | URL |
|---|---|---|---|
| **DIVIPOLA** | DANE | `gdxc-w37w` | <https://www.datos.gov.co/Mapas-Nacionales/DIVIPOLA-C-digos-municipios/gdxc-w37w> |
| **REPS — Capacidad Instalada** | MinSalud | `s2ru-bqt6` | <https://www.datos.gov.co/Salud-y-Protecci-n-Social/REPS-CAPACIDAD-INSTALADA/s2ru-bqt6> |
| **UNGRD — Emergencias 2023-2024** | UNGRD | `rgre-6ak4` | <https://www.datos.gov.co/Ambiente-y-Desarrollo-Sostenible/Consolidado-de-Emergencias-y-Eventos/rgre-6ak4> |
| **UNGRD — Emergencias 2019-2022** | UNGRD | `wwkg-r6te` | <https://www.datos.gov.co/Ambiente-y-Desarrollo-Sostenible/Emergencias-2019-2022/wwkg-r6te> |
| **BDUA Subsidiado** | MinSalud | `d7a5-cnra` | <https://www.datos.gov.co/Salud-y-Protecci-n-Social/BDUA-Subsidiado/d7a5-cnra> |
| **BDUA Contributivo** | MinSalud | `tq4m-hmg2` | <https://www.datos.gov.co/Salud-y-Protecci-n-Social/BDUA-Contributivo/tq4m-hmg2> |

**Normativa indexada** (RAG): Resolución 2115/2007, Resolución 3100/2019, Ley 1751/2015 (Estatutaria de Salud), Decreto 1575/2007.

---

## 🏗️ Arquitectura

```text
┌─────────────────────────────────────────────────────────────────────┐
│                  datos.gov.co  (Socrata Open Data API)              │
│   DIVIPOLA  ·  REPS  ·  UNGRD 23-24  ·  BDUA Sub  ·  BDUA Con       │
└────────────────────────────────┬────────────────────────────────────┘
                                 │ fetch
                                 ▼
┌─────────────────────────────────────────────────────────────────────┐
│           EDGE FUNCTIONS  (Deno · Lovable Cloud / Supabase)         │
│                                                                     │
│   snapshot-irca ──▶ _shared/pipeline.ts  (motor IRCA v3)            │
│        │                                                            │
│        ▼                                                            │
│   irca_snapshots ◀── vigia-monitor ──▶ alertas                      │
│        │             validador-cross ──▶ validaciones               │
│        │                                                            │
│        ├──▶ chat-analista  ──▶ Lovable AI (Gemini 2.5 Flash)        │
│        │         │                                                  │
│        │         └──▶ buscar_normativa_fts (RAG sobre tsvector)     │
│        │                                                            │
│        └──▶ reporte-ejecutivo ──▶ Gemini + RAG ──▶ Storage HTML     │
│                                                                     │
│   ingestar-normativa ──▶ normativa_chunks (FTS español)             │
│                                                                     │
│   Toda ejecución ─────▶ agent_runs  (auditoría agéntica)            │
└────────────────────────────────┬────────────────────────────────────┘
                                 │ supabase-js
                                 ▼
┌─────────────────────────────────────────────────────────────────────┐
│                   FRONTEND  (React 18 + Vite + Tailwind)            │
│                                                                     │
│   /          Dashboard nacional (mapa Leaflet + KPIs + tabla)       │
│   /chat      Chat con el Agente Analista                            │
│   /reportes  Generador de reportes ejecutivos por depto             │
│   /normativa Buscador FTS de normativa de salud                     │
│   /admin     Disparar pipeline e ingesta de normativa               │
└─────────────────────────────────────────────────────────────────────┘
```

Detalles completos en [`ARCHITECTURE.md`](./ARCHITECTURE.md).

---

## 🧰 Stack tecnológico

### Frontend
- React 18 · TypeScript 5 · Vite 5
- Tailwind CSS 3 + shadcn/ui (Radix Primitives)
- React Router v6 · TanStack Query
- Leaflet + react-leaflet (mapas coropletas)
- Recharts (visualización de distribución)
- Sonner (toasts no bloqueantes)

### Backend
- **Lovable Cloud** sobre Supabase (PostgreSQL gestionado)
- Edge Functions en Deno (TypeScript runtime serverless)
- Supabase Storage (bucket público `reportes`)
- Supabase Auth (opcional — el sistema funciona sin login)

### Inteligencia Artificial
- **Lovable AI Gateway** (sin API key del usuario)
- `google/gemini-2.5-flash` — chat conversacional + síntesis de reportes
- `google/gemini-2.5-pro` — disponible para razonamiento extendido
- RAG implementado con **PostgreSQL FTS español** (`tsvector` + `plainto_tsquery`)
- `pgvector` instalado y `match_normativa()` listos para embeddings reales

### Base de datos
- PostgreSQL 15 con extensiones `pgvector`, `pg_trgm`
- Tablas con RLS pública en datos operativos (modo abierto al ciudadano)
- Funciones SQL `SECURITY DEFINER`: `has_role`, `buscar_normativa_fts`, `match_normativa`
- Triggers: `handle_new_user`, `update_updated_at_column`

### Datos abiertos
- API Socrata sobre `datos.gov.co` (sin autenticación; opcional `VITE_DATOS_GOV_TOKEN` para mayor rate limit)

---

## 🚀 Instalación y ejecución local

### Prerrequisitos
- Node.js ≥ 18 o [Bun](https://bun.sh)
- Un proyecto de Lovable Cloud / Supabase (opcional — el frontend corre sin él en modo demo)

### Pasos

```bash
git clone <repo>
cd ritalvital

bun install        # o npm install
bun run dev        # http://localhost:8080
```

### Variables de entorno (opcionales)

El archivo `.env` se autogenera al conectar Lovable Cloud. Para desarrollo manual:

| Variable | Requerida | Descripción |
|---|---|---|
| `VITE_SUPABASE_URL` | No | URL del backend |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | No | Anon key del backend |
| `VITE_DATOS_GOV_TOKEN` | No | App token de datos.gov.co (mayor rate limit) |

### Disparar el pipeline por primera vez

1. Abrir `/admin` en el navegador.
2. Clic en **"Generar snapshot IRCA"** — descarga ~15.000 registros de Socrata, calcula el IRCA y persiste ~1.122 filas en `irca_snapshots`.
3. Clic en **"Cargar normativa preset"** — ingesta 10 artículos clave en `normativa_chunks`.
4. Volver a `/` para ver el dashboard nacional poblado.

---

## 🖥️ Vistas principales

| Ruta | Descripción |
|---|---|
| **`/`** | Dashboard nacional. Mapa Leaflet con coropletas por nivel de riesgo, tarjetas KPI agregadas, gráfico de distribución, tabla paginada con filtros, panel de detalle por municipio. |
| **`/chat`** | Conversación con el **Agente Analista**. Pregunta libre en español; el agente decide qué herramientas invocar (consultar municipio, comparar, top críticos, normativa…). |
| **`/reportes`** | Generador del **Agente Reportero**. Selecciona un departamento → recibe HTML ejecutivo descargable con resumen, top municipios, recomendaciones y marco normativo. |
| **`/normativa`** | Buscador FTS español sobre la base normativa indexada. |
| **`/admin`** | Panel de operación: disparar snapshot, ingestar normativa, ver runs recientes. |

---

## 🎯 Impacto

- **Cobertura nacional**: 1.122 municipios analizados (no solo el departamento piloto original).
- **Distribución observada**: ~283 críticos, ~100 altos, ~540 medios, ~199 bajos — alineado con la realidad documentada por DNP, UARIV y MinSalud.
- **Casos de uso reales**:
  - **Alcaldías municipales** identifican su posición relativa nacional y descargan reportes para sustentar planes de contingencia.
  - **Secretarías departamentales de salud** monitorean cambios bruscos en el IRCA de sus municipios sin consultar 5 portales distintos.
  - **MinSalud y UNGRD** detectan zonas con 0 camas reportadas y >10.000 habitantes (penalización dura → Crítico) que requieren intervención prioritaria.
  - **Veedurías y prensa** usan el chat conversacional para preguntar "¿qué municipios del Pacífico están en riesgo crítico sin eventos UNGRD reportados?" — y reciben respuestas con citas normativas.
- **Trazabilidad agéntica**: cada ejecución de IA queda en `agent_runs` con tokens, duración y errores — auditable por el ciudadano.
- **Cero dependencia de proveedores cerrados**: 100 % software libre + datos abiertos + IA vía gateway sin API keys propias.

---

## 📚 Documentación adicional

- [`ARCHITECTURE.md`](./ARCHITECTURE.md) — Decisiones técnicas, fórmula IRCA detallada, RAG, comunicación entre Edge Functions
- [`AGENTS.md`](./AGENTS.md) — Especificación completa de los 4 agentes, prompts, ejemplos
- [`CHANGELOG.md`](./CHANGELOG.md) — Historial de versiones

---

## Licencia

Proyecto académico — **MinTIC Concurso "Datos al Ecosistema 2026: IA para Colombia"**.
Datos bajo licencia abierta **CC BY 4.0** (`datos.gov.co`).
Código fuente bajo licencia MIT.
