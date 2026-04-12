# RutaVital IA

Herramienta de priorización territorial para identificar municipios con mayor riesgo relativo de afectación de la continuidad asistencial ante emergencias y desastres.

Calcula el **Índice de Riesgo de Continuidad Asistencial (IRCA)** a nivel municipal integrando cuatro fuentes de datos abiertos oficiales de Colombia.

---

## Requisitos

- Python 3.10+
- pip

```bash
pip install -r requirements.txt
```

---

## Uso

### 1. Ejecutar el pipeline de datos

```bash
python pipeline.py
```

Genera:
- `outputs/municipios_riesgo.csv` — resultado con 19 columnas
- `outputs/metadata_pipeline.txt` — metadatos del proceso

### 2. Lanzar el dashboard

```bash
streamlit run app.py
```

Abre el navegador en `http://localhost:8501`.

---

## Estructura del proyecto

```
ruta-vital-ia/
├── pipeline.py              # ETL + cálculo del IRCA
├── app.py                   # Dashboard Streamlit
├── requirements.txt
├── README.md
├── data/
│   ├── divipola.csv         # Llave territorial (ejemplo sintético)
│   ├── poblacion_dane.csv   # Proyecciones de población (ejemplo)
│   ├── reps_nacional.csv    # Camas habilitadas REPS (ejemplo)
│   ├── emergencias_ungrd.csv# Eventos históricos UNGRD (ejemplo)
│   └── choco_municipios.geojson  ← descargar manualmente (ver abajo)
└── outputs/
    ├── municipios_riesgo.csv
    └── metadata_pipeline.txt
```

> **Nota:** Los archivos CSV en `data/` son datos **sintéticos** generados para demostración. Para producción, reemplazarlos con las fuentes oficiales (ver sección siguiente).

---

## Cómo obtener los datos reales

| Fuente | Descripción | Cómo obtenerla |
|--------|-------------|----------------|
| **DIVIPOLA** | Códigos y nombres de municipios | [datos.gov.co](https://www.datos.gov.co) → buscar "DIVIPOLA" |
| **Población DANE** | Proyecciones municipales 2018–2035 | [dane.gov.co](https://www.dane.gov.co/index.php/estadisticas-por-tema/demografia-y-poblacion/proyecciones-de-poblacion) |
| **REPS nacional** | Camas y sedes habilitadas | [datos.gov.co](https://www.datos.gov.co) → identificador `c36g-9fc2` |
| **UNGRD Emergencias** | Historial de eventos y afectaciones viales | [datos.gov.co](https://www.datos.gov.co) → buscar "Emergencias UNGRD" |
| **GeoJSON Chocó** | Polígonos municipales para el mapa | [DANE MGNA](https://geoportal.dane.gov.co/geovisores/territorio/consulta-divipola-municipios/) → descargar Chocó en GeoJSON, guardar como `data/choco_municipios.geojson` |

### Columnas esperadas por el pipeline

| Archivo | Columnas mínimas necesarias |
|---------|----------------------------|
| `divipola.csv` | `cod_municipio`, `municipio`, `depto` |
| `poblacion_dane.csv` | `cod_municipio`, `poblacion` |
| `reps_nacional.csv` | `codigo_municipio`, `camas_habilitadas`, `estado_habilitacion` |
| `emergencias_ungrd.csv` | `cod_municipio`, `fecha`, `vias_averiadas`, `puentes_afectados` |

---

## Modelo: Índice de Riesgo de Continuidad Asistencial (IRCA)

```
IRCA = (pctil_vulnerabilidad_sanitaria + pctil_exposición_histórica + pctil_severidad_vial) / 3
```

| Componente | Descripción |
|-----------|-------------|
| Vulnerabilidad sanitaria | Inverso del percentil de camas por 1.000 hab |
| Exposición histórica | Percentil de eventos UNGRD en ventana de 5 años |
| Severidad vial | Percentil del promedio (vías + puentes) / evento |

La ventana temporal se calcula **automáticamente** como los últimos 5 años calendario completos disponibles en los datos UNGRD descargados.

| Rango IRCA | Nivel | Acción |
|-----------|-------|--------|
| 0.00 – 0.25 | Bajo | Monitoreo rutinario |
| 0.25 – 0.50 | Medio | Validación del plan de contingencia |
| 0.50 – 0.75 | Alto | Notificar comité departamental |
| 0.75 – 1.00 | Crítico | Acción en 24 horas |

---

## Limitaciones conocidas

1. **Subregistro UNGRD**: un municipio sin eventos reportados (`sin_eventos_reportados=True`) puede reflejar ausencia de registro y no necesariamente menor riesgo. Se marca con `estado_confianza = "Baja - validación requerida"`.

2. **Imputación de población**: cuando un municipio carece de dato poblacional en la fuente DANE, se usa la mediana departamental. Los registros imputados se marcan con `poblacion_imputada=True`.

3. **REPS estático**: el pipeline usa el corte descargado, no actualización en tiempo real. Las sedes inactivas quedan excluidas.

4. **Sin predicción causal**: el IRCA mide vulnerabilidad relativa histórica, no predice colapsos futuros ni desabastecimiento de medicamentos.

5. **Piloto departamental**: el MVP está diseñado para un departamento a la vez. Extender a nivel nacional requiere ajustar los percentiles a escala nacional.

6. **No reemplaza sistemas operativos**: RutaVital IA es una herramienta de priorización preventiva. No reemplaza el Sistema Integrado de Información de la Protección Social (SISPRO) ni los centros reguladores de urgencias.

---

## Diferencial frente a otros sistemas

RutaVital IA no es un ranking de riesgo clínico en salud. Su diferencial es la **continuidad asistencial ante emergencias**: combina capacidad instalada, recurrencia de eventos y severidad vial para identificar dónde la atención en salud es más vulnerable a interrumpirse durante un desastre.

---

## Créditos y fuentes normativas

- DANE – División Político Administrativa (DIVIPOLA)
- Ministerio de Salud – REPS nacional consolidado
- UNGRD – Registro histórico de emergencias
- DANE – Proyecciones municipales de población
