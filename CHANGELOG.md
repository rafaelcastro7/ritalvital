# Changelog

Todos los cambios notables a este proyecto se documentan en este archivo.
El formato sigue [Keep a Changelog](https://keepachangelog.com/es-ES/1.1.0/) y el versionado [SemVer](https://semver.org/lang/es/).

---

## [0.4.0] — 2026-04-22 · Esta semana — Pulido final y escalado nacional

### Added
- Documentación profesional del repositorio: `README.md` reescrito, `ARCHITECTURE.md` y `AGENTS.md` nuevos.
- Comentarios técnicos en español en `pipeline.ts`, `chat-analista` y `vigia-monitor` para facilitar revisión por jurados.
- Sección "Marco normativo aplicable" en los reportes ejecutivos del Agente Reportero (RAG sobre normativa).
- Página pública `/normativa` con buscador FTS español sobre artículos cargados.
- 10 artículos clave de normativa colombiana de salud cargados en `normativa_chunks` (Resolución 2115/2007, 3100/2019, Ley 1751/2015, Decreto 1575/2007).

### Changed
- Pipeline IRCA v3 con **umbrales absolutos** basados en estándar OMS (3.5 camas/1000 hab) en lugar de percentiles relativos — corrige el problema de "ningún municipio crítico" en países con brechas reales.
- Pesos rebalanceados: vulnerabilidad sanitaria 45 %, exposición a desastres 30 %, contexto territorial 25 %.
- Penalizaciones duras automáticas: municipios con >10.000 hab y 0 camas → Crítico forzado.
- Acceso 100 % público sin necesidad de autenticación: `verify_jwt = false` en todas las edge functions operativas.
- Header del dashboard limpiado (sin enlaces a `/auth` ni `/cuenta`); se añadió enlace a `/normativa`.
- Cobertura ampliada: del piloto original de Chocó (32 municipios) a los **1.122 municipios** del país.

### Fixed
- Mapeo correcto de campos Socrata: `cod_mpio` (DIVIPOLA), `nom_grupo_capacidad='CAMAS'` (REPS), `codificaci_n_segun_divipola` (UNGRD).
- Función `norm()` mejorada: elimina "D.C." y artículos ("de", "del", "la", "los") para emparejar nombres entre fuentes con notaciones distintas.
- Población real estimada vía BDUA (Subsidiado + Contributivo) × 1.05, en lugar del valor por defecto de 8.000 hab.
- Tipo de columna `irca_score` migrado de `numeric(5,4)` a `numeric(6,2)` para soportar valores absolutos hasta 100.
- Edge function `reporte-ejecutivo` autogenera snapshot si no existe, evitando error "Sin snapshots disponibles".

---

## [0.3.0] — 2026-04-15 · Semana 3 — Agentes Analista y Reportero

### Added
- **Agente Analista** (`/chat`) — chat conversacional con `google/gemini-2.5-flash`, loop ReAct de hasta 5 iteraciones y 6 herramientas: `consultar_municipio`, `top_criticos`, `comparar_municipios`, `tendencia_municipio`, `alertas_recientes`, `buscar_normativa`.
- **Agente Reportero** (`/reportes`) — genera HTML ejecutivo por departamento, lo sube al bucket público `reportes` y registra en tabla `reportes`.
- Tabla `conversaciones` y `mensajes` para persistir el historial del chat.
- Tabla `reportes` con `tipo` (`ejecutivo` | `municipal`) y URL pública.
- System prompt riguroso del Analista: prohíbe inventar cifras, obliga a citar DIVIPOLA + fecha de snapshot + artículo normativo.
- Bucket de Storage público `reportes` con políticas de lectura abierta.

### Changed
- Tabla `agent_runs` extendida con `herramientas_usadas`, `tokens_in`, `tokens_out`, `conversacion_id` para auditoría agéntica completa.
- Sistema unificado de invocación a Lovable AI Gateway (manejo de 429 y 402).

### Fixed
- Manejo correcto de mensajes con `tool_calls` al recargar historial de conversación.
- Subida de HTML al bucket con `contentType: "text/html"` explícito.

---

## [0.2.0] — 2026-04-08 · Semana 2 — Agentes Vigía y Validador, RAG normativo

### Added
- **Agente Vigía** (`vigia-monitor`) — compara los últimos 2 snapshots, detecta deltas IRCA ≥ 3 pts y genera registros en tabla `alertas` con severidad calculada (`baja` | `media` | `alta` | `critica`).
- **Agente Validador** (`validador-cross`) — detecta tres tipos de anomalías: subregistro REPS (0 camas + >20.000 hab), ausencia de eventos UNGRD en municipios críticos y outliers de capacidad (>50 camas/1000 hab).
- Tabla `normativa_chunks` con extensión `pgvector` (columna `embedding vector(768)`) y `tsvector` para búsqueda léxica en español.
- Edge function `ingestar-normativa` con preset de Resolución 2115/2007, 3100/2019, Ley 1751/2015 y Decreto 1575/2007.
- Función SQL `buscar_normativa_fts(query_text, match_count, filter_norma)` con `plainto_tsquery('spanish', ...)` y `ts_rank`.
- Función SQL `match_normativa(query_embedding, ...)` lista para embeddings reales (operador `<=>`).
- Tabla `validaciones` y `alertas` con RLS pública de lectura.
- Tabla `suscripciones` para notificaciones por email (integración Resend opcional).
- Sistema anti-duplicados: el Validador no inserta validaciones idénticas creadas en las últimas 24 h.

### Changed
- Snapshot diario centralizado en `irca_snapshots` con `pipeline_version` y `componentes` jsonb por municipio.
- Severidad calculada en función del delta y el score absoluto: `score >= 75 && delta >= 5 → critica`.

### Fixed
- Idempotencia del snapshot diario: borra el snapshot del día antes de insertar el nuevo.
- Inserts por lotes de 500 filas para evitar timeouts en Edge Function.

---

## [0.1.0] — 2026-04-01 · Semana 1 — MVP inicial

### Added
- Proyecto inicial scaffolded con Vite + React 18 + TypeScript + Tailwind + shadcn/ui.
- Pipeline IRCA cliente-side (`src/lib/datasets.ts`) con fetchers Socrata para DIVIPOLA, REPS y UNGRD.
- Dashboard básico con `RiskMap` (Leaflet), `KpiCards`, `DataTable`, `RiskDistributionChart`, `MapLegend`, `DetailPanel`.
- Modal "Acerca de" con metodología IRCA y créditos a fuentes oficiales.
- Componente `DatasetManager` con pestañas Fuentes / Pipeline / Linaje y drill-down de registros.
- Componente `PanicButton` para reportes de campo desde el panel de detalle.
- Tabla `reportes` con fallback a `localStorage` cuando Supabase no está configurado.
- Tipo `Municipio` (18 campos) y contexto `FilterContext` para filtros globales.
- Configuración base de RLS, autenticación email/password y rol `app_role` enum (`admin`, `gestor`, `ciudadano`).
- Versión Python original (`pipeline.py` + `app.py` Streamlit) preservada en `public/data/files/` como referencia documental del cálculo.

### Changed
- IRCA v1: promedio de 3 percentiles uniformes (vulnerabilidad sanitaria, exposición histórica, severidad vial) — modelo relativo basado en `QuantileTransformer`.

### Fixed
- Manejo de errores en cascada para Socrata: 5 filtros WHERE sucesivos en UNGRD, fallback de timeout 30 s, parseo de errores `{message, code}`.
- Notificaciones no bloqueantes con Sonner en lugar de `alert()`.
