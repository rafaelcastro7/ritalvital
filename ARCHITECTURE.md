# Architecture — RutaVital IA

Este documento describe en profundidad las decisiones técnicas, el cálculo del IRCA v3, el funcionamiento del RAG y la comunicación entre componentes.

---

## 1. ¿Por qué este stack?

| Capa | Tecnología | Justificación |
|---|---|---|
| **UI** | React 18 + Vite | Ecosistema maduro, HMR sub-segundo, build estático desplegable en cualquier CDN. Vite evita la complejidad de Next.js y permite mantener el frontend 100 % cliente sin SSR innecesario. |
| **Lenguaje** | TypeScript 5 | Tipado estricto del modelo `Municipio` y de los responses Socrata reduce bugs en producción. |
| **Estilos** | Tailwind 3 + shadcn/ui | Componentes accesibles (Radix) sin dependencia de runtime, fácilmente auditables. Permite cumplir lineamientos GovCo de accesibilidad (WCAG AA). |
| **Mapas** | Leaflet + react-leaflet | Open source puro, sin tokens de Mapbox/Google. Funciona offline con tiles de OpenStreetMap. |
| **Estado servidor** | TanStack Query | Caché declarativa con invalidación, evita re-fetch innecesarios al portal Socrata. |
| **Backend** | Lovable Cloud (Supabase) | PostgreSQL gestionado + Edge Functions Deno + Storage + Auth en una sola plataforma. RLS nativo permite acceso público sin exponer datos sensibles. |
| **Edge runtime** | Deno | Seguro por defecto (permisos explícitos), TypeScript nativo, menor cold start que Node en serverless. |
| **IA** | Lovable AI Gateway → Gemini 2.5 | Sin API key del usuario, sin lock-in con OpenAI, costos predecibles. Gemini Flash tiene contexto de 1 M tokens — útil para inyectar el snapshot completo del país. |
| **RAG** | PostgreSQL FTS español (`tsvector`) | Más simple, más barato y suficiente para 10-100 artículos normativos. `pgvector` está instalado para escalar a embeddings reales sin migración. |

### Decisiones de diseño clave

- **RLS público en tablas operativas**: el ciudadano colombiano debe poder consultar datos de salud pública **sin registrarse**. `irca_snapshots`, `alertas`, `validaciones`, `reportes`, `agent_runs` y `normativa_chunks` tienen políticas `USING (true)`. Tablas sensibles (`profiles`, `user_roles`, `suscripciones`, `entidades`) sí están protegidas con `auth.uid()` o `has_role()`.
- **Sin autenticación obligatoria**: la barrera de registro reduciría la adopción. Auth queda disponible pero opcional para suscripciones por email.
- **Gemini sobre OpenAI**: Gemini 2.5 Flash ofrece contexto de 1 M tokens (vs 128 K de GPT-4o) y precio significativamente menor para el caso de uso de inyectar listados completos de municipios. Además, el Lovable AI Gateway elimina la fricción de gestión de API keys.
- **Edge Functions sobre microservicios**: cada agente es una función serverless aislada que puede escalar independientemente. No hay servidor que mantener.
- **Pipeline server-side**: la versión inicial corría el cálculo en el navegador (12 MB de JSON crudos). Se migró a Edge Function para reducir el tráfico, centralizar el snapshot diario y evitar discrepancias entre usuarios.

---

## 2. Pipeline IRCA v3 paso a paso

El motor vive en [`supabase/functions/_shared/pipeline.ts`](./supabase/functions/_shared/pipeline.ts) y se invoca desde `snapshot-irca` y `reporte-ejecutivo` (auto-snapshot).

### Paso 1 — DIVIPOLA: catálogo oficial
Descarga los 1.122 municipios desde Socrata `gdxc-w37w`. Construye dos índices para emparejar fuentes con nomenclaturas distintas:
- `idxDeptoMuni` → `"DEPTO_NORM|MUNI_NORM" → cod_mpio`
- `idxMuni` → `"MUNI_NORM" → [cod_mpio, ...]`

La función `norm()` normaliza nombres: mayúsculas, sin tildes, sin "D.C.", sin artículos.

### Paso 2 — Población real (BDUA)
Suma afiliados Subsidiados (`d7a5-cnra`) + Contributivos (`tq4m-hmg2`) por municipio. Multiplica × 1.05 para estimar población total (cobertura BDUA ≈ 95 %). Si no hay match, imputa 8.000 hab y marca `poblacion_imputada = true` (penaliza con +10 pts en contexto).

### Paso 3 — Camas hospitalarias (REPS)
Descarga MinSalud `s2ru-bqt6` filtrado por `nom_grupo_capacidad='CAMAS'`. Suma capacidad instalada por municipio. Match dual: primero `depto+muni`, fallback a `muni` si solo hay un homónimo nacional.

### Paso 4 — Eventos de emergencia (UNGRD)
Descarga UNGRD `rgre-6ak4` del último año, agrupado por `codificaci_n_segun_divipola`. Convierte el código a 5 dígitos zero-padded.

### Paso 5 — Cálculo IRCA v3 con umbrales absolutos

Para cada municipio se calculan tres componentes en escala 0-100:

#### A. Vulnerabilidad sanitaria (peso 45 %)

Variable: `camas_por_1000 = (camas / poblacion) × 1000`. Estándar OMS: 3.5. Promedio Colombia: 1.7.

| `camas_por_1000` | Puntaje |
|---|---|
| `camas == 0` | **100** (sin servicio) |
| `≥ 3.5` | 0 |
| `2.0 — 3.5` | 20 + (3.5 − x) × 13.33 |
| `1.0 — 2.0` | 40 + (2.0 − x) × 25 |
| `0.5 — 1.0` | 65 + (1.0 − x) × 40 |
| `< 0.5` | 85 + (0.5 − x) × 30 |

#### B. Exposición a desastres (peso 30 %)

Variable: `eventos_por_10k = (eventos_ultimo_año / poblacion) × 10000`.

| `eventos_por_10k` | Puntaje |
|---|---|
| `≥ 10` | 100 |
| `5 — 10` | 70 + (x − 5) × 6 |
| `2 — 5` | 45 + (x − 2) × 8.33 |
| `0.5 — 2` | 20 + (x − 0.5) × 16.67 |
| `0 — 0.5` | x × 40 |
| `0` | 0 |

#### C. Contexto territorial (peso 25 %)

Suma de penalizaciones documentadas por UARIV, DNP y MinAmbiente:

| Condición | Penalización |
|---|---|
| Departamento en `DEPTOS_CONFLICTO_ALTO` (Chocó, Guainía, Vaupés, Vichada, Amazonas, Guaviare, Guajira, Cauca, Nariño, Caquetá, Putumayo, Arauca) | +50 |
| Departamento en `DEPTOS_DISPERSION` (Pacífico + Amazonía + San Andrés) | +35 |
| Población < 5.000 hab **y** en conflicto | +15 |
| Población imputada (sin dato BDUA) | +10 |

Capado a 100.

#### Score final
```
irca_score = vulnerabilidad × 0.45 + exposicion × 0.30 + contexto × 0.25
```

#### Penalizaciones duras
Sobrescriben el score si se cumplen:

- `camas == 0` y `poblacion > 1.000` → score mínimo **70**
- `camas == 0` y depto en conflicto → score mínimo **80**
- `camas == 0` y `poblacion > 10.000` → score mínimo **85**

#### Clasificación
| Rango | Nivel |
|---|---|
| `≥ 65` | **Crítico** |
| `45 — 65` | **Alto** |
| `25 — 45` | **Medio** |
| `< 25` | **Bajo** |

---

## 3. RAG con normativa colombiana

### Indexación
La edge function `ingestar-normativa` recibe artículos (preset o custom) y los inserta en `normativa_chunks`. Un trigger Postgres calcula automáticamente `search_tsv = to_tsvector('spanish', norma || ' ' || titulo || ' ' || articulo || ' ' || contenido)`.

### Recuperación
La función SQL `buscar_normativa_fts(query_text, match_count, filter_norma)` ejecuta:

```sql
SELECT *, ts_rank(search_tsv, plainto_tsquery('spanish', query_text)) AS rank
FROM normativa_chunks
WHERE search_tsv @@ plainto_tsquery('spanish', query_text)
  AND (filter_norma IS NULL OR norma = filter_norma)
ORDER BY rank DESC
LIMIT match_count;
```

`plainto_tsquery('spanish', ...)` aplica stemming español (Snowball) — "habilitación" matchea "habilitar", "habilitados", etc.

### Inyección en el LLM
- **Agente Analista**: el modelo decide cuándo invocar `buscar_normativa` (function calling). El resultado JSON se devuelve como `role: "tool"` y el modelo lo cita en la respuesta.
- **Agente Reportero**: invoca FTS de forma proactiva con una query construida según el contexto del depto (`"vigilancia calidad agua IRCA municipio crítico prestación servicios salud"`) y los 3 resultados top se renderizan como sección "Marco normativo aplicable" en el HTML.

### Por qué FTS y no embeddings (todavía)
- El corpus normativo es pequeño (10-100 artículos): FTS español tiene precisión > 90 % para queries directas.
- No requiere llamadas externas a un modelo de embeddings (latencia + costo).
- `pgvector` ya está instalado y `match_normativa()` existe — la migración a embeddings reales es un cambio de 1 línea cuando el corpus crezca.

---

## 4. Comunicación entre Edge Functions

Las funciones **no se invocan entre sí directamente**. Comunican vía **estado en PostgreSQL**:

```text
snapshot-irca          escribe → irca_snapshots
                                       ▼
                       leen ← vigia-monitor    (genera alertas)
                       leen ← validador-cross  (genera validaciones)
                       leen ← chat-analista    (responde al usuario)
                       leen ← reporte-ejecutivo (genera HTML)

ingestar-normativa     escribe → normativa_chunks
                                       ▼
                       leen ← chat-analista    (vía buscar_normativa_fts)
                       leen ← reporte-ejecutivo (vía buscar_normativa_fts)

TODAS las funciones    escriben → agent_runs   (auditoría)
```

**Ventajas de este patrón**:
- Funciones desacopladas: cada una puede actualizarse sin afectar a las otras.
- Fácil debugging: cualquier estado intermedio queda persistido.
- Idempotencia natural: re-ejecutar una función no rompe nada.
- Auditable: `agent_runs` es la única fuente de verdad de qué corrió, cuándo, con qué modelo y cuántos tokens.

**Trigger del pipeline**: actualmente manual desde `/admin`. Próximo paso: cron (`pg_cron`) diario a las 03:00 COT.

---

## 5. Resumen de decisiones de diseño

| Decisión | Razón |
|---|---|
| **RLS público en tablas operativas** | Salud pública = bien común. Datos derivados de fuentes abiertas deben ser igualmente abiertos. |
| **Sin autenticación obligatoria** | Bajar fricción para alcaldías y ciudadanos sin perfil técnico. Auth disponible para suscripciones. |
| **Gemini 2.5 Flash** | Contexto 1 M tokens, multilingüe nativo, costo predecible vía Lovable Gateway. |
| **Umbrales absolutos en IRCA v3** | El método relativo (percentiles) generaba "cero municipios críticos" en un país con brechas reales documentadas. Los umbrales OMS son la referencia mundial. |
| **Pipeline server-side** | Snapshot único compartido por todos los usuarios; reduce 12 MB de tráfico Socrata por sesión. |
| **FTS español sobre pgvector** | Suficiente para 10-100 artículos. `pgvector` listo para escalar. |
| **HTML en lugar de PDF** | Renderizable en cualquier navegador, descargable, indexable, sin dependencia de bibliotecas pesadas (Puppeteer/wkhtmltopdf). |
| **Auditoría agéntica obligatoria** | Cada llamada a IA queda en `agent_runs` con tokens, duración y status — requisito ético para sistemas que asisten decisiones públicas. |
