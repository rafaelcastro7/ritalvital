# Agents — RutaVital IA

Este documento describe los **4 agentes de IA** del sistema, cómo están implementados, qué insumos consumen, qué producen, y cómo se auditan.

Todos los agentes registran cada ejecución en la tabla **`agent_runs`** con los campos:
`agente`, `trigger`, `modelo`, `input` (jsonb), `output` (jsonb), `status` (`running` | `success` | `error`), `error`, `duracion_ms`, `tokens_in`, `tokens_out`, `herramientas_usadas` (jsonb), `conversacion_id`, `user_id`, `created_at`.

---

## 🛰️ Agente Vigía

| Atributo | Valor |
|---|---|
| **Propósito** | Detectar cambios bruscos en el IRCA municipal entre snapshots consecutivos y emitir alertas con severidad calculada. |
| **Modelo** | `rule-engine-v1` (motor de reglas determinista, sin LLM) |
| **Edge function** | `supabase/functions/vigia-monitor/index.ts` |
| **Trigger** | Manual desde `/admin` o cron diario (futuro) |
| **Inputs** | Últimas 2 fechas distintas en `irca_snapshots` |
| **Outputs** | Filas en `alertas` (tipo `delta_irca`) + emails opcionales vía Resend a `suscripciones` activas |

### Lógica de severidad

```ts
severidadFromDelta(delta, score):
  if score >= 75 && delta >= 5  → "critica"
  if delta >= 15                → "alta"
  if delta >= 8                 → "media"
  if delta >= 3                 → "baja"
  else                          → "info"
```

Solo se generan alertas para `delta ≥ 3`.

### Registro en `agent_runs`
```json
{
  "agente": "vigia",
  "trigger": "vigia-monitor",
  "modelo": "rule-engine-v1",
  "output": { "alertas_creadas": 12, "emails_enviados": 3, "fechas": { "hoy": "2026-04-22", "ayer": "2026-04-21" } }
}
```

### Caso de uso real
Tras un fenómeno de La Niña, el snapshot del martes refleja un aumento del IRCA de Quibdó de 58 → 71. El Vigía emite una alerta `severidad: alta`, "IRCA ↑ 13.0 pts en QUIBDÓ", y notifica a los suscriptores del depto 27.

---

## 🔍 Agente Validador

| Atributo | Valor |
|---|---|
| **Propósito** | Detectar inconsistencias y vacíos cruzando fuentes (REPS vs población, IRCA vs UNGRD, outliers). |
| **Modelo** | `rule-engine-v1` |
| **Edge function** | `supabase/functions/validador-cross/index.ts` |
| **Inputs** | Snapshot vigente + componentes (camas, eventos, población) |
| **Outputs** | Filas en `validaciones` (anti-duplicado de 24 h) |

### Reglas implementadas

| Tipo de anomalía | Condición | Severidad | Fuente sugerida |
|---|---|---|---|
| `subregistro_reps` | `camas == 0` y `poblacion > 20.000` | media | REPS |
| `sin_eventos_ungrd` | `nivel == "Crítico"` y `eventos == 0` | baja | UNGRD |
| `outlier_camas` | `camas_por_1000 > 50` | alta | REPS |

### Registro en `agent_runs`
```json
{
  "agente": "validador",
  "output": { "detectadas": 47, "nuevas": 12 }
}
```

### Caso de uso real
El Validador detecta que el municipio de Riosucio (Chocó) reporta 0 camas con 30.000 habitantes → genera validación `subregistro_reps` que aparece en el panel de operación. Un analista MinSalud verifica con la dirección territorial y descubre que la IPS local no renovó habilitación REPS.

---

## 💬 Agente Analista

| Atributo | Valor |
|---|---|
| **Propósito** | Conversación libre en español sobre el estado de salud territorial, con uso autónomo de herramientas (ReAct) y citas normativas. |
| **Modelo** | `google/gemini-2.5-flash` vía Lovable AI Gateway |
| **Edge function** | `supabase/functions/chat-analista/index.ts` |
| **Trigger** | UI `/chat` |
| **Inputs** | `{ conversacion_id?, message }` |
| **Outputs** | Respuesta textual + persistencia en `conversaciones` y `mensajes` |

### System prompt exacto

```text
Eres "Analista RutaVital", copiloto agéntico de salud pública territorial para Colombia.
Tu fuente única de verdad son las herramientas. NUNCA inventes cifras: si no tienes el dato,
llama a la herramienta. Hablas en español, conciso, con bullets y tablas cortas. Cita siempre
el municipio + código DIVIPOLA y la fecha del snapshot. Cuando expongas riesgo, distingue
entre: vulnerabilidad sanitaria (camas/1000 hab), exposición (eventos UNGRD) e IRCA compuesto.
Cuando hagas recomendaciones normativas o regulatorias, llama PRIMERO a buscar_normativa
y CITA el artículo exacto (norma + artículo + URL fuente). No inventes referencias normativas.
No reemplazas criterio humano: termina recomendaciones con "validar con el equipo territorial".
```

### Herramientas disponibles (function calling)

| Tool | Parámetros | Descripción |
|---|---|---|
| `consultar_municipio` | `query: string` | Snapshot IRCA más reciente (por nombre o código) |
| `top_criticos` | `n: number, depto_code?: string` | Top N municipios con mayor IRCA |
| `comparar_municipios` | `municipios: string[]` (2-5) | Comparativa lado a lado |
| `tendencia_municipio` | `query: string, dias?: number` | Serie histórica del IRCA |
| `alertas_recientes` | `depto_code?, severidad_minima?, limit?` | Alertas activas |
| `buscar_normativa` | `consulta: string, norma?, n?` | RAG sobre `normativa_chunks` |

### Loop ReAct
Hasta **5 iteraciones**: el modelo puede invocar varias herramientas, recibir resultados, razonar y producir la respuesta final. Si excede el límite, retorna error.

### Registro en `agent_runs`
```json
{
  "agente": "analista",
  "trigger": "chat",
  "modelo": "google/gemini-2.5-flash",
  "conversacion_id": "uuid",
  "input": { "message": "..." },
  "output": { "content": "..." },
  "herramientas_usadas": ["top_criticos", "buscar_normativa"]
}
```

### Casos de uso reales

**Pregunta:** *"¿Cuáles son los 3 municipios más críticos del Pacífico y qué obligación normativa aplica?"*

**Flujo esperado:**
1. Analista invoca `top_criticos({ n: 3, depto_code: "27" })` (también podría iterar sobre 19, 52, 76).
2. Recibe `[{muni_nombre: "ALTO BAUDÓ", irca_score: 89.2, ...}, ...]`.
3. Invoca `buscar_normativa({ consulta: "IRCA riesgo alto acciones autoridad sanitaria" })`.
4. Recibe Resolución 2115/2007 art. 15 + Decreto 1575/2007 art. 11.
5. Responde con bullets, citando DIVIPOLA + fecha + artículos + URL fuente, y cierra con *"validar con el equipo territorial"*.

**Pregunta:** *"Compara Quibdó, Tadó y Condoto."*

**Flujo:** invoca `comparar_municipios({ municipios: ["Quibdó", "Tadó", "Condoto"] })` → tabla con IRCA, camas/1000, eventos/10k, nivel.

---

## 📄 Agente Reportero

| Atributo | Valor |
|---|---|
| **Propósito** | Generar un reporte ejecutivo HTML por departamento con resumen, tabla de top municipios, recomendaciones operativas y marco normativo aplicable. |
| **Modelo** | `google/gemini-2.5-flash` vía Lovable AI Gateway |
| **Edge function** | `supabase/functions/reporte-ejecutivo/index.ts` |
| **Trigger** | UI `/reportes` |
| **Inputs** | `{ depto_code, depto_nombre? }` |
| **Outputs** | HTML en bucket `reportes` + fila en tabla `reportes` con `pdf_url` pública |

### Pipeline interno

1. **Asegura snapshot**: si no hay datos en `irca_snapshots`, ejecuta el pipeline en línea.
2. **Agrega estadísticas**: total municipios, críticos, altos, IRCA promedio, top 15.
3. **Llama al LLM** con prompt JSON-output:
```text
Eres analista de salud pública. Genera (1) un resumen ejecutivo de 4-6 frases y
(2) recomendaciones operativas en bullets, para el departamento {NOMBRE}.
Datos: {total, promedio, criticos, altos, top5}.
Devuelve JSON: { "resumen": "...", "recomendaciones": "- ...\n- ..." }
```
4. **RAG normativo**: invoca `buscar_normativa_fts` con query construida (`"vigilancia calidad agua IRCA municipio crítico prestación servicios salud"`) y trae 3 artículos.
5. **Renderiza HTML** con estilos inline (compatible con cualquier navegador y exportable a PDF).
6. **Sube al bucket público** `reportes/publico/{depto}-{fecha}-{ts}.html` y registra en tabla `reportes`.

### Registro en `agent_runs`
```json
{
  "agente": "reportero",
  "trigger": "reporte-ejecutivo",
  "modelo": "google/gemini-2.5-flash",
  "input": { "depto_code": "27" },
  "output": { "reporte_id": "uuid", "path": "publico/27-2026-04-22-...html" }
}
```

### Caso de uso real
Una secretaría departamental de salud entra a `/reportes`, hace clic en "Chocó". A los ~8 segundos recibe un HTML con:
- Resumen: *"Chocó concentra 18 municipios en nivel Crítico (56 % del depto). El IRCA promedio es 71.3, el más alto del país…"*
- Tabla de los 15 municipios con mayor riesgo.
- Recomendaciones: priorización presupuestal, suministro alternativo de agua, fortalecimiento REPS.
- Marco normativo: Resolución 2115/2007 art. 12 (cálculo IRCA), Resolución 2115/2007 art. 15 (acciones por nivel de riesgo), Decreto 1575/2007 art. 11 (responsabilidad de autoridades sanitarias).

El documento queda disponible en URL pública para compartir con el comité departamental.

---

## Trazabilidad agéntica

Toda decisión asistida por IA en RutaVital queda **auditable** en `agent_runs`:

```sql
SELECT created_at, agente, modelo, status, duracion_ms, herramientas_usadas, error
FROM agent_runs
ORDER BY created_at DESC
LIMIT 50;
```

Esto permite a cualquier ciudadano (vía `/admin` o consulta directa) verificar:
- Qué modelo se usó.
- Qué herramientas se invocaron.
- Cuánto tomó.
- Si falló y por qué.

Es un requisito ético para sistemas de IA que asisten decisiones de política pública.
