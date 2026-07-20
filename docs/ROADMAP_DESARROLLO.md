# Roadmap de Desarrollo — OmniPresence Suite → Producción

## Principios
- Cada fase produce código funcional y testeable
- Ninguna fase depende de APIs externas no configuradas
- Al final de cada fase: `npx jest` pasa, `npm run build` pasa
- El roadmap se ejecuta secuencialmente, sin saltos

---

## FASE 1: FUNDACIÓN Y SEGURIDAD (AHORA)

### 1.1 Seguridad de secretos
- [ ] Rotar JWT_SECRET y TOKEN_ENCRYPTION_KEY
- [ ] Crear `.env.example` sin valores reales
- [ ] Añadir `.env` a `.gitignore`

### 1.2 Base de datos — leads migration
- [ ] Crear `004_leads.sql` con tabla leads + RLS + índices
- [ ] Actualizar `init_db.js` para incluirla

### 1.3 Eliminar orgId hardcodeado
- [ ] Crear `BotConfigRepository.findByPlatform()` para mapear token → orgId
- [ ] Refactor polling Telegram para obtener orgId dinámico
- [ ] `grep -r "369344ae" .` → 0 resultados

### 1.4 Sanitización anti-prompt injection
- [ ] Integrar `sanitizeUserMessage` en `ProcessMessageUseCase.execute()`

### 1.5 Frontend — Auth completo
- [ ] Zustand store `useAuthStore` (user, tokens, login/logout/refresh)
- [ ] Axios interceptor con refresh automático
- [ ] Página Login
- [ ] Página Register
- [ ] ProtectedRoute wrapper
- [ ] Layout condicional (auth vs dashboard)

### 1.6 Tests
- [ ] Tests para auth store
- [ ] Tests para sanitización en use-case
- [ ] Tests para lead repository

---

## FASE 2: CRM DE LEADS Y BOT

### 2.1 API Leads completa
- [ ] GET /api/leads con filtros (status, platform, page, limit)
- [ ] GET /api/leads/:id con historial de conversación
- [ ] PATCH /api/leads/:id (status, notes, conversionValue)
- [ ] DELETE /api/leads/:id/gdpr-erase

### 2.2 Alertas de hot leads
- [ ] Migración `006_alerts.sql`
- [ ] Alerta automática cuando intent_score >= 70
- [ ] Endpoint GET /api/alerts

### 2.3 Frontend Leads
- [ ] Página LeadsPage con kanban (4 columnas: new, contacted, qualified, converted)
- [ ] LeadCard componente
- [ ] LeadDetail modal
- [ ] Conexión a API real

### 2.4 Plan limiter middleware
- [ ] Middleware `planLimiter.js` (por plan: messages/mes, leads/mes)
- [ ] Tabla `usage_counters`

---

## FASE 3: OMNICANALIDAD (WHATSAPP)

### 3.1 WhatsAppAdapter
- [ ] Implementar `WhatsAppAdapter.js` (sendMessage con Meta Cloud API)
- [ ] Registrar en PlatformManager

### 3.2 Meta webhook
- [ ] Handler con verify token + HMAC
- [ ] Procesar messages inbound desde WhatsApp
- [ ] Prueba con ngrok + Dashboard de Meta

### 3.3 Refactor polling → webhook
- [ ] TelegramAdapter.webhookReceive()
- [ ] Endpoint POST /webhooks/telegram

---

## FASE 4: INFRAESTRUCTURA PRODUCCIÓN

### 4.1 Docker producción
- [ ] Backend Dockerfile multi-stage (build → node:20-slim)
- [ ] Frontend Dockerfile multi-stage (build → nginx)
- [ ] docker-compose.prod.yml

### 4.2 Nginx + SSL
- [ ] nginx.conf con reverse proxy + SSL
- [ ] Script de inicialización con certbot

### 4.3 Logger + Health
- [ ] Logger pino con formato JSON
- [ ] Health check real (DB ping, Redis ping, Ollama status)

### 4.4 CI/CD
- [ ] GitHub Actions: tests + build + deploy

---

## FASE 5: BILLING (STRIPE)

### 5.1 Migraciones billing
- [ ] `005_billing.sql`: subscriptions, billing_events, usage_counters

### 5.2 Stripe integration
- [ ] Webhook handler (checkout.session.completed, invoice.paid, customer.subscription.updated)
- [ ] Customer Portal
- [ ] POST /billing/subscribe
- [ ] GET /billing/current
- [ ] GET /billing/portal (redirect)

### 5.3 Frontend billing
- [ ] Página de planes
- [ ] PlanCard componente
- [ ] Upgrade flow

---

## FASE 6: ANALYTICS HUB (M1)

### 6.1 OAuth Meta
- [ ] Tabla `social_connections` + migración
- [ ] OAuth flow (ventana popup)
- [ ] Cifrado AES-256-GCM de tokens

### 6.2 Sync de métricas
- [ ] Worker BullMQ sync-metrics
- [ ] Tabla `account_metrics`
- [ ] Endpoints GET /api/analytics/overview, /api/analytics/channel/:id

### 6.3 Frontend analytics
- [ ] KpiCards
- [ ] TrendChart (Recharts)
- [ ] Channel drill-down

---

## FASE 7: CONTENT HUB (M2)

### 7.1 Asset management
- [ ] Upload endpoint con multer + Sharp
- [ ] Tabla `assets` + migración
- [ ] Storage S3-compatible

### 7.2 Content scheduler
- [ ] Tabla `posts`, `post_accounts`, `post_assets`
- [ ] POST /api/content/posts
- [ ] Worker publish-post

### 7.3 Frontend content
- [ ] AssetLibrary
- [ ] ContentCalendar
- [ ] Post composer

---

## FASE 8: ONBOARDING Y FINAL

### 8.1 Onboarding de 4 pasos
- [ ] Paso 1: Crear org
- [ ] Paso 2: Conectar red social
- [ ] Paso 3: Subir knowledge base
- [ ] Paso 4: Activar bot

### 8.2 Polish final
- [ ] Responsive design
- [ ] Loading states
- [ ] Error boundaries
- [ ] SEO básico
- [ ] Pruebas de carga
- [ ] Documentación actualizada
