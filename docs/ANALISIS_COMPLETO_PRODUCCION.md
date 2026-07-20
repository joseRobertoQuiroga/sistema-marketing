# Análisis Completo del Sistema y Guía de Acción para Producción

> **Fecha:** Junio 2026
> **Proyecto:** OmniPresence Suite — SaaS Multi-tenant de Marketing Automation
> **Estado:** MVP funcional parcial → Producción

---

## Índice
1. [Resumen Ejecutivo](#1-resumen-ejecutivo)
2. [APIs y Secretos Pendientes](#2-apis-y-secretos-pendientes)
3. [Problemas Críticos Detectados](#3-problemas-críticos-detectados)
4. [Brechas de Implementación por Módulo](#4-brechas-de-implementación-por-módulo)
5. [Guía de Acción Priorizada](#5-guía-de-acción-priorizada)
6. [Checklist Pre-Producción](#6-checklist-pre-producción)

---

## 1. Resumen Ejecutivo

### 1.1 Qué funciona HOY
- **Backend**: Express 5 con estructura hexagonal implementada
- **Auth**: Register/Login/Refresh/Logout con JWT + refresh tokens
- **Multi-tenancy**: Middleware `tenant.js` con RLS + `SET LOCAL app.current_org`
- **Bot IA**: Pipeline completo (texto + audio + imagen) via BullMQ, solo Telegram
- **Tests**: 65 tests pasando en 6 suites
- **Frontend**: React 19 + Vite 8 con routing, componentes modulares
- **DB**: PostgreSQL 16 + pgvector con migraciones 001-003

### 1.2 Qué NO funciona / está incompleto
- **CRM Leads**: No existe tabla `leads` en DB (solo upsert en código, sin migración)
- **WhatsApp/Instagram/Facebook**: No hay adaptadores
- **Analytics Hub**: 0% implementado
- **Content Hub**: Solo vista de catálogo, sin scheduler ni upload real
- **Billing/Stripe**: 0% implementado
- **Alertas**: 0% implementado
- **Onboarding**: 0% implementado
- **Auth interceptor frontend**: No hay refresh automático ni store de auth
- **Bot usa orgId hardcodeado** (`369344ae...`) en index.js

### 1.3 Riesgos principales
| Riesgo | Impacto | Urgencia |
|--------|---------|----------|
| JWT_SECRET en .env committed | Seguridad | **CRÍTICO** |
| orgId hardcodeado en polling Telegram | Multi-tenancy roto | **CRÍTICO** |
| Sin leads migration | CRM inexistente en DB | **ALTA** |
| TELEGRAM_TOKEN vacío (`<PONER_TOKEN_AQUI>`) | Bot no funciona | **ALTA** |
| Sin Dockerfile.prod | No hay path a producción | **ALTA** |
| Sin auth state en frontend | Dashboard público | **ALTA** |

---

## 2. APIs y Secretos Pendientes

### 2.1 Variables .env — Estado Actual

```
VARIABLE                      ESTADO         VALOR ACTUAL
───                          ─────          ───────────
JWT_SECRET                   ⚠️ EXPUESTO     617e2efc... (en .env committed)
TOKEN_ENCRYPTION_KEY         ⚠️ EXPUESTO     32531c0b... (en .env committed)
ALLOWED_ORIGINS              ✅ OK           http://localhost:5173,...
DATABASE_URL                 ⚠️ DEFAULT      user:password@localhost (cambiar en prod)
TELEGRAM_TOKEN               ❌ VACÍO        <PONER_TOKEN_AQUI>
META_APP_ID                  ❌ VACÍO
META_APP_SECRET              ❌ VACÍO
WHATSAPP_PHONE_NUMBER_ID     ❌ VACÍO
STRIPE_SECRET_KEY            ❌ VACÍO
STRIPE_WEBHOOK_SECRET         ❌ VACÍO
STRIPE_PRICE_PRO_MONTHLY     ❌ VACÍO
STRIPE_PRICE_BUSINESS_MONTHLY ❌ VACÍO
STRIPE_PRICE_AGENCY_MONTHLY  ❌ VACÍO
STORAGE_ENDPOINT             ❌ VACÍO
STORAGE_ACCESS_KEY           ❌ VACÍO
STORAGE_SECRET_KEY           ❌ VACÍO
RESEND_API_KEY               ❌ VACÍO
```

### 2.2 Cuentas externas requeridas para producción

| Servicio | Qué crear | Costo |
|----------|-----------|-------|
| **Telegram Bot** | Crear bot via @BotFather → obtener token | Gratis |
| **Meta Developer** | Crear app → configurar WhatsApp API + Instagram + Facebook Pages | Gratis (sandbox) |
| **Stripe** | Crear cuenta → productos y precios → webhook endpoint | Gratis (pago por transacción) |
| **Resend** | Crear cuenta → verificar dominio → API key | Gratis (100 emails/día) |
| **Cloud GPU** (opcional) | Instancia con GPU para Qwen-VL (Vast.ai / RunPod / Lambda) | ~$0.50/hora |
| **Object Storage** (opcional) | Bucket S3-compatible (MinIO dev / R2 / S3) | Gratis dev |
| **Ollama** | Instalar local + modelos `mistral:instruct`, `nomic-embed-text` | Gratis |

### 2.3 API Keys de Meta — Requisitos específicos

Para WhatsApp Business API se necesita:
- **Meta Business Account** verificada
- **Número de teléfono** dedicado (no se puede usar uno personal)
- **WhatsApp Cloud API** configurada en Meta Developer Dashboard
- **Webhook** expuesto públicamente (ngrok en dev) con verify token
- **Permisos**: `whatsapp_business_messaging`, `whatsapp_business_phone_number`

---

## 3. Problemas Críticos Detectados

### 🔴 CRÍTICO 1: Secretos expuestos en repositorio
`.env` contiene JWT_SECRET de 64+ chars hex, TOKEN_ENCRYPTION_KEY, y DATABASE_URL. Si este proyecto se sube a GitHub (o ya está), los secretos están comprometidos.
- **Fix**: Generar nuevos secretos, rotar inmediatamente, añadir `.env` a `.gitignore`
```bash
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"  # Nuevo JWT_SECRET
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"  # Nuevo TOKEN_ENCRYPTION_KEY
```

### 🔴 CRÍTICO 2: orgId hardcodeado en producción
`index.js` línea 82: `orgId: '369344ae-f39e-4eaa-a684-4e63c5a3a48a'` — tanto en el polling de Telegram como en el webhook. El multi-tenancy está completamente roto: todos los mensajes se asignan a la misma organización.
- **Fix**: El orgId debe venir de la configuración del bot asociada al token de plataforma, o del JWT en endpoints autenticados

### 🔴 CRÍTICO 3: Sin tabla `leads` en migraciones
El `PostgresLeadRepository.js` hace `INSERT INTO leads ... ON CONFLICT` pero **no existe migración SQL** que cree la tabla `leads`. La migración 004 nunca fue creada.
- **Fix**: Crear `004_leads.sql` con la tabla leads + RLS + índice

### 🔴 CRÍTICO 4: Sin autenticación real en frontend
El frontend no tiene:
- Store de auth (ni Zustand, ni Context)
- Interceptor axios para refresh automático
- Protected routes
- Login/Register pages implementadas (solo existe el endpoint backend)
- **Estado actual**: Cualquiera puede acceder al dashboard sin login

### 🔴 CRÍTICO 5: TELEGRAM_TOKEN no configurado
El bot de Telegram no puede funcionar porque `.env` dice `<PONER_TOKEN_AQUI>`.
- **Fix**: Obtener token de @BotFather y configurarlo

---

### 🟡 ALTA 6: Sin migración de leads (004)
urgente.

### 🟡 ALTA 7: WhatsAppAdapter no implementado
Según la arquitectura, debe existir `src/infrastructure/platform/WhatsAppAdapter.js` implementando `IPlatformAdapter`. No existe.

### 🟡 ALTA 8: Sin Dockerfile para producción
`docker-compose.yml` usa volúmenes montados (desarrollo) y `npm run dev`. No hay `docker-compose.prod.yml` para producción real (multi-stage build, sin montar código fuente).

### 🟡 ALTA 9: Sin plan limiter middleware
El middleware `planLimiter.js` está referenciado en la documentación pero no implementado. Sin esto, un usuario free puede consumir recursos ilimitados del bot.

### 🟡 ALTA 10: Sin webhooks de Meta/Stripe
No hay implementación de:
- Verificación HMAC de Meta
- Webhook de Stripe para cambios de suscripción
- Endpoint de Stripe Customer Portal

---

### 🟢 MEDIA 11: Sin rate limiting específico por endpoint
Solo hay un `globalLimiter` de 300 requests/15min. No hay rate limiting específico para:
- Login: 20/15min ✅ (existe en auth.routes.js)
- Register: 5/15min ❌
- Webhooks: 100/min ❌
- API general: 1000/min ❌

### 🟢 MEDIA 12: Sin validación de request (Zod)
No hay validación de schemas en los controllers. Los datos del body se usan directamente sin validar.

### 🟢 MEDIA 13: Sin logs estructurados
Se usa `console.log`/`console.error` en todo el backend. En producción se necesita un logger estructurado (pino, winston) con niveles y formato JSON.

### 🟢 MEDIA 14: Sin health check de dependencias
`GET /health` solo retorna `{ status: 'ok' }`. No verifica que DB, Redis, ni Ollama estén realmente funcionando.

---

## 4. Brechas de Implementación por Módulo

### M3 — AI Bot & Lead Engine (60% completo)
```
✅ Arquitectura hexagonal backend
✅ Pipeline de texto + audio + imagen
✅ PlatformManager + TelegramAdapter
✅ Intent scoring + KPI classification
✅ Captura de datos + upsert de leads en código
✅ BullMQ queue + worker
✅ Test: 65 unit tests

❌ Sin leads migration SQL → tabla no existe en DB
❌ Sin WhatsAppAdapter
❌ orgId hardcodeado para polling
❌ Sin webhook handler para Meta
❌ Sin sanitización anti-prompt injection en use-case (solo existe en securityUtils.js pero no se usa)
❌ Sin alertas de hot leads
❌ Sin handoff real (solo pause + reply admin)
```

### M1 — Analytics Hub (0%)
```
❌ Sin OAuth flow para Meta/TikTok/LinkedIn
❌ Sin social_connections table migration
❌ Sin account_metrics table
❌ Sin worker de sync de métricas
❌ Sin dashboard de KPIs
❌ Sin gráficas
```

### M2 — Content Hub (5%)
```
✅ Vista de catálogo de productos (ContentHub.jsx)
✅ Conexión a GET /api/products

❌ Sin upload real de assets
❌ Sin procesamiento Sharp
❌ Sin scheduler de publicaciones
❌ Sin integración con APIs de redes sociales
❌ Sin tabla assets, posts, post_accounts en DB
```

### Billing (0%)
```
❌ Sin tabla subscriptions en DB
❌ Sin tabla billing_events
❌ Sin webhook handler de Stripe
❌ Sin Customer Portal
❌ Sin plan limiter middleware
❌ Sin frontend de planes
```

---

## 5. Guía de Acción Priorizada

### FASE 0.5 — Correcciones Urgentes (Semana 1)

```
[ ] 1. Rotar JWT_SECRET y TOKEN_ENCRYPTION_KEY
[ ] 2. Añadir .env a .gitignore
[ ] 3. Crear migración 004_leads.sql
[ ] 4. Configurar TELEGRAM_TOKEN real
[ ] 5. Eliminar orgId hardcodeado — obtener de bot_configs por plataforma
[ ] 6. Añadir auth store + interceptor en frontend
[ ] 7. Crear páginas Login/Register en frontend
```

### FASE 1 — CRM de Leads (Semana 2)

```
[ ] 1. Ejecutar migración 004_leads.sql
[ ] 2. Agregar sanitizeUserMessage al ProcessMessageUseCase
[ ] 3. Implementar alertas de hot leads (score >= 70)
[ ] 4. Crear página LeadsPage con kanban en frontend
[ ] 5. Endpoints: GET /api/leads, PATCH /api/leads/:id
```

### FASE 2 — Omnicanalidad (Semana 3)

```
[ ] 1. Implementar WhatsAppAdapter (src/infrastructure/platform/)
[ ] 2. Implementar Meta webhook handler con HMAC verification
[ ] 3. Configurar ngrok + Meta Developer Dashboard
[ ] 4. Actualizar PlatformManager para webhook receive
[ ] 5. Pruebas E2E: Telegram + WhatsApp
```

### FASE 3 — Frontend Completo (Semana 4)

```
[ ] 1. Zustand store de auth (useAuthStore)
[ ] 2. Axios interceptor con refresh automático
[ ] 3. ProtectedRoute wrapper
[ ] 4. Páginas: Login, Register, Settings
[ ] 5. Layout responsivo
```

### FASE 4 — Infraestructura Producción (Semana 5)

```
[ ] 1. Docker multi-stage para backend + frontend
[ ] 2. docker-compose.prod.yml
[ ] 3. Nginx reverse proxy + SSL
[ ] 4. Health check real (DB + Redis + Ollama)
[ ] 5. Logger estructurado (pino)
[ ] 6. CI/CD GitHub Actions
```

### FASE 5 — Billing (Semana 6)

```
[ ] 1. Migración 005_billing.sql
[ ] 2. Webhook handler de Stripe
[ ] 3. Plan limiter middleware
[ ] 4. Stripe Customer Portal
[ ] 5. Frontend de planes
```

### FASE 6-8 — Analytics + Content + Onboarding (Semanas 7-10)

```
[ ] 1. OAuth flow Meta
[ ] 2. Sync worker de métricas
[ ] 3. Dashboard de analytics
[ ] 3. Upload + Sharp processing
[ ] 4. Content scheduler
[ ] 5. Onboarding de 4 pasos
```

---

## 6. Checklist Pre-Producción

### Seguridad
- [ ] JWT_SECRET rotado y no en git
- [ ] TOKEN_ENCRYPTION_KEY rotado y no en git
- [ ] .env añadido a .gitignore
- [ ] Todos los orgId vienen del JWT, no hardcodeados
- [ ] RLS habilitado en todas las tablas de negocio
- [ ] Sin secretos en logs (revisar console.log)
- [ ] CORS configurado solo para dominios conocidos
- [ ] Rate limiting por endpoint (login: 20, register: 5, api: 1000)
- [ ] Validación de input con Zod en todos los endpoints
- [ ] Sanitización anti-prompt injection activa en bot

### Base de Datos
- [ ] Migración 004_leads.sql creada y ejecutada
- [ ] Migración 005_billing.sql creada y ejecutada
- [ ] RLS habilitado en tabla leads
- [ ] Índices creados (conversation_id, organization_id, token_hash)
- [ ] Seed data actualizada (sin orgId hardcodeado)

### Backend
- [ ] TELEGRAM_TOKEN configurado y probado
- [ ] WhatsAppAdapter implementado (aunque sea stub)
- [ ] orgId dinámico en polling Telegram
- [ ] Health check real (DB + Redis + Ollama)
- [ ] Logger estructurado (pino o similar)
- [ ] Plan limiter middleware operativo
- [ ] Stripe webhook handler listo
- [ ] Meta webhook handler con HMAC

### Frontend
- [ ] Auth store con Zustand implementada
- [ ] Axios interceptor con refresh automático
- [ ] ProtectedRoute para rutas del dashboard
- [ ] Página Login funcional
- [ ] Página Register funcional
- [ ] Manejo de 401 → redirect a login

### Infraestructura
- [ ] Docker multi-stage builds
- [ ] docker-compose.prod.yml sin volúmenes de código
- [ ] Nginx con SSL (certbot/Let's Encrypt)
- [ ] CI/CD pipeline (GitHub Actions)
- [ ] Backups automáticos de DB
- [ ] Monitoreo (uptime, errores)
- [ ] Pruebas de carga (al menos 100 conexiones simultáneas)

### Verificación Final
- [ ] `grep -r "369344ae" backend/` → 0 resultados
- [ ] `grep -r "PONER_TOKEN_AQUI" .` → 0 resultados
- [ ] `npx jest` → 65+ tests pasando
- [ ] `curl localhost:3000/health` → `{ "status": "ok" }`
- [ ] `curl -X POST localhost:3000/auth/register -H "Content-Type: application/json" -d '{"email":"test@test.com","password":"123456","name":"Test","orgName":"Test"}'` → 201 + tokens
- [ ] Frontend build: `npm run build` → exit 0
- [ ] Docker compose up → todos los servicios healthy

---

## Apéndice A: Comandos Útiles

```bash
# Generar secretos
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"   # JWT_SECRET
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"   # TOKEN_ENCRYPTION_KEY

# Buscar orgId hardcodeado
cd backend && grep -r "369344ae" --include="*.js" --include="*.json" .

# Verificar que no hay secrets en el repo
cd backend && grep -r "PONER_TOKEN_AQUI\|sk_test\|re_" --include="*" .

# Tests
cd backend && npx jest --coverage

# Build frontend
cd frontend && npm run build

# Docker
docker compose up -d
docker compose logs -f backend
docker compose exec db psql -U user -d omnipresence -c "\dt"

# Backup DB
docker compose exec db pg_dump -U user omnipresence > backup_$(date +%Y%m%d).sql
```

## Apéndice B: Estructura Actual del Proyecto

```
sistema-marketing/
├── backend/
│   ├── src/
│   │   ├── domain/entities/          ✅ 6 entidades
│   │   ├── domain/ports/             ✅ 8 interfaces
│   │   ├── application/use-cases/    ✅ 2 casos de uso
│   │   ├── infrastructure/
│   │   │   ├── persistence/          ✅ 8 repositorios (falta tabla leads)
│   │   │   ├── ai/                   ✅ Ollama + Whisper
│   │   │   ├── platform/             ⚠️ Solo Telegram
│   │   │   ├── messaging/            ✅ BullMQ
│   │   │   └── utils/                ✅ securityUtils
│   │   ├── api/
│   │   │   ├── controllers/          ✅ 6 controllers
│   │   │   ├── routes/               ✅ 5 route files
│   │   │   └── middleware/           ✅ auth + tenant
│   │   └── config/                   ✅ db, env, 3 migrations
│   ├── index.js                      ✅ Composition root
│   ├── tests/                        ✅ 65 tests, 6 suites
│   ├── Dockerfile                    ⚠️ Solo dev (nodemon)
│   └── .env                          ❌ Secrets expuestos
├── frontend/
│   ├── src/
│   │   ├── App.jsx                   ✅ Routing
│   │   ├── main.jsx                  ✅ BrowserRouter
│   │   ├── pages/                    ✅ BotPage, ContentHub
│   │   ├── components/layout/        ✅ Header, Sidebar, Layout
│   │   ├── components/chat/          ✅ 5 componentes chat
│   │   ├── components/shared/        ✅ NavItem, DataField
│   │   └── services/                 ✅ api.js, socket.js
│   ├── Dockerfile                    ⚠️ Solo dev
│   └── package.json
├── docs/
│   ├── VISION_PROYECTO.md            ✅ Visión
│   ├── GUIA_TECNICA_PRODUCCION.md    ✅ Guía técnica
│   ├── ANALISIS_COMPLETO_PRODUCCION.md ✅ Este documento
│   └── legacy/                       ✅ Backup completo
├── docker-compose.yml                ⚠️ Solo dev (volúmenes montados)
└── .gitignore                        ❌ Verificar que incluya .env
```
