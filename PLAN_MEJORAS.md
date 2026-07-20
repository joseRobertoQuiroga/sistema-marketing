# PLAN DE ACCIÓN — Mejoras Priorizadas OmniPresence

Basado en el análisis crítico F0–F5. Organizado en **6 oleadas** ejecutables de forma independiente.
Cada tarea incluye: esfuerzo estimado, archivos a modificar, contexto y dependencias.

---

## OLEADA 1 — SEGURIDAD + ESTABILIDAD (3–5 días)

### 1.1 Centralizar error handling
**Esfuerzo:** 4h · **Dificultad:** Baja · **Dependencias:** Ninguna

**Qué hacer:**
- Crear middleware `backend/src/api/middleware/errorHandler.js`
- Definir códigos de error estandarizados: `UNAUTHORIZED`, `VALIDATION_ERROR`, `NOT_FOUND`, `RATE_LIMIT`, `INTERNAL_ERROR`
- Todos los controllers deben usar `next(err)` en lugar de `res.status(500).json({ error: error.message })`

**Archivos a modificar:**
- NUEVO: `backend/src/api/middleware/errorHandler.js`
- MODIFICAR: Todos los controllers en `backend/src/api/controllers/*.js` (15+ archivos)
- MODIFICAR: `backend/index.js` (reemplazar el error handler actual de línea 269–277)

**Contexto adicional:**
- El handler actual en index.js línea 269 ya tiene una estructura base, solo hay que estandarizar
- Los controllers deben hacer `next(err)` para que el middleware central lo capture

---

### 1.2 Validar webhooks entrantes (HMAC/firmas)
**Esfuerzo:** 6h · **Dificultad:** Media · **Dependencias:** Ninguna

**Qué hacer:**
- En `MessengerAdapter.validateWebhook`: ya implementa HMAC-SHA1, pero no se llama desde las rutas
- En `TikTokAdapter.validateWebhook`: implementar verificación de firma
- Crear middleware `validateWebhookSignature` que verifica según la plataforma
- Aplicar en todas las rutas `/webhook/:platform`

**Archivos a modificar:**
- MODIFICAR: `backend/src/modules/chatbot/infrastructure/platforms/MessengerAdapter.js`
- MODIFICAR: `backend/src/modules/chatbot/infrastructure/platforms/TikTokAdapter.js`
- NUEVO: `backend/src/api/middleware/webhookValidator.js`
- MODIFICAR: `backend/src/modules/chatbot/index.js` (router.post('/webhook/:platform'))

---

### 1.3 Rate limiting por plan + ruta IA
**Esfuerzo:** 6h · **Dificultad:** Media · **Dependencias:** Errores estandarizados (1.1)

**Qué hacer:**
- Crear middleware `planLimiter.js` que lee `req.user.plan` y aplica límites:
  - free: 10 req/min a Lumi + Chatbot
  - pro: 60 req/min
  - enterprise: 300 req/min
- Aplicar a rutas `/api/lumi/query` y webhooks del chatbot

**Archivos a modificar:**
- NUEVO: `backend/src/api/middleware/planLimiter.js`
- MODIFICAR: `backend/index.js` (aplicar middleware a rutas Lumi y chatbot)

**Contexto adicional:**
- Ya existe `express-rate-limit` en el proyecto
- Los límites deben ser por `orgId`, no por IP (multi-tenant)

---

## OLEADA 2 — PERFORMANCE + INFRAESTRUCTURA (4–6 días)

### 2.1 Migrar Telegram polling a webhook
**Esfuerzo:** 8h · **Dificultad:** Media · **Dependencias:** Ninguna

**Qué hacer:**
- Crear endpoint `POST /api/chatbot/webhook/telegram` que procesa updates de Telegram directo
- Configurar comando `setWebhook` al iniciar la app (o script separado)
- Eliminar `pollTelegram()` de `backend/index.js`
- Ya existe el router genérico en chatbotModule, solo hay que ajustarlo para Telegram

**Archivos a modificar:**
- MODIFICAR: `backend/src/modules/chatbot/index.js` (router.post('/webhook/telegram'))
- ELIMINAR: `pollTelegram()` de `backend/index.js` (líneas 187–255)

**Contexto adicional:**
- Telegram webhook necesita HTTPS público (ngrok para dev, dominio real en prod)
- El token de bot se configura via `TELEGRAM_TOKEN` en .env
- Ver comando: `curl -F "url=https://tu-dominio.com/api/chatbot/webhook/telegram" https://api.telegram.org/bot${TOKEN}/setWebhook`

---

### 2.2 Unificar PlatformAdapterFactory + PlatformManager
**Esfuerzo:** 6h · **Dificultad:** Media · **Dependencias:** Ninguna

**Qué hacer:**
- Elegir `PlatformAdapterFactory` como el definitivo (es el que usa el módulo chatbot)
- Hacer que `PlatformManager` delegue en `PlatformAdapterFactory` internamente
- O eliminar `PlatformManager` y reemplazar todas las referencias

**Archivos a modificar:**
- MODIFICAR: `backend/src/infrastructure/platform/PlatformManager.js`
- MODIFICAR: `backend/index.js` (línea 170–174 donde registra adaptadores en ambos)
- MODIFICAR: `backend/src/modules/chatbot/index.js`

**Contexto adicional:**
- `PlatformManager` se usa en `ConversationController.reply()` y `SendCampaignUseCase` — esas referencias deben actualizarse

---

### 2.3 Agregar índices compuestos en tablas grandes
**Esfuerzo:** 2h · **Dificultad:** Baja · **Dependencias:** Ninguna

**Qué hacer:**
- Agregar migración 010_indices.sql:
```sql
CREATE INDEX IF NOT EXISTS idx_messages_org_created ON messages(organization_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_messages_org_intent ON messages(organization_id, intent_score DESC);
CREATE INDEX IF NOT EXISTS idx_leads_org_score ON leads(organization_id, score DESC);
CREATE INDEX IF NOT EXISTS idx_campaign_messages_org_status ON campaign_messages(organization_id, status);
```

**Archivos a modificar:**
- NUEVO: `backend/src/config/migrations/010_indices.sql`

---

## OLEADA 3 — LUMI + UX (5–7 días)

### 3.1 Cachear contexto Lumi con Redis
**Esfuerzo:** 6h · **Dificultad:** Media · **Dependencias:** Redis funcionando

**Qué hacer:**
- En `LumiContextBuilder.getFullContext()`, antes de consultar DB, verificar Redis
- Cache key: `lumi:ctx:{orgId}`, TTL: 5 minutos
- Si Redis no está disponible, seguir funcionando sin cache (fallback)

**Archivos a modificar:**
- MODIFICAR: `backend/src/modules/lumi/infrastructure/LumiContextBuilder.js`

**Contexto adicional:**
- Redis ya está como dependencia en el proyecto (ioredis instalado)
- HealthController ya intenta conectar Redis (línea 6–12)
- Estrategia: cache invalidada cuando hay cambios (nuevo producto, lead, etc.)

---

### 3.2 Memoria de conversación Lumi
**Esfuerzo:** 4h · **Dificultad:** Media · **Dependencias:** 3.1 (opcional)

**Qué hacer:**
- En `LumiOrchestrator.processQuery()`, mantener array de últimos N exchanges
- Pasar historial en el prompt del LLM como contexto adicional
- Límite: últimos 5 exchanges para no exceder tokens

**Archivos a modificar:**
- MODIFICAR: `backend/src/modules/lumi/infrastructure/LumiOrchestrator.js`

**Contexto adicional:**
- La memoria es volátil (en memoria del servidor) — aceptable para MVP
- Si hay Redis, se puede persistir por sesión

---

### 3.3 Botón "Guardar descripción" en Lumi
**Esfuerzo:** 6h · **Dificultad:** Media · **Dependencias:** F4 (Lumi funcionando)

**Qué hacer:**
- Backend: endpoint `POST /api/lumi/save-description` que recibe `{ productId, description }` y actualiza el producto
- Frontend: en LumiChatPage, cuando la respuesta es de tipo `product_description`, mostrar botón "Guardar en producto"

**Archivos a modificar:**
- MODIFICAR: `backend/src/modules/lumi/api/LumiController.js`
- MODIFICAR: `backend/src/modules/lumi/api/lumi.routes.js`
- MODIFICAR: `frontend/src/pages/LumiChatPage.jsx`

---

### 3.4 Memoria de conversación para Lumi (sesión)
**Esfuerzo:** 4h · **Dificultad:** Baja · **Dependencias:** 3.2

**Qué hacer:**
- Almacenar historial de la conversación actual en un Map organizado por orgId
- Pasar los últimos N mensajes como contexto adicional al LLM en cada consulta

**Archivos a modificar:**
- MODIFICAR: `backend/src/modules/lumi/infrastructure/LumiOrchestrator.js`

---

## OLEADA 4 — CAMPAÑAS + RESILIENCIA (5–7 días)

### 4.1 Sistema de plantillas para campañas
**Esfuerzo:** 8h · **Dificultad:** Media · **Dependencias:** F3

**Qué hacer:**
- Instalar Handlebars (`npm install handlebars`)
- En `SendCampaignUseCase`, antes de enviar, renderizar template con variables del lead:
  - `{{nombre}}`, `{{producto}}`, `{{empresa}}`, `{{precio}}`
- Guardar template renderizado en `campaign_messages.content`

**Archivos a modificar:**
- MODIFICAR: `backend/src/modules/chatbot/application/use-cases/campaign/SendCampaignUseCase.js`
- MODIFICAR: `backend/src/modules/chatbot/domain/entities/Campaign.js` (agregar campo `template`)

**Contexto adicional:**
- Las plantillas se almacenan en `campaigns.template_id` — actualmente es texto plano
- Migrar a: `campaigns.template_body` (texto con variables Handlebars)

---

### 4.2 Migrar scheduler a BullMQ (persistente)
**Esfuerzo:** 8h · **Dificultad:** Media · **Dependencias:** Redis, 4.1

**Qué hacer:**
- Reemplazar `CampaignScheduler` (setInterval) por BullMQ repeatable job
- Job se ejecuta cada minuto, busca campañas `scheduled` vencidas
- Si Redis no está disponible, usar setInterval como fallback

**Archivos a modificar:**
- MODIFICAR: `backend/src/modules/chatbot/infrastructure/campaign/CampaignScheduler.js`
- MODIFICAR: `backend/src/modules/chatbot/index.js`

**Contexto adicional:**
- BullMQ ya está en package.json
- RAGSyncWorker ya usa BullMQ — mismos patrones

---

### 4.3 Implementar cancelación atómica de campañas
**Esfuerzo:** 4h · **Dificultad:** Media · **Dependencias:** 4.2

**Qué hacer:**
- En `CancelCampaignUseCase`, agregar flag `cancelled_at` en campaña
- En `SendCampaignUseCase._sendBatch()`, verificar antes de cada envío individual si la campaña fue cancelada

**Archivos a modificar:**
- MODIFICAR: `backend/src/modules/chatbot/application/use-cases/campaign/CancelCampaignUseCase.js`
- MODIFICAR: `backend/src/modules/chatbot/application/use-cases/campaign/SendCampaignUseCase.js`

---

### 4.4 Agregar límites de envío por plan
**Esfuerzo:** 4h · **Dificultad:** Baja · **Dependencias:** 1.3

**Qué hacer:**
- En `SendCampaignUseCase.execute()`, antes de enviar, verificar plan de la org
- Límites: free=100/día, pro=5,000/día, enterprise=ilimitado
- Consultar contador de envíos del día desde `campaign_messages`

**Archivos a modificar:**
- MODIFICAR: `backend/src/modules/chatbot/application/use-cases/campaign/SendCampaignUseCase.js`

---

## OLEADA 5 — TESTING + CALIDAD (5–7 días)

### 5.1 Tests de integración multi-tenant
**Esfuerzo:** 8h · **Dificultad:** Media · **Dependencias:** Ninguna

**Qué hacer:**
- Crear `backend/tests/integration/multitenant.test.js`
- Flujo: crear 2 organizaciones → crear datos en cada una → verificar que queries no filtren entre orgs
- Usar `beforeAll()` para setup y `afterAll()` para cleanup

**Archivos a modificar:**
- NUEVO: `backend/tests/integration/multitenant.test.js`

**Contexto adicional:**
- Necesita base de datos de test (usar `DATABASE_URL_TEST` o DB dedicada)

---

### 5.2 Tests de carga con k6
**Esfuerzo:** 8h · **Dificultad:** Alta · **Dependencias:** Ninguna

**Qué hacer:**
- Crear script `load-tests/k6-script.js`
- Escenarios: login, consulta Lumi, webhook chatbot, listar campañas
- Thresholds: 95% requests < 500ms, 0% errors

**Archivos a modificar:**
- NUEVO: `load-tests/k6-script.js`
- NUEVO: `load-tests/README.md`

**Contexto adicional:**
- k6 se instala aparte: `winget install k6` o `choco install k6`
- Ejecutar contra staging, no producción

---

### 5.3 Tests E2E con Playwright
**Esfuerzo:** 12h · **Dificultad:** Alta · **Dependencias:** Frontend estable

**Qué hacer:**
- Instalar Playwright: `npx playwright install`
- Cubrir flujos: login → dashboard → bot chat → campañas → lumi → monitoreo
- Usar page object model

**Archivos a modificar:**
- NUEVO: `e2e/`
- NUEVO: `e2e/config/playwright.config.js`
- NUEVO: `e2e/specs/login.spec.js`
- NUEVO: `e2e/specs/campaigns.spec.js`
- NUEVO: `e2e/specs/lumi.spec.js`

---

## OLEADA 6 — MONITOREO + OBSERVABILIDAD (4–6 días)

### 6.1 Endpoint /metrics en formato Prometheus
**Esfuerzo:** 6h · **Dificultad:** Baja · **Dependencias:** F5 (monitoreo existente)

**Qué hacer:**
- Instalar `prom-client` (`npm install prom-client`)
- Exportar métricas: tests pasando, requests por ruta, latency, errores, entidades por org
- Endpoint `GET /api/monitoring/metrics` en formato Prometheus

**Archivos a modificar:**
- MODIFICAR: `backend/src/api/controllers/MonitoringController.js`
- MODIFICAR: `backend/package.json`

**Contexto adicional:**
- `prom-client` es la lib estándar para Node.js + Prometheus
- Formato de salida es texto plano, consumido por Prometheus server

---

### 6.2 Sistema de alertas simple
**Esfuerzo:** 6h · **Dificultad:** Media · **Dependencias:** 6.1

**Qué hacer:**
- En MonitoringController, agregar endpoint `/api/monitoring/alerts`
- Verificar umbrales: DB latency > 500ms, módulos caídos, errores recientes > 10 en 5min
- Enviar alerta por email (nodemailer) o webhook (Slack/Discord)

**Archivos a modificar:**
- MODIFICAR: `backend/src/api/controllers/MonitoringController.js`

---

### 6.3 Implementar DLQ (Dead Letter Queue)
**Esfuerzo:** 6h · **Dificultad:** Media · **Dependencias:** Redis/BullMQ

**Qué hacer:**
- En `ProcessMessageUseCase`, si un mensaje falla después de 3 intentos, mover a cola `chatbot-dlq`
- Worker DLQ que reintenta cada 30 minutos
- Dashboard de DLQ en MonitoringPage

**Archivos a modificar:**
- MODIFICAR: `backend/src/modules/chatbot/application/use-cases/chat/ProcessMessageUseCase.js`
- NUEVO: `backend/src/modules/chatbot/infrastructure/messaging/DLQWorker.js`
- MODIFICAR: `frontend/src/pages/MonitoringPage.jsx`

---

### 6.4 Agregar OpenTelemetry básico
**Esfuerzo:** 8h · **Dificultad:** Alta · **Dependencias:** 6.1

**Qué hacer:**
- Instalar `@opentelemetry/api`, `@opentelemetry/sdk-node`, `@opentelemetry/instrumentation-express`, `@opentelemetry/instrumentation-pg`
- Inicializar SDK en archivo aparte `backend/src/infrastructure/tracing.js`
- Trazar requests clave: webhooks entrantes, consultas Lumi, envío de campañas

**Archivos a modificar:**
- NUEVO: `backend/src/infrastructure/tracing.js`
- MODIFICAR: `backend/index.js`

---

## TABLA RESUMEN — ESFUERZO TOTAL

| Oleada | Días | Tareas | Dificultad |
|--------|------|--------|------------|
| 1 — Seguridad | 3–5 | 3 | Baja–Media |
| 2 — Performance | 4–6 | 3 | Baja–Media |
| 3 — Lumi + UX | 5–7 | 4 | Baja–Media |
| 4 — Campañas | 5–7 | 4 | Baja–Media |
| 5 — Testing | 5–7 | 3 | Media–Alta |
| 6 — Monitoreo | 4–6 | 4 | Baja–Alta |
| **TOTAL** | **26–38** | **21** | |

## ORDEN RECOMENDADO DE EJECUCIÓN

```
Semana 1-2 (Oleada 1): Seguridad → errores estandarizados, webhooks, rate limiting
Semana 2-3 (Oleada 2): Performance → Telegram webhook, unificar plataformas, índices
Semana 3-4 (Oleada 3): Lumi UX → caché Redis, memoria conversación, guardar descripciones
Semana 4-5 (Oleada 4): Campañas → plantillas, scheduler BullMQ, cancelación, límites
Semana 5-6 (Oleada 5): Testing → multi-tenant, k6, Playwright
Semana 6-7 (Oleada 6): Monitoreo → Prometheus, alertas, DLQ, OpenTelemetry
```

## CRITERIOS DE ACEPTACIÓN POR TAREA

Cada tarea se considera completa cuando:
1. Tests existentes siguen pasando (147+)
2. No hay regresiones en frontend
3. El cambio funciona sin config adicional (o con docs claras)
4. Código sigue los patrones Clean Architecture del proyecto
