# ANÁLISIS COMPLETO DEL SISTEMA — OmniPresence

> **Fecha:** Junio 2026
> **Ubicación:** `C:\proyectos\sistema-marketing`
> **Stack:** Node.js (Express 5) + React 19 + PostgreSQL (pgvector) + Redis (BullMQ) + Docker

---

## ÍNDICE

1. [ESTADO GENERAL](#1-estado-general)
2. [ARQUITECTURA DEL SISTEMA](#2-arquitectura-del-sistema)
3. [MÓDULOS BACKEND — ESTADO Y ANÁLISIS](#3-módulos-backend)
4. [MÓDULOS FRONTEND — ESTADO Y ANÁLISIS](#4-módulos-frontend)
5. [INFRAESTRUCTURA Y DEVOPS](#5-infraestructura-y-devops)
6. [CONFIGURACIONES Y CLAVES FALTANTES](#6-configuraciones-y-claves-faltantes)
7. [BUGS CRÍTICOS DETECTADOS](#7-bugs-críticos-detectados)
8. [BUGS Y DEUDAS TÉCNICA](#8-deuda-técnica)
9. [PROCESOS FALTANTES](#9-procesos-faltantes)
10. [IDEAS Y MEJORAS](#10-ideas-y-mejoras)
11. [COMPARATIVA CON VERSIÓN ANTERIOR](#11-comparativa-versión-anterior)

---

## 1. ESTADO GENERAL

| Dimensión | Estado | Notas |
|-----------|--------|-------|
| **Backend — Estructura** | ✅ Excelente | 16 módulos con separación por dominio |
| **Backend — DI/Wiring** | ✅ Correcto | IoC manual en index.js, sin TDZ |
| **Backend — Tests** | ⚠️ No verificado | 8 archivos test, dependen de DB externa |
| **Backend — logger** | ✅ Completo | Pino con pino-pretty en dev, sin console.* |
| **Backend — Seguridad** | ✅ helmet, rate-limit, RLS, JWT | Migraciones 003 RLS presentes |
| **Frontend — Build** | ✅ Correcto | Vite 8, build limpio |
| **Frontend — Estructura** | ✅ Buena | 9 páginas, 7 componentes, stores zustand |
| **Frontend — Errores runtime** | ❌ 3 bugs críticos | `Bot`/`Instagram` no importados, socket sin token |
| **Infraestructura** | ✅ Docker compose (dev+prod), nginx, CI/CD | GitHub Actions completo |
| **Documentación** | ✅ 14 documentos .md | Docs de arquitectura, roadmap, guías técnicas |

### Escala de madurez general: **7/10** — Base sólida, bugs críticos que impiden producción

---

## 2. ARQUITECTURA DEL SISTEMA

```
┌─────────────────────────────────────────────────────────────┐
│                        FRONTEND (React 19)                   │
│  Vite + Tailwind 4 + Zustand + React Router 7 + Socket.IO   │
├─────────────────────────────────────────────────────────────┤
│                   NGINX (proxy reverso)                      │
├─────────────────────────────────────────────────────────────┤
│                        BACKEND (Express 5)                   │
│  ┌──────────┬──────────┬──────────┬──────────┬──────────┐   │
│  │  API/    │ Application│ Domain │Infra/Persistence│Platforms│
│  │Controllers│(Use Cases)│(Entities│  (Postgres)     │ Telegram│
│  │ Middleware│           │  Ports) │  Queue/Worker   │ WhatsApp│
│  └──────────┴──────────┴──────────┴──────────┴──────────┘   │
├─────────────────────────────────────────────────────────────┤
│            PostgreSQL (pgvector)   Redis (BullMQ)            │
└─────────────────────────────────────────────────────────────┘
```

### Patrón arquitectónico: **Layered Architecture + DI Manual**
- **Capa API**: Controllers + Middleware + Routes
- **Capa Application**: Use Cases (orquestan lógica)
- **Capa Domain**: Entidades + Puertos (interfaces)
- **Capa Infrastructure**: Persistencia, AI, Plataformas, Messaging
- **Principio**: Dependencias apuntan hacia adentro (Domain no sabe de Infrastructure)

---

## 3. MÓDULOS BACKEND

### 3.1 Módulos de Dominio (`src/`)

| Módulo | Archivos | Estado | Descripción |
|--------|----------|--------|-------------|
| **api/** | 12 | ✅ | Controllers (10) + Middleware (3) + Routes (8) |
| **application/** | 2 | ✅ | ProcessMessageUseCase, AuthenticateUserUseCase |
| **domain/entities/** | 6 | ✅ | User, Org, Message, Lead, BotConfig, Session |
| **domain/ports/** | 9 | ✅ | Interfaces: IMessageRepo, ILeadRepo, IProductRepo... |
| **infrastructure/persistence/** | 9 | ✅ | 9 repositorios Postgres |
| **infrastructure/platform/** | 3 | ✅ | PlatformManager, TelegramAdapter, WhatsAppAdapter |
| **infrastructure/ai/** | 2 | ✅ | OllamaAIService, WhisperTranscriptionService |
| **infrastructure/messaging/** | 2 | ✅ | BotQueue (BullMQ), BotWorker |
| **infrastructure/workers/** | 1 | ✅ | MetricSyncWorker |
| **infrastructure/utils/** | 3 | ✅ | logger (pino), crypto (AES-256-GCM), securityUtils |
| **config/** | 3 | ✅ | env.js, db.js, 8 migrations SQL |
| **alerts/** | 0 | ❌ Vacío | No implementado |
| **analytics/** | 0 | ❌ Vacío | Lógica de analytics separada |
| **billing/** | 0 | ❌ Vacío | Lógica de billing separada |
| **bot/** | 0 | ❌ Vacío | Lógica de bot separada |
| **content/** | 0 | ❌ Vacío | Lógica de content separada |
| **leads/** | 0 | ❌ Vacío | Lógica de leads separada |
| **platforms/** | 0 | ❌ Vacío | Lógica de plataformas separada |
| **queues/** | 0 | ❌ Vacío | Lógica de colas separada |
| **routes/** | 0 | ❌ Vacío | Rutas separadas (usando api/routes/) |
| **services/** | 0 | ❌ Vacío | Servicios separados |
| **webhooks/** | 0 | ❌ Vacío | Webhooks separados |

**Nota crítica:** Los directorios `alerts/`, `analytics/`, `billing/`, `bot/`, `content/`, `leads/`, `platforms/`, `queues/`, `routes/`, `services/`, `webhooks/` existen pero están **COMPLETAMENTE VACÍOS**. Esto sugiere una arquitectura planeada que nunca se pobló. Todo el código real está en `api/controllers/`, `api/routes/` e `infrastructure/`.

### 3.2 API Controllers

| Controller | Archivo | Estado | Problemas |
|-----------|---------|--------|-----------|
| `AuthController` | `api/controllers/AuthController.js` | ✅ | Sin hardcoded orgId, usa logger |
| `ConversationController` | `api/controllers/ConversationController.js` | ✅ | Sin hardcoded orgId, usa logger |
| `ProductController` | `api/controllers/ProductController.js` | ❌ **CRITICAL** | L.8: `findByOrganization()` sin orgId |
| `LeadController` | `api/controllers/LeadController.js` | ✅ | Usa req.user?.orgId |
| `BillingController` | `api/controllers/BillingController.js` | ✅ | stripeCustomerId camelCase |
| `StripeWebhookController` | `api/controllers/StripeWebhookController.js` | ⚠️ | `display_items` deprecated en Stripe API |
| `WebhookController` | `api/controllers/WebhookController.js` | ✅ | Encola a BotQueue |
| `MetaWebhookController` | `api/controllers/MetaWebhookController.js` | ✅ | Skip sin orgId, usa logger |
| `AnalyticsController` | `api/controllers/AnalyticsController.js` | ✅ | Meta OAuth + metric overview |
| `ContentController` | `api/controllers/ContentController.js` | ✅ | Sharp upload, scheduler |
| `HealthController` | `api/controllers/HealthController.js` | ✅ | DB + Redis + Ollama checks |

### 3.3 Middleware

| Middleware | Archivo | Estado | Problemas |
|-----------|---------|--------|-----------|
| `auth.js` | `api/middleware/auth.js` | ✅ | JWT verify + role guard |
| `tenant.js` | `api/middleware/tenant.js` | ❌ **CRITICAL** | L.12: `getClient()` NO importado → **CRASHEA** |
| `planLimiter.js` | `api/middleware/planLimiter.js` | ✅ | Límites por plan |

### 3.4 Base de Datos (Migraciones)

| Migración | Archivo | Estado | Descripción |
|-----------|---------|--------|-------------|
| 001 | `config/migrations/001_users_sessions.sql` | ✅ | users + sessions |
| 002 | `config/migrations/002_organizations_extend.sql` | ✅ | memberships + org fields |
| 003 | `config/migrations/003_rls_enable.sql` | ✅ | Row-Level Security |
| 004 | `config/migrations/004_leads.sql` | ✅ | leads table |
| 005 | `config/migrations/005_platform_connections.sql` | ✅ | platform_connections |
| 006 | `config/migrations/006_billing.sql` | ✅ | subscriptions, billing_events, usage_counters |
| 007 | `config/migrations/007_analytics.sql` | ✅ | social_connections, account_metrics |
| 008 | `config/migrations/008_content.sql` | ✅ | assets, posts, post_accounts |

**⚠️ Problema RLS:** El middleware `tenant.js` usa `SET LOCAL app.current_org` pero NO abre una transacción explícita. `SET LOCAL` solo funciona dentro de transacciones. Las políticas RLS dependen de `current_setting('app.current_org')` que será NULL, causando que todas las consultas devuelvan 0 filas.

---

## 4. MÓDULOS FRONTEND

### 4.1 Páginas

| Página | Archivo | Estado | Problemas |
|--------|---------|--------|-----------|
| `LoginPage` | `pages/LoginPage.jsx` | ✅ | 68 líneas, formulario email/password |
| `RegisterPage` | `pages/RegisterPage.jsx` | ✅ | 76 líneas, registro completo |
| `OnboardingPage` | `pages/OnboardingPage.jsx` | ✅ | 145 líneas, wizard 4 pasos |
| `BotPage` | `pages/BotPage.jsx` | ❌ | `connectSocket()` sin token, no disconnect |
| `ContentHub` | `pages/ContentHub.jsx` | ✅ | 200 líneas, 3 tabs (productos, assets, posts) |
| `LeadsPage` | `pages/LeadsPage.jsx` | ❌ **CRITICAL** | `Bot` icon usado pero no importado → runtime error |
| `AnalyticsPage` | `pages/AnalyticsPage.jsx` | ❌ **CRITICAL** | `Instagram` icon usado pero no importado → runtime error |
| `PlansPage` | `pages/PlansPage.jsx` | ⚠️ | Usa `console.error` (líneas 100, 112) |
| `SettingsPage` | `pages/SettingsPage.jsx` | ✅ | 91 líneas, perfil + org + plan |

### 4.2 Componentes

| Componente | Archivo | Estado | Descripción |
|-----------|---------|--------|-------------|
| `Layout` | `components/layout/Layout.jsx` | ✅ | Header + Sidebar + Outlet |
| `Header` | `components/layout/Header.jsx` | ✅ | Top bar con avatar |
| `Sidebar` | `components/layout/Sidebar.jsx` | ✅ | Navegación lateral |
| `ProtectedRoute` | `components/layout/ProtectedRoute.jsx` | ✅ | Auth gate con refreshAuth |
| `ChatWindow` | `components/chat/ChatWindow.jsx` | ❌ | `console.error` línea 19 |
| `Message` | `components/chat/Message.jsx` | ✅ | Burbuja de chat |
| `ChatInput` | `components/chat/ChatInput.jsx` | ✅ | Input con send + attach |
| `ThreadList` | `components/chat/ThreadList.jsx` | ✅ | Lista de hilos |
| `IntelPanel` | `components/chat/IntelPanel.jsx` | ✅ | Panel de datos capturados |
| `NavItem` | `components/shared/NavItem.jsx` | ✅ | Item de navegación |
| `DataField` | `components/shared/DataField.jsx` | ✅ | Campo de datos |

### 4.3 Stores (Zustand)

| Store | Archivo | Estado | Descripción |
|-------|---------|--------|-------------|
| `authStore` | `stores/authStore.js` | ✅ | login/register/logout/refreshAuth |
| `leadStore` | `stores/leadStore.js` | ❌ | `console.error` línea 29 |

### 4.4 Servicios

| Servicio | Archivo | Estado | Descripción |
|----------|---------|--------|-------------|
| `api.js` | `services/api.js` | ✅ | Exporta `API_URL` |
| `apiClient.js` | `services/apiClient.js` | ✅ | Axios + refresh queue |
| `socket.js` | `services/socket.js` | ✅ | Lazy connect, export default null |

---

## 5. INFRAESTRUCTURA Y DEVOPS

### 5.1 Docker

| Archivo | Estado | Descripción |
|---------|--------|-------------|
| `docker-compose.yml` | ✅ | Dev: db + redis + backend + frontend (bind mounts) |
| `docker-compose.prod.yml` | ✅ | Prod: healthchecks, restart, persistencia, env vars |
| `backend/Dockerfile` | ✅ | Dev multi-stage |
| `backend/Dockerfile.prod` | ✅ | Prod multi-stage |
| `frontend/Dockerfile` | ✅ | Dev |
| `frontend/Dockerfile.prod` | ✅ | Prod multi-stage con nginx |
| `nginx.prod.conf` | ✅ | Proxy reverso con /api/, /auth/, /socket.io/, /meta/, /webhook/ |

### 5.2 CI/CD

| Archivo | Estado | Descripción |
|---------|--------|-------------|
| `.github/workflows/ci.yml` | ✅ | 3 jobs: test-backend, test-frontend, docker-build |

**Observación CI/CD:** En `test-backend`, el comando `npm test` necesita que exista la BD y Redis, pero no hay paso de `init_db.js` ni `db_init.sql`. Los tests probablemente fallan en CI porque la BD está vacía.

### 5.3 .gitignore

```
node_modules/
.env
.next/
dist/
build/
.DS_Store
uploads/
*.log
.vite/
coverage/
```

**Faltante:** `scratch/` y `test_bot.js` no están ignorados.

---

## 6. CONFIGURACIONES Y CLAVES FALTANTES

### 6.1 .env — Claves REQUERIDAS para producción

| Variable | Estado | Dónde se usa |
|----------|--------|-------------|
| `DATABASE_URL` | ⚠️ Tiene placeholder | db.js, init_db.js, seed.js |
| `JWT_SECRET` | ✅ YA configurada | auth.js middleware |
| `TOKEN_ENCRYPTION_KEY` | ✅ YA configurada | crypto.js |
| `TELEGRAM_TOKEN` | ⚠️ Placeholder `<PONER_TOKEN_AQUI>` | index.js (polling), TelegramAdapter |
| `META_APP_ID` | ❌ Vacía | MetaWebhookController, WhatsAppAdapter |
| `META_APP_SECRET` | ❌ Vacía | WhatsAppAdapter |
| `WHATSAPP_PHONE_NUMBER_ID` | ❌ Vacía | MetaWebhookController |
| `STRIPE_SECRET_KEY` | ❌ Vacía | BillingController |
| `STRIPE_WEBHOOK_SECRET` | ❌ Vacía | StripeWebhookController |
| `STRIPE_PRICE_PRO_MONTHLY` | ❌ Vacía | BillingController |
| `STRIPE_PRICE_BUSINESS_MONTHLY` | ❌ Vacía | BillingController |
| `STRIPE_PRICE_AGENCY_MONTHLY` | ❌ Vacía | BillingController |
| `STORAGE_ENDPOINT` | ❌ Vacía | ContentController (assets) |
| `STORAGE_ACCESS_KEY` | ❌ Vacía | ContentController |
| `STORAGE_SECRET_KEY` | ❌ Vacía | ContentController |
| `STORAGE_BUCKET` | ✅ Tiene default | ContentController |
| `RESEND_API_KEY` | ❌ Vacía | No implementado aún |
| `VISION_API_URL` | ⚠️ Placeholder | No implementado completamente |
| `WHISPER_PATH` | ⚠️ Placeholder | WhisperTranscriptionService |
| `WHISPER_MODEL_PATH` | ⚠️ Placeholder | WhisperTranscriptionService |

### 6.2 Dependencias del sistema operativo

| Dependencia | Estado | Dónde se necesita |
|------------|--------|-------------------|
| **Ollama** | ❌ No instalado | `OllamaAIService` (modelo nomic-embed-text + LLM) |
| **whisper.cpp** | ❌ No instalado | `WhisperTranscriptionService` |
| **Python/Vision API** | ❌ No instalado | `VISION_API_URL` (procesamiento de imágenes) |
| **Redis** | ⚠️ Docker | Requerido para BullMQ |
| **PostgreSQL (pgvector)** | ⚠️ Docker | Requerido para embeddings |

---

## 7. BUGS CRÍTICOS DETECTADOS

### 🔴 BUG 1 — `tenant.js`: `getClient()` no importado
- **Archivo:** `backend/src/api/middleware/tenant.js:12`
- **Problema:** `client = await getClient()` lanza `ReferenceError: getClient is not defined`
- **Impacto:** TODAS las rutas protegidas (`/api/conversations`, `/api/products`, `/api/leads`, `/api/content`) crashean con error 500
- **Solución:** Agregar `const { getClient } = require('../../config/db');` al inicio

### 🔴 BUG 2 — `ProductController.list`: falta orgId
- **Archivo:** `backend/src/api/controllers/ProductController.js:8`
- **Problema:** `this.productRepo.findByOrganization()` sin argumento → `organizationId` es `undefined`
- **Impacto:** La query SQL `WHERE organization_id = $1` recibe `undefined`, no devuelve productos
- **Solución:** Cambiar a `this.productRepo.findByOrganization(req.user?.orgId)`

### 🔴 BUG 3 — `LeadsPage.jsx`: icono `Bot` no importado
- **Archivo:** `frontend/src/pages/LeadsPage.jsx:3,83`
- **Problema:** L.83 usa `<Bot className="w-3 h-3" />` pero solo importa `{ XCircle, ChevronRight }`
- **Impacto:** Runtime error al renderizar LeadsPage (sección de leads nuevos)
- **Solución:** Agregar `Bot` al import de lucide-react, eliminar `XCircle` si no se usa

### 🔴 BUG 4 — `AnalyticsPage.jsx`: icono `Instagram` no importado
- **Archivo:** `frontend/src/pages/AnalyticsPage.jsx:60`
- **Problema:** L.60 usa `<Instagram className="w-4 h-4" />` pero no está en el import de lucide-react
- **Impacto:** Runtime error al renderizar AnalyticsPage (sección de conectar cuentas)
- **Solución:** Agregar `Instagram` al import de lucide-react

### 🟡 BUG 5 — `BotPage.jsx`: socket sin token
- **Archivo:** `frontend/src/pages/BotPage.jsx:27`
- **Problema:** `const socket = connectSocket()` se llama sin token de autenticación
- **Impacto:** El servidor rechazará la conexión Socket.IO o no asociará el socket al usuario correcto
- **Solución:** Pasar el token desde `useAuthStore`: `const token = useAuthStore((s) => s.accessToken)`

### 🟡 BUG 6 — Stale closure en socket listener
- **Archivo:** `frontend/src/pages/BotPage.jsx:29-37`
- **Problema:** El callback del socket captura `activeThread` del closure, pero no se actualiza cuando `activeThread` cambia
- **Impacto:** Mensajes nuevos se asignan al thread equivocado (el valor antiguo de `activeThread`)
- **Solución:** Usar una ref para `activeThread` dentro del efecto, o incluir `activeThread` en las dependencias y re-registrar el listener

### 🟡 BUG 7 — `PlanLimiter` no se aplica en rutas
- **Archivo:** `backend/src/api/routes/index.js`
- **Problema:** `planLimiter` nunca se importa ni se aplica como middleware en ninguna ruta
- **Impacto:** Todos los usuarios pueden usar recursos ilimitados sin importar su plan
- **Solución:** Importar y aplicar `planLimiter` en las rutas relevantes

---

## 8. DEUDA TÉCNICA

### 8.1 Backend

| Issue | Archivo | Severidad | Descripción |
|-------|---------|-----------|-------------|
| Directorios vacíos | `src/alerts/`, `analytics/`, `billing/`, etc. | Baja | 11 directorios planeados pero sin implementar |
| Sin interfaz extendida | `PostgresOrganizationRepository`, `UserRepository`, `SessionRepository` | Media | No extienden sus puertos (rompe el patrón) |
| `display_items` deprecado | `StripeWebhookController.js:99` | Media | Stripe API deprecated este campo en 2022+ |
| RLS sin transacción | `tenant.js` + `003_rls_enable.sql` | Alta | `SET LOCAL` necesita transacción explícita |
| Redis hardcoded | `BotWorker.js`, `BotQueue.js` | Baja | Usan REDIS_HOST+PORT en vez de REDIS_URL |
| Redis sin reconnect | `BotQueue.js` | Media | No hay manejo de errores de conexión Redis |
| `continue` en pollTelegram | `index.js` (YA FIXED) | — | Ya corregido a `return` en versiones recientes |
| seed.js usa console | `seed.js` | Baja | Script standalone, aceptable |
| init_db.js usa console | `init_db.js` | Baja | Script standalone, aceptable |

### 8.2 Frontend

| Issue | Archivo | Severidad | Descripción |
|-------|---------|-----------|-------------|
| 15+ console.error | `BotPage`, `ContentHub`, `AnalyticsPage`, `ChatWindow`, `PlansPage`, `leadStore` | Media | Sin logger centralizado |
| `App.css` huérfano | `src/App.css` (184 líneas) | Baja | No importado en ningún archivo |
| Assets sin usar | `assets/hero.png`, `react.svg`, `vite.svg` | Baja | 3 archivos no referenciados |
| `hooks/` vacío | `src/hooks/` | Muy baja | Directorio existe pero sin archivos |
| `disconnectSocket()` nunca llamado | `BotPage.jsx` | Media | El socket nunca se desconecta al desmontar |

### 8.3 Tests

| Issue | Archivo | Severidad | Descripción |
|-------|---------|-----------|-------------|
| Tests dependen de DB externa | Todos | Alta | Sin base de datos los tests no corren |
| Sin setup/teardown | `tests/` | Media | No hay script que cree/limpie BD de test |
| `test_bot.js` | `backend/test_bot.js` | Baja | Script manual con token embedido (peligroso) |
| Sin test de integración | — | Alta | Las rutas protegidas no tienen test coverage |
| Sin test de frontend | — | Media | 0 tests en frontend |

### 8.4 Seguridad

| Issue | Archivo | Severidad | Descripción |
|-------|---------|-----------|-------------|
| RLS no funcional | tenant.js + 003_rls_enable.sql | **ALTA** | RLS no funciona sin transacción |
| Token en test_bot.js | `test_bot.js` | Media | Si se commit ea con token real, leak |
| Sin rate-limit por ruta | `index.js` | Media | Solo hay rate-limit global (300/15min) |
| Sin validación de input (pocos) | Controllers | Media | Algunos controllers no sanitizan entrada |

---

## 9. PROCESOS FALTANTES

### 9.1 Procesos Core No Implementados

| Proceso | Prioridad | Descripción |
|---------|-----------|-------------|
| **Notificaciones push/email** | 🔴 Alta | No hay sistema de notificaciones (no hay emails de bienvenida, alertas) |
| **Onboarding real** | 🔴 Alta | El wizard existe en frontend pero el backend no completa el flujo de onboarding (crear config inicial, redirigir) |
| **Recuperación de contraseña** | 🔴 Alta | No hay flujo de "olvidé mi contraseña" |
| **Límites de plan (enforcing)** | 🟡 Media | `planLimiter.js` existe pero NO se aplica en rutas |
| **Métricas/analytics periódicas** | 🟡 Media | `MetricSyncWorker` existe pero no hay programación (cron/scheduler) |
| **Webhook de Meta (verificación real)** | 🟡 Media | Meta requiere HTTPS + certificado válido, no hay deployment público |
| **Sistema de alerts** | 🟡 Media | Directorio `alerts/` vacío, no hay monitoreo proactivo |
| **Facturación/retención** | 🟡 Media | No hay manejo de facturas, downgrade automático, retry de pagos fallidos |

### 9.2 Procesos Secundarios

| Proceso | Prioridad | Descripción |
|---------|-----------|-------------|
| **Multi-idioma** | 🟢 Baja | Todo en español, sin i18n |
| **Modo oscuro toggle** | 🟢 Baja | El tema es fijo oscuro, sin switch |
| **Exportar reportes** | 🟢 Baja | No hay exportación CSV/PDF de leads o analytics |
| **Roles/permisos avanzados** | 🟢 Baja | Solo admin/member básico |
| **Auditoría de cambios** | 🟢 Baja | Sin log de auditoría de cambios en datos sensibles |
| **Webhooks salientes** | 🟢 Baja | No hay webhooks para notificar a sistemas externos |
| **SSO/OAuth social** | 🟢 Baja | No hay login con Google, Facebook, etc. |

---

## 10. IDEAS Y MEJORAS

### 10.1 Mejoras Inmediatas (< 1 día)

| Mejora | Esfuerzo | Impacto |
|--------|----------|---------|
| Fix Bug 1: importar `getClient` en `tenant.js` | 1 línea | 🔴 Elimina crash de todas las rutas protegidas |
| Fix Bug 2: pasar `orgId` a `findByOrganization` | 1 línea | 🔴 Productos funcionales |
| Fix Bug 3+4: imports faltantes | 2 líneas | 🟡 Elimina errores runtime en frontend |
| Fix Bug 5: pasar token a `connectSocket()` | 3 líneas | 🟡 Socket autenticado |
| Fix Bug 7: aplicar `planLimiter` en rutas | 5 líneas | 🟡 Límites de plan funcionales |
| Agregar `scratch/` a `.gitignore` | 1 línea | 🟢 Seguridad de tokens |

### 10.2 Mejoras a Corto Plazo (1-3 días)

| Mejora | Esfuerzo | Impacto |
|--------|----------|---------|
| Reemplazar `console.error` del frontend con logger | 30 min | 🟡 Consistencia |
| Agregar transacción en `tenant.js` para RLS | 30 min | 🔴 Seguridad multi-tenant funcional |
| Agregar límite de rate por ruta (auth, webhook) | 30 min | 🟡 Seguridad |
| CI/CD: agregar paso de `init_db` antes de tests | 30 min | 🟡 Tests pasan en CI |
| Reemplazar `display_items` en Stripe con `line_items` | 15 min | 🟡 Compatibilidad futura |
| `disconnectSocket()` en cleanup de BotPage | 5 min | 🟡 Memoria/recursos |
| `test_bot.js` mover token a .env | 10 min | 🟢 Seguridad |

### 10.3 Mejoras a Mediano Plazo (1-2 semanas)

| Mejora | Esfuerzo | Impacto |
|--------|----------|---------|
| Sistema de notificaciones push/email (Resend) | 3-4 días | 🔴 Engagement de usuarios |
| Recuperación de contraseña | 1-2 días | 🔴 UX crítica |
| Scheduler de métricas (cron en MetricSyncWorker) | 1 día | 🟡 Analytics funcional |
| Implementar los 11 directorios planeados | 3-5 días | 🟡 Arquitectura completa |
| Tests de integración para rutas protegidas | 2-3 días | 🟡 Calidad |
| Dashboard de administración multi-tenant | 2-3 días | 🟡 Gestión |

### 10.4 Ideas Estratégicas

| Idea | Descripción |
|------|-------------|
| **Modo offline / PWA** | Convertir frontend en PWA para usar sin conexión |
| **Chat widget embeddable** | Script JS para que clientes embedan el chat en su web |
| **Plantillas de onboarding** | Por industria (moda, retail, servicios) |
| **Auto-respuestas con IA por horario** | Configurar horarios de bot vs humano |
| **Dashboard de KPIs en tiempo real** | Socket.IO para métricas live |
| **Integración con e-commerce** | Shopify, WooCommerce, MercadoLibre |
| **Segmentación de leads por IA** | Clasificación automática por intención de compra |
| **API pública** | Exponer endpoints para integraciones third-party |

---

## 11. COMPARATIVA CON VERSIÓN ANTERIOR

Esta sección compara el proyecto actual (`C:\proyectos\sistema-marketing`) contra la versión previa en `OneDrive\Desktop\PROYECTOS\sistema-marketing`.

### 11.1 Mejoras en esta versión

| Aspecto | Versión Anterior | Esta Versión |
|---------|-----------------|--------------|
| Estructura de directorios | Plana (16 carpetas en src/) | Organizada por dominio (16 módulos planeados) |
| `PostgresProductRepository` | SIN filtro orgId | ✅ `WHERE organization_id = $1 AND is_active = true` |
| `PostgresBotConfigRepository` | `row.id` incorrecto | ✅ Sin `row.id` |
| `PostgresOrganizationRepository` | Sin `_mapRow()` | ✅ `_mapRow()` con camelCase |
| `socket.js` | `export default null` | ✅ Lazy connect con `connectSocket()` |
| `MetaWebhookController` | Fallback hardcoded orgId | ✅ Skip sin orgId |
| `pino-pretty` | No instalado | ✅ En devDependencies |
| `scratch/` | Contenía tokens | ✅ Vacío |
| `continue` fuera de loop | Presente | ✅ FIXED |
| Backend `console.*` | 17 ocurrencias | ✅ 0 ocurrencias |
| Hardcoded orgIds | 4 ocurrencias | ✅ 0 ocurrencias |
| `planLimiter.js` logger path | Incorrecto | ✅ Correcto |
| Duplicate `/webhook` route | Presente | ✅ Sin duplicados |

### 11.2 Bugs que persisten

| Bug | Versión Anterior | Esta Versión | Estado |
|-----|-----------------|--------------|--------|
| `tenant.js` `getClient()` no importado | ✅ YA FIXED | ❌ ROTO | **REGRESIÓN** |
| `ProductController` sin orgId | ✅ YA FIXED | ❌ ROTO | **REGRESIÓN** |
| Frontend imports faltantes | ✅ YA FIXED | ❌ ROTO | **REGRESIÓN** |
| Frontend `console.error` | ✅ YA FIXED | ❌ 15+ ocurrencias | **REGRESIÓN** |
| `BotPage` socket sin token | ✅ YA FIXED | ❌ ROTO | **REGRESIÓN** |
| Deduplicación de `refreshAuth()` | ✅ App.jsx sin refreshAuth | ⚠️ No verificado | Pendiente |
| `App.css` huérfano | ❌ Existía | ❌ Aún existe | Persiste |
| `hooks/` vacío | ❌ Vacío | ❌ Vacío | Persiste |

**Conclusión:** Esta versión tiene una **arquitectura superior** y corrigió muchos bugs de infraestructura, pero **regresionó** varios bugs de la capa de aplicación (controllers, middleware, frontend) que ya estaban resueltos en la versión anterior. Se recomienda portar los fixes de la versión anterior a esta.

---

## ANEXO A: Inventario Completo de Archivos

### Backend (85 archivos)

```
backend/
├── index.js (224 líneas) — Entry point
├── .env (57 líneas) — Variables de entorno
├── db_init.sql (84 líneas) — Schema SQL
├── package.json — Dependencias
├── seed.js (76 líneas) — Seed script
├── init_db.js (45 líneas) — Init migrations
├── test_bot.js (36 líneas) — Test manual
│
├── src/config/
│   ├── env.js — validateEnv + getAllowedOrigins
│   ├── db.js — Pool PostgreSQL + query wrapper
│   └── migrations/ (8 archivos SQL)
│
├── src/infrastructure/
│   ├── utils/logger.js — Pino logger
│   ├── utils/crypto.js — AES-256-GCM
│   ├── utils/securityUtils.js — Sanitización
│   ├── ai/OllamaAIService.js (30 líneas)
│   ├── ai/WhisperTranscriptionService.js (26 líneas)
│   ├── platform/PlatformManager.js (29 líneas)
│   ├── platform/TelegramAdapter.js (23 líneas)
│   ├── platform/WhatsAppAdapter.js (38 líneas)
│   ├── messaging/BotQueue.js (32 líneas)
│   ├── messaging/BotWorker.js (27 líneas)
│   ├── workers/MetricSyncWorker.js (80 líneas)
│   └── persistence/ (9 repositorios)
│
├── src/api/
│   ├── controllers/ (11 archivos)
│   ├── middleware/ (3 archivos)
│   └── routes/ (8 archivos)
│
├── src/application/use-cases/
│   ├── index.js — Barrel export
│   ├── ProcessMessageUseCase.js (108 líneas)
│   └── AuthenticateUserUseCase.js (122 líneas)
│
├── src/domain/
│   ├── entities/ (6 archivos)
│   └── ports/ (9 interfaces)
│
├── tests/
│   ├── ai.test.js
│   ├── rag.test.js
│   ├── security.test.js
│   ├── suite.test.js
│   ├── fase0/auth.test.js
│   ├── fase0/security.test.js
│   ├── fase1/leads.test.js
│   ├── fase1/platformConnection.test.js
│   ├── fase1/sanitization.test.js
│   └── fase1/whatsapp.test.js
│
├── scratch/ (VACÍO)
└── node_modules/
```

### Frontend (31 archivos fuente)

```
frontend/
├── src/
│   ├── App.jsx (39 líneas)
│   ├── App.css (184 líneas — NO USADO)
│   ├── index.css (49 líneas)
│   ├── main.jsx (13 líneas)
│   ├── pages/ (9 archivos)
│   ├── components/
│   │   ├── layout/ (4 archivos)
│   │   ├── chat/ (5 archivos)
│   │   └── shared/ (2 archivos)
│   ├── services/ (3 archivos)
│   ├── stores/ (2 archivos)
│   ├── hooks/ (VACÍO)
│   └── assets/ (3 archivos — algunos no usados)
├── vite.config.js
├── tailwind.config.js
├── postcss.config.js
├── eslint.config.js
└── package.json
```

---

## ANEXO B: Resumen de Acciones Recomendadas (Priorizadas)

| # | Acción | Prioridad | Archivo | Tiempo |
|---|--------|-----------|---------|--------|
| 1 | Importar `getClient` en tenant.js | 🔴 CRÍTICA | `backend/src/api/middleware/tenant.js` | 1 min |
| 2 | Pasar `orgId` en ProductController | 🔴 CRÍTICA | `backend/src/api/controllers/ProductController.js` | 1 min |
| 3 | Agregar `Bot` a import de LeadsPage | 🔴 CRÍTICA | `frontend/src/pages/LeadsPage.jsx` | 1 min |
| 4 | Agregar `Instagram` a import de AnalyticsPage | 🔴 CRÍTICA | `frontend/src/pages/AnalyticsPage.jsx` | 1 min |
| 5 | Pasar token a `connectSocket()` | 🟡 ALTA | `frontend/src/pages/BotPage.jsx` | 5 min |
| 6 | Agregar transacción explícita para RLS | 🟡 ALTA | `backend/src/api/middleware/tenant.js` | 15 min |
| 7 | Reemplazar 15+ console.error en frontend | 🟡 ALTA | 6 archivos frontend | 20 min |
| 8 | Aplicar `planLimiter` en rutas | 🟡 ALTA | `backend/src/api/routes/index.js` | 10 min |
| 9 | Agregar `disconnectSocket()` en cleanup | 🟡 MEDIA | `frontend/src/pages/BotPage.jsx` | 2 min |
| 10 | Agregar paso init_db en CI/CD | 🟡 MEDIA | `.github/workflows/ci.yml` | 15 min |
| 11 | Reemplazar `display_items` en Stripe | 🟡 MEDIA | `StripeWebhookController.js` | 10 min |
| 12 | Agregar `scratch/` a `.gitignore` | 🟢 BAJA | `.gitignore` raíz | 1 min |
| 13 | Eliminar `App.css` no usado | 🟢 BAJA | `frontend/src/App.css` | 1 min |
| 14 | Limpiar assets no usados | 🟢 BAJA | `frontend/src/assets/` | 5 min |
| 15 | Extender interfaces faltantes | 🟢 BAJA | 3 repositorios | 15 min |
