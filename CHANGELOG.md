# CHANGELOG — RutaVital IA

Registro cronológico de cambios significativos. Formato basado en [Keep a Changelog](https://keepachangelog.com/es/1.0.0/).

---

## [Unreleased]

### Pendiente
- Integración de autenticación Supabase con RLS por rol (admin / operador)
- Modo offline completo con Service Worker
- Exportación de informe PDF por municipio

---

## [0.4.0] — 2026-04-12

### Añadido
- **Módulo Gestión de Datasets** (`DatasetManager.tsx`): pantalla completa con 3 pestañas
  - **Fuentes**: 5 tarjetas con estado, calidad, cobertura y tabla drill-down interactiva por fuente
  - **Pipeline**: diagrama de flujo ETL → IRCA, log de ejecución, distribución de riesgo post-run
  - **Linaje**: tabla de linaje de campos IRCA + matriz 32 municipios × 5 fuentes
- Botón "Gestión de datos" en `DashboardHeader` accesible desde cualquier estado de carga
- Tabla drill-down: búsqueda full-text, ordenamiento por columna, paginación (25/50/100), exportación CSV, toggle columnas prioritarias vs. todas, barra de completitud por columna
- `DatasetManager` ahora se renderiza fuera del early-return de carga — siempre accesible
- Estrategia de fallback en cascada para fetchers UNGRD (5 estrategias WHERE antes de lanzar error)
- Mejor parseo de errores Socrata: se extrae `message` del JSON de error en lugar de texto crudo
- Timeout de 30 s y detección de errores de red/CORS en `socrataFetch`
- `filterChocoUngrd`: función robusta que acepta campos `divipola`, `cod_divipola`, `codigo_divipola`

### Cambiado
- `DashboardHeader`: prop `onPipelineUploaded` → `onDatasetManagerOpen`; ícono `Database` de lucide-react
- `Index.tsx`: estado `pipelineDate` + callback `handleDataUpdate(newData, runAt)`
- `datasets.ts`: `socrataFetch` con manejo de errores HTTP y JSON de Socrata; nuevo helper `socrataFetchWithFallback`

### Reciclado a `historico/`
- `src/components/NavLink.tsx` → `src/components/historico/` (no importado en ningún lugar)
- `src/components/dashboard/UploadPipelineButton.tsx` → `src/components/dashboard/historico/` (reemplazado por DatasetManager)
- `src/App.css` → `src/historico/` (sin importaciones)

---

## [0.3.0] — 2026-04-11

### Añadido
- **Sistema de reportes** (`reportes.ts`): abstracción con fallback a `localStorage` cuando Supabase no está configurado
- `PanicButton.tsx`: reescrito con Sonner toast, modal backdrop click-to-close, prop `onSent`
- `ReportesPanel.tsx`: reescrito con `getReportes()` de `reportes.ts`
- `.env.example` con variables `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_BACKEND_URL`
- `datasets.ts` (nuevo): catálogo `DATASET_CATALOG` con 5 fuentes, fetchers individuales, `computeQuality`, `runIrcaPipeline` completo en TypeScript
- Pipeline IRCA 100 % en cliente: percentiles uniformes (sklearn-compatible), 3 componentes con peso 1/3 cada uno

### Corregido
- `supabase.ts`: `process.env.REACT_APP_*` → `import.meta.env.VITE_*`; exportación nullable para evitar crash sin `.env`
- `DetailPanel.tsx`: `Bar` contenía `PanicButton`/`ReportesPanel` referenciando `m` indefinido — movidos al cuerpo del componente
- `AboutModal.tsx`: "31 municipios" → "32", "2018–2042" → "2018–2035", "sintéticos" → "oficiales abiertos"
- REPS: dataset `c36g-9fc2` (sin camas) → `s2ru-bqt6` (Capacidad Instalada)
- UNGRD: filtro por nombre departamento (encoding) → filtro por DIVIPOLA prefix `'27'`

---

## [0.2.0] — 2026-04-10

### Añadido
- Mapa de riesgo con Leaflet + colores por `nivel_riesgo`
- `DetailPanel` con panel lateral por municipio seleccionado
- `KpiCards` con 4 métricas agregadas
- `RiskDistributionChart` con Recharts
- `DataTable` con ordenamiento y búsqueda
- Integración inicial con Supabase para tabla `reportes`

---

## [0.1.0] — 2026-04-09

### Añadido
- Scaffold inicial Vite + React 18 + TypeScript + Tailwind CSS + shadcn/ui
- Carga de `municipios_riesgo.csv` estático desde `public/data/`
- Estructura base: `DashboardHeader`, `DashboardFooter`, `MapLegend`, `RiskBadge`
- Tipo `Municipio` con 18 campos: IRCA score, nivel riesgo, percentiles, camas, eventos
