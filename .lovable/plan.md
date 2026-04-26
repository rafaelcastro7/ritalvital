

## Continuación: Plan de mejoras y verificación end-to-end

El sistema base ya está completo (Cloud, Auth opcional, Pipeline IRCA v3 con umbrales absolutos, RAG con FTS, agentes Vigía/Analista/Reportero/Validador, frontend público). Propongo continuar con dos frentes complementarios: **(A) verificación operativa** del flujo completo y **(B) endurecimiento + features pendientes** de mayor impacto.

### Fase A — Verificación end-to-end (sanity check)

1. Confirmar que `irca_snapshots` tiene datos del día actual y que la distribución refleja la nueva fórmula v3 (esperado: ~283 Críticos, ~100 Altos).
2. Confirmar que `normativa_chunks` está poblada con los 4 cuerpos normativos preset.
3. Probar `chat-analista` con una consulta que dispare a la vez `top_criticos` + `buscar_normativa` y verificar que cita artículo + URL.
4. Generar un reporte ejecutivo de Chocó y validar que el HTML público se renderiza desde Storage.
5. Revisar logs de las edge functions para detectar warnings silenciosos.

### Fase B — Mejoras priorizadas

**B1. Página pública `/normativa`** (alto impacto, bajo costo)
- Lista paginada de `normativa_chunks` con buscador en español usando RPC `buscar_normativa_fts`.
- Filtro por norma (Resolución 2115/2007, 3100/2019, Ley 1751/2015, Decreto 1575/2007).
- Card por artículo con título, contenido truncado y enlace a fuente oficial.
- Link en `DashboardHeader`.

**B2. Rate limit por IP en edge functions públicas** (protege créditos IA)
- Nueva tabla `rate_limits (ip text, function_name text, window_start timestamptz, count int)`.
- Helper `_shared/rate-limit.ts` que lee `x-forwarded-for`, ventana deslizante de 1 hora.
- Aplicar a `chat-analista` (20 req/h) y `reporte-ejecutivo` (5 req/h).
- Respuesta 429 con `Retry-After` cuando se excede.

**B3. Marco normativo en reportes ejecutivos** (cierra el círculo RAG)
- En `reporte-ejecutivo`, antes de llamar a Gemini, ejecutar `buscar_normativa_fts` con el resumen del depto.
- Inyectar los 3 artículos más relevantes en el prompt y agregar sección "Marco normativo aplicable" al HTML final.

**B4. Limpieza de auth residual** (coherencia con "todo público")
- Ocultar enlaces a `/auth` y `/cuenta` del `DashboardHeader`.
- Mantener archivos por si se reactiva en el futuro, pero sin entradas visibles.

### Detalles técnicos

```text
B1 /normativa
  src/pages/Normativa.tsx           ← nueva página
  src/App.tsx                       ← agregar ruta
  src/components/dashboard/         ← link en header

B2 rate-limit
  supabase/migrations/*.sql         ← tabla rate_limits + índice (ip, function_name, window_start)
  supabase/functions/_shared/rate-limit.ts
  supabase/functions/chat-analista/index.ts       ← integrar
  supabase/functions/reporte-ejecutivo/index.ts   ← integrar

B3 marco normativo en reportes
  supabase/functions/reporte-ejecutivo/index.ts
    - llamar supabase.rpc("buscar_normativa_fts", { query_text, match_count: 3 })
    - extender htmlReport() con sección normativa
```

### Criterios de éxito

- `/normativa` muestra ≥ 4 normas con búsqueda funcional en español.
- 21ª llamada/hora a `chat-analista` desde la misma IP devuelve 429.
- Reporte de Chocó incluye sección "Marco normativo aplicable" con al menos 2 artículos citados.
- Header público no muestra enlaces a auth/cuenta.

### Fuera de alcance (para iteraciones siguientes)

- Streaming SSE en chat (requiere refactor del cliente).
- Conexión a SIVIGILA / IDEAM (depende de credenciales/APIs externas).
- Embeddings vectoriales reales (requiere `GEMINI_API_KEY` externa; FTS actual es suficiente).

