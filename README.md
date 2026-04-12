# RutaVital IA

## MVP — Concurso "Datos al Ecosistema 2026: IA para Colombia" — MinTIC

Sistema de priorización territorial de atención en salud basado en el **Índice de Riesgo de Continuidad Asistencial (IRCA)** para los 32 municipios del departamento de Chocó, Colombia. Conecta datos abiertos oficiales en tiempo real y los convierte en decisiones accionables para gestores de salud pública.

---

## Problema que resuelve

Chocó concentra las brechas de salud más severas del país: baja disponibilidad de camas, alta incidencia de emergencias naturales y acceso vial crítico. Los gestores departamentales no tienen una herramienta que integre datos dispersos (MinSalud, UNGRD, DANE) y los convierta en un ranking de riesgo actualizable en tiempo real sin depender de un backend propio.

---

## Solución

Dashboard web que:

1. **Descarga** datos oficiales desde `datos.gov.co` (Socrata API) en el navegador del usuario
2. **Calcula** el IRCA municipio por municipio usando un pipeline TypeScript (sin servidor)
3. **Visualiza** el riesgo en mapa interactivo, tarjetas KPI, gráfico de distribución y tabla navegable
4. **Permite** reportar eventos de emergencia con persistencia en Supabase (o localStorage si sin conexión)

---

## Arquitectura

```text
datos.gov.co (Socrata API)
  ├── DIVIPOLA       gdxc-w37w   → llave territorial, coordenadas
  ├── REPS           s2ru-bqt6   → camas habilitadas por municipio
  ├── UNGRD 2019-22  wwkg-r6te   → eventos históricos de emergencia
  └── UNGRD 2023-24  rgre-6ak4   → eventos recientes

Navegador (React + TypeScript)
  ├── datasets.ts    → fetchers Socrata + pipeline IRCA
  ├── reportes.ts    → store de reportes (Supabase ↔ localStorage)
  └── DatasetManager → UI de gestión: Fuentes | Pipeline | Linaje

Supabase (opcional)
  └── tabla reportes → alertas enviadas por operadores de campo
```

---

## Índice IRCA — Metodología

El **IRCA** es el promedio aritmético de tres percentiles uniformes (equivalente a `QuantileTransformer(output_distribution='uniform')` de scikit-learn):

| Componente | Variable cruda | Dirección | Peso |
| --- | --- | --- | --- |
| Vulnerabilidad sanitaria | Camas / 1 000 hab | Invertido (menos camas = más riesgo) | 1/3 |
| Exposición histórica | Nº de eventos UNGRD | Directo | 1/3 |
| Severidad vial | (vías + puentes averiados) / eventos | Directo | 1/3 |

Clasificación: **Bajo** (0–0.25) · **Medio** (0.25–0.50) · **Alto** (0.50–0.75) · **Crítico** (≥ 0.75)

---

## Stack tecnológico

| Capa | Tecnología |
| --- | --- |
| Frontend | React 18 + TypeScript + Vite |
| Estilos | Tailwind CSS + shadcn/ui |
| Mapas | Leaflet + react-leaflet |
| Gráficos | Recharts |
| Datos | Socrata Open Data API (datos.gov.co) |
| Notificaciones | Sonner (toast) |
| Backend opcional | Supabase (reportes de campo) |
| Testing | Vitest |

---

## Fuentes de datos oficiales

| Dataset | Entidad | ID Socrata | Descripción |
| --- | --- | --- | --- |
| DIVIPOLA | DANE | `gdxc-w37w` | Codificación oficial de municipios |
| Proyecciones de Población 2018–2035 | DANE | referencia | Proyecciones municipales (integradas) |
| REPS Capacidad Instalada | MinSalud | `s2ru-bqt6` | Camas habilitadas por IPS/ESE |
| Emergencias UNGRD 2019–2022 | UNGRD | `wwkg-r6te` | Eventos históricos de emergencia |
| Emergencias UNGRD 2023–2024 | UNGRD | `rgre-6ak4` | Eventos recientes con GPS |

---

## Instalación y desarrollo

```bash
# Prerrequisitos: Node.js >= 18, bun o npm

git clone <repo>
cd ritalvital

bun install        # o npm install

# Opcional: configurar Supabase
cp .env.example .env
# Editar VITE_SUPABASE_URL y VITE_SUPABASE_ANON_KEY

bun run dev        # http://localhost:8080
```

### Variables de entorno

| Variable | Requerida | Descripción |
| --- | --- | --- |
| `VITE_SUPABASE_URL` | No | URL del proyecto Supabase para reportes |
| `VITE_SUPABASE_ANON_KEY` | No | Clave anon de Supabase |
| `VITE_DATOS_GOV_TOKEN` | No | App token de datos.gov.co (aumenta rate limit) |
| `VITE_BACKEND_URL` | No | URL del backend Python (legacy, no usado actualmente) |

> La app funciona **sin ninguna variable de entorno**. Los reportes se guardan en localStorage si Supabase no está configurado.

---

## Estructura del proyecto

```text
src/
├── components/
│   ├── dashboard/
│   │   ├── AboutModal.tsx             Acerca de / metodología
│   │   ├── DashboardHeader.tsx        Encabezado + botones de navegación
│   │   ├── DashboardFooter.tsx        Pie de página
│   │   ├── DatasetManager.tsx         Módulo gestión de datos (Fuentes/Pipeline/Linaje)
│   │   ├── DataTable.tsx              Tabla paginada de municipios
│   │   ├── DetailPanel.tsx            Panel lateral de detalle por municipio
│   │   ├── KpiCards.tsx               Tarjetas de métricas agregadas
│   │   ├── MapLegend.tsx              Leyenda del mapa de riesgo
│   │   ├── PanicButton.tsx            Botón reporte de evento de emergencia
│   │   ├── ReportesPanel.tsx          Lista de reportes enviados
│   │   ├── RiskBadge.tsx              Badge de nivel de riesgo
│   │   ├── RiskDistributionChart.tsx  Gráfico distribución IRCA
│   │   ├── RiskMap.tsx                Mapa Leaflet con coropletas
│   │   └── historico/                 Componentes retirados (referencia)
│   └── ui/                            shadcn/ui (no modificar manualmente)
├── lib/
│   ├── datasets.ts                    Catálogo, fetchers Socrata, pipeline IRCA
│   ├── reportes.ts                    Store de reportes (Supabase / localStorage)
│   ├── supabase.ts                    Cliente Supabase nullable
│   └── utils.ts                       cn() de shadcn
├── pages/
│   ├── Index.tsx                      Página principal
│   └── NotFound.tsx                   404
├── types/
│   └── municipio.ts                   Tipo Municipio (18 campos)
└── historico/                         Archivos CSS retirados
```

---

## Flujo de uso del módulo de datos

1. Abrir **Gestión de datos** desde el encabezado
2. En la pestaña **Fuentes**: hacer clic en "Cargar" para cada fuente (DIVIPOLA, REPS, UNGRD)
3. Expandir cualquier fuente con "Ver datos" para inspeccionar los registros en la tabla drill-down
4. En la pestaña **Pipeline**: clic en "Ejecutar pipeline IRCA" — actualiza el dashboard en tiempo real
5. En la pestaña **Linaje**: verificar cobertura por municipio y trazabilidad de campos

---

## Manejo de errores en datos

El sistema aplica estrategias de recuperación en cascada:

- **UNGRD**: intenta 5 filtros WHERE sucesivos (`LIKE`, `starts_with`, por depto, sin filtro) antes de lanzar error
- **REPS**: intenta con filtro de departamento, luego sin él + filtro client-side
- **Timeout**: 30 segundos por request Socrata
- **CORS/red**: error diferenciado de errores HTTP de la API
- **Socrata errors**: parseo de `{ message, code }` del JSON de error (no solo el texto HTTP)

---

## Reportes de campo

Los operadores pueden enviar alertas desde el **Panel de detalle** de cualquier municipio:

- Con Supabase: persiste en tabla `reportes` con timestamp y municipio
- Sin Supabase: persiste en `localStorage` del navegador como fallback automático
- Notificaciones via toast (Sonner) — sin `alert()` bloqueante

---

## Historial de cambios

Ver [CHANGELOG.md](./CHANGELOG.md) para el registro detallado de versiones.

---

## Licencia

Proyecto académico — MinTIC Concurso Datos al Ecosistema 2026. Datos bajo licencia abierta CC BY 4.0 (datos.gov.co).
