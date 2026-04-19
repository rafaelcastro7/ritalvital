
El usuario confirmó "Sí" — quiere que ejecute yo mismo el prompt de investigación y entregue el prompt maestro en esta conversación.

Plan: investigar bases del concurso + sistemas agénticos + fuentes de datos colombianas, y producir un prompt maestro autocontenido listo para pegar en una nueva sesión de Lovable.

## Plan de ejecución

**Fase 1 — Investigación (usaré websearch)**
1. Bases del concurso "Datos al Ecosistema 2026" del MinTIC: criterios de evaluación, entregables, fechas, premios.
2. Sistemas agénticos en salud pública / gobierno: patrones (ReAct, multi-agente, RAG), frameworks compatibles con React + edge functions.
3. Fuentes de datos colombianas adicionales: SISPRO, SIVIGILA, IDEAM, IGAC, DANE microdatos, SIMAT, Migración Colombia. Endpoints reales en datos.gov.co.
4. Dashboards de referencia: HealthMap, OCHA HDX, INFORM Risk Index, PAHO PLISA.
5. Necesidades de entidades colombianas: Supersalud, INS, UNGRD, gobernaciones de departamentos vulnerables.

**Fase 2 — Diseño del prompt maestro**

El prompt maestro incluirá:

- **Visión**: RutaVital IA como copiloto agéntico de salud pública territorial.
- **4 agentes concretos** con triggers, herramientas y modelos:
  - Agente Vigía (cron → monitorea fuentes → dispara alertas IRCA)
  - Agente Analista (chat conversacional sobre municipios con tool-calling)
  - Agente Reportero (genera PDF ejecutivo por gobernación bajo demanda)
  - Agente Validador (cross-check entre fuentes, detecta anomalías y subregistro)
- **Nuevas fuentes** priorizadas valor/esfuerzo (tabla)
- **Features nuevas**: chat con dashboard, alertas proactivas, reportes PDF, API pública, vistas por rol, histórico temporal
- **Arquitectura técnica**: Lovable Cloud (auth, DB, edge functions, storage, cron) + Lovable AI Gateway (gemini-2.5-flash default, gpt-5 para razonamiento profundo) + esquema de tablas con RLS
- **Mapeo a criterios del concurso**
- **Plan por fases** MVP→V1→V2
- **Guardarrailes éticos**: transparencia, explicabilidad, no reemplazo de criterio humano

**Formato de entrega final**:
1. Resumen de investigación (~400 palabras con links)
2. Decisiones de diseño (qué incluí / qué descarté y por qué)
3. PROMPT MAESTRO en bloque ```code``` autocontenido y listo para pegar

**Modo actual**: estoy en plan mode (read-only). Para ejecutar websearch y producir el prompt maestro necesito modo default. Una vez aprobes este plan, cambio a default mode y entrego las 3 partes en una sola respuesta. No tocaré ningún archivo del proyecto — el entregable es texto en el chat.

**Tiempo estimado**: 1 sola respuesta tras aprobación, con 4-6 búsquedas web.
