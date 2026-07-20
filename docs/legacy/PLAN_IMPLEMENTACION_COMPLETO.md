# Plan de Implementación Completo — OmniPresence Suite

> Documento maestro que integra: plan de fases, pruebas unitarias, verificación entre funciones, dependencias, configuración requerida e información pendiente. Sirve como guía única de ejecución.

---

## Índice

1. [Mapa de Dependencias Entre Fases](#1-mapa-de-dependencias-entre-fases)
2. [Inventario de Configuración Requerida](#2-inventario-de-configuración-requerida)
3. [FASE 0 — Seguridad y Fundación](#3-fase-0--seguridad-y-fundación)
4. [FASE 1 — CRM de Leads](#4-fase-1--crm-de-leads)
5. [FASE 2 — Omnicanalidad (WhatsApp)](#5-fase-2--omnicanalidad-whatsapp)
6. [FASE 3 — Refactor Backend](#6-fase-3--refactor-backend)
7. [FASE 4 — Refactor Frontend](#7-fase-4--refactor-frontend)
8. [FASE 5 — Analytics Hub](#8-fase-5--analytics-hub)
9. [FASE 6 — Content Hub](#9-fase-6--content-hub)
10. [FASE 7 — Alertas y Notificaciones](#10-fase-7--alertas-y-notificaciones)
11. [FASE 8 — Onboarding](#11-fase-8--onboarding)
12. [FASE 9 — Billing y Monetización](#12-fase-9--billing-y-monetización)
13. [FASE 10 — Bot Avanzado](#13-fase-10--bot-avanzado)
14. [Matriz de Pruebas Generales del Sistema](#14-matriz-de-pruebas-generales-del-sistema)
15. [Información Pendiente del Usuario](#15-información-pendiente-del-usuario)

---

## 1. Mapa de Dependencias Entre Fases

```
FASE 0 (Seguridad)
  ├── Necesita: JWT_SECRET, TOKEN_ENCRYPTION_KEY, ALLOWED_ORIGINS
  └── Es prerequisito de: TODAS las fases
       │
FASE 3 (Refactor Backend)
  ├── Necesita: FASE 0 completada
  └── Es prerequisito de: FASE 1, 2, 5, 6, 7, 8, 9, 10
       │
FASE 4 (Refactor Frontend)
  ├── Necesita: FASE 0, FASE 3
  └── Es prerequisito de: FASE 1 (kanban), 5 (dashboard), 6 (hub), 8 (onboarding)
       │
FASE 1 (CRM Leads) ── Necesita: FASE 0, FASE 3, FASE 4
FASE 2 (WhatsApp) ─── Necesita: FASE 0, FASE 3
FASE 7 (Alertas) ───── Necesita: FASE 0, FASE 3, FASE 4
FASE 8 (Onboarding) ── Necesita: FASE 0, FASE 3, FASE 4, FASE 1 (opcional)
FASE 5 (Analytics) ─── Necesita: FASE 0, FASE 3, FASE 4, FASE 7 (alertas)
FASE 6 (Content Hub) ─ Necesita: FASE 0, FASE 3, FASE 4, FASE 2 (canales), FASE 7
FASE 9 (Billing) ───── Necesita: FASE 0, FASE 3, FASE 4, FASE 7
FASE 10 (Bot Avanz) ── Necesita: FASE 0, FASE 3, FASE 1 (leads)
```

### Grafo de Ejecución Obligatorio

```
Semana 1-2: FASE 0 ───────────────────────────────────────┐
Semana 3:    FASE 3 + FASE 4 (paralelas) ─────────────────┤
Semana 4:    FASE 1 + FASE 7 (paralelas) ─────────────────┤
Semana 5-6:  FASE 2 ──────────────────────────────────────┤
Semana 7-8:  FASE 8 + FASE 5 (paralelas, necesitan FASE 1)┤
Semana 9-10: FASE 6 + FASE 9 (paralelas) ─────────────────┤
Semana 11-12:FASE 10 ─────────────────────────────────────┘
```

---

## 2. Inventario de Configuración Requerida

### 2.1 Llaves y Secretos (DEBES PROVEERLOS)

| Variable | Propósito | Quién la genera | Estado |
|----------|-----------|-----------------|--------|
| `JWT_SECRET` | Firmar tokens JWT (64+ chars hex) | `node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"` | **PENDIENTE** |
| `TOKEN_ENCRYPTION_KEY` | Cifrar OAuth tokens (32 bytes hex) | `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"` | **PENDIENTE** |
| `ALLOWED_ORIGINS` | CORS — origenes permitidos (CSV) | Tú: `http://localhost:5173,https://app.omnipresence.io` | **PENDIENTE** |
| `TELEGRAM_TOKEN` | Bot Token de Telegram | @BotFather en Telegram | ✅ Existe en .env |
| `META_APP_ID` | ID de App de Facebook Developer | Facebook Developer Dashboard | **PENDIENTE** |
| `META_APP_SECRET` | App Secret de Facebook Developer | Facebook Developer Dashboard | **PENDIENTE** |
| `META_WEBHOOK_VERIFY_TOKEN` | Token de verificación webhook Meta | Tú (elige cualquier string, ej: `omnipresence_verify_2026`) | **PENDIENTE** |
| `WHATSAPP_PHONE_NUMBER_ID` | ID del número de teléfono de WhatsApp Business | Meta Business Dashboard > WhatsApp > Phone Numbers | **PENDIENTE** |
| `STRIPE_SECRET_KEY` | API Key de Stripe | Stripe Dashboard (test: `sk_test_...`) | **PENDIENTE** |
| `STRIPE_WEBHOOK_SECRET` | Secreto de Webhook de Stripe | Stripe Dashboard > Webhooks | **PENDIENTE** |
| `STRIPE_PRICE_PRO_MONTHLY` | Price ID del plan Pro ($29) | Stripe Dashboard > Products | **PENDIENTE** |
| `STRIPE_PRICE_BUSINESS_MONTHLY` | Price ID del plan Business ($59) | Stripe Dashboard > Products | **PENDIENTE** |
| `STRIPE_PRICE_AGENCY_MONTHLY` | Price ID del plan Agency ($89) | Stripe Dashboard > Products | **PENDIENTE** |
| `RESEND_API_KEY` | API Key para emails transaccionales | Resend.com Dashboard | **PENDIENTE** |
| `STORAGE_ENDPOINT` | URL de MinIO/S3 para assets | Tú (ej: `https://storage.omnipresence.io`) | **PENDIENTE** |
| `STORAGE_ACCESS_KEY` | Access Key de S3/MinIO | Tú | **PENDIENTE** |
| `STORAGE_SECRET_KEY` | Secret Key de S3/MinIO | Tú | **PENDIENTE** |
| `STORAGE_BUCKET` | Bucket name | Tú (ej: `omnipresence-assets`) | **PENDIENTE** |
| `FRONTEND_URL` | URL del frontend | Tú (ej: `https://app.omnipresence.io`) | **PENDIENTE** |
| `DOMAIN_URL` | URL base del backend | Tú (ej: `https://api.omnipresence.io`) | **PENDIENTE** |

### 2.2 Cuentas que DEBES CREAR

| Cuenta/App | Propósito | Pasos |
|------------|-----------|-------|
| **Facebook Developer App** | Meta API (WhatsApp, IG, FB) | 1. developers.facebook.com → Crear App → Business → 2. Añadir productos: WhatsApp, Instagram, Facebook Login → 3. Configurar webhook |
| **Stripe Account** | Procesar pagos | 1. dashboard.stripe.com → Register → 2. Activar modo test → 3. Crear 3 Products (Pro/Business/Agency) con precios mensuales → 4. Crear Webhook endpoint → 5. Copiar keys |
| **Resend Account** | Emails transaccionales | 1. resend.com → Register → 2. Verificar dominio → 3. Generar API Key |
| **MinIO o Cloudflare R2** | Storage de assets | 1. Instalar MinIO o crear bucket R2 → 2. Generar Access/Secret keys |
| **Ollama (Local)** | LLM local + embeddings | ✅ Ya instalado (Mistral + nomic-embed-text) |
| **Whisper.cpp (Local)** | Transcripción de audio | ✅ Ya instalado |

### 2.3 Configuraciones que DEBES HACER

| Configuración | Dónde | Detalle |
|---------------|-------|---------|
| Stripe Webhook URL | Stripe Dashboard > Webhook | Apuntar a: `https://{DOMAIN_URL}/webhooks/stripe` |
| Meta Webhook URL | Meta Developer > App > Webhooks | Apuntar a: `https://{DOMAIN_URL}/webhooks/meta` |
| Meta Webhook Verify Token | Meta Developer > App > Webhooks | Usar el mismo valor de `META_WEBHOOK_VERIFY_TOKEN` |
| Stripe Price IDs | Stripe Dashboard > Products | 3 products mensuales: $29, $59, $89 |
| CORS Origins | Backend env var | Lista separada por comas de dominios frontend permitidos |
| Resend Sender Domain | Resend Dashboard | Verificar dominio para enviar como `noreply@tudominio.com` |

### 2.4 Archivo .env Completo (Template)

```env
# ─── App ──────────────────────────────────────────────
NODE_ENV=development
PORT=3000
FRONTEND_URL=http://localhost:5173
DOMAIN_URL=http://localhost:3000
ALLOWED_ORIGINS=http://localhost:5173,http://localhost:3000

# ─── Database ─────────────────────────────────────────
DATABASE_URL=postgresql://user:password@localhost:5432/omnipresence

# ─── Redis ────────────────────────────────────────────
REDIS_URL=redis://localhost:6379

# ─── JWT ──────────────────────────────────────────────
JWT_SECRET=<GENERAR: node -e "console.log(require('crypto').randomBytes(64).toString('hex'))">
JWT_EXPIRES_IN=15m
REFRESH_TOKEN_EXPIRES_IN=7d

# ─── Encryption ───────────────────────────────────────
TOKEN_ENCRYPTION_KEY=<GENERAR: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))">

# ─── Ollama ───────────────────────────────────────────
OLLAMA_URL=http://localhost:11434/api/generate
OLLAMA_EMBED_URL=http://localhost:11434/api/embeddings

# ─── Whisper ──────────────────────────────────────────
WHISPER_PATH=./whisper.cpp/main
WHISPER_MODEL_PATH=./whisper.cpp/models/ggml-base.bin

# ─── Vision AI ────────────────────────────────────────
VISION_API_URL=http://<gpu-instance>:8000/v1/chat/completions

# ─── Telegram ─────────────────────────────────────────
TELEGRAM_TOKEN=<DE @BotFather>

# ─── Meta (Facebook/Instagram/WhatsApp) ───────────────
META_APP_ID=<DE FACEBOOK DEVELOPER>
META_APP_SECRET=<DE FACEBOOK DEVELOPER>
META_API_VERSION=v21.0
META_WEBHOOK_VERIFY_TOKEN=<STRING PERSONALIZADO>
WHATSAPP_PHONE_NUMBER_ID=<DE META BUSINESS>

# ─── Stripe ───────────────────────────────────────────
STRIPE_SECRET_KEY=sk_test_<DE STRIPE DASHBOARD>
STRIPE_WEBHOOK_SECRET=whsec_<DE STRIPE DASHBOARD>
STRIPE_PRICE_PRO_MONTHLY=price_<DE STRIPE PRODUCTS>
STRIPE_PRICE_BUSINESS_MONTHLY=price_<DE STRIPE PRODUCTS>
STRIPE_PRICE_AGENCY_MONTHLY=price_<DE STRIPE PRODUCTS>

# ─── Storage ──────────────────────────────────────────
STORAGE_ENDPOINT=https://storage.omnipresence.io
STORAGE_ACCESS_KEY=<DE MINIO/R2>
STORAGE_SECRET_KEY=<DE MINIO/R2>
STORAGE_BUCKET=omnipresence-assets

# ─── Emails ───────────────────────────────────────────
RESEND_API_KEY=re_<DE RESEND>
```

---

## 3. FASE 0 — Seguridad y Fundación

### 3.1 Migraciones de Base de Datos

**Archivos:** `backend/src/config/migrations/001_users_sessions.sql`, `002_organizations_extend.sql`, `003_rls_enable.sql`

**Pruebas Unitarias:**

| # | Test | Archivo | Descripción | Criterio de Éxito |
|---|------|---------|-------------|-------------------|
| UT-0.1 | `registra usuario con email único` | `auth.test.js` | `register('test@mail.com', 'pass123')` | Retorna `{ user, org, tokens }`. user.email = 'test@mail.com' |
| UT-0.2 | `rechaza email duplicado` | `auth.test.js` | `register('test@mail.com')` dos veces | 2da llamada lanza `Error('EMAIL_TAKEN')` |
| UT-0.3 | `genera JWT con claims correctos` | `auth.test.js` | `generateTokens(user, org)` | Payload contiene: `sub`, `org_id`, `org_slug`, `role`, `plan`, `trial_ends_at` |
| UT-0.4 | `JWT expira en 15 minutos` | `auth.test.js` | Verificar `exp` claim | `exp - iat = 900` (15 min en segundos) |
| UT-0.5 | `refresh token es SHA-256 en DB` | `auth.test.js` | `refresh(userId, orgId)` | Hash guardado en `sessions.token_hash` es 64 chars hex |
| UT-0.6 | `refresh token rota (invalida anterior)` | `auth.test.js` | `refresh()` dos veces con mismo token | 2do refresh retorna nuevos tokens. Token anterior da 401 |
| UT-0.7 | `cifra password con bcrypt` | `auth.test.js` | Mock bcrypt | `bcrypt.hash` llamado con `password`, `saltRounds >= 10` |
| UT-0.8 | `createOrganization setea trial_ends_at` | `auth.test.js` | `createOrganization(name)` | `trial_ends_at` = `NOW() + 14 días` (±1s) |

**Pruebas de Integración (Entre Funciones):**

| # | Test | Flujo | Verificación |
|---|------|-------|-------------|
| IT-0.1 | `Register → Login → Refresh` | register → login → usar access token → refresh → usar new token → refresh invalida anterior | 4 requests: register(201), login(200+token), refresh(200+newTokens), refresh with old(401) |
| IT-0.2 | `Register crea membership owner` | register → query memberships | `role = 'owner'`, `user_id` coincide, `organization_id` coincide |
| IT-0.3 | `Tenant isolation: Org A no ve datos de Org B` | register org1 → crear lead → register org2 → GET /api/leads como org2 | Array vacío para org2 |
| IT-0.4 | `RLS: query directa sin SET LOCAL falla` | pool.query directo sin tenant context | No retorna filas de ninguna org |

**Pruebas de Medio de Ataque (Security Hardening):**

| # | Test | Descripción | Criterio |
|---|------|-------------|----------|
| SEC-0.1 | `Login sin body retorna 400` | POST /auth/login `{}` | `status 400`, `error.code = 'VALIDATION_ERROR'` |
| SEC-0.2 | `Register sin email retorna 400` | POST /auth/register `{ password: 'x' }` | `status 400` |
| SEC-0.3 | `Register con password < 6 chars retorna 400` | `{ email: 'a@b.com', password: '123' }` | `status 400` |
| SEC-0.4 | `Ruta protegida sin JWT retorna 401` | GET /api/leads sin header | `status 401`, `error.code = 'UNAUTHORIZED'` |
| SEC-0.5 | `JWT inválido (firma alterada) retorna 401` | Authorization: `Bearer <token_falso>` | `status 401` |
| SEC-0.6 | `JWT expirado retorna 401` | Usar JWT con `exp` pasado | `status 401`, `error.code = 'SESSION_EXPIRED'` |
| SEC-0.7 | `Refresh con token inexistente retorna 401` | POST /auth/refresh con token inventado | `status 401` |
| SEC-0.8 | `CORS bloquea origen no permitido` | Request desde `http://evil.com` | No se recibe `Access-Control-Allow-Origin` |
| SEC-0.9 | `Rate limiting bloquea después de 20 intentos en /auth` | 21 requests a POST /auth/login | Request 21 retorna `429 Too Many Requests` |

### 3.2 CORS y Rate Limiting

**Verificación de Configuración (Manual):**
1. Request desde `http://localhost:5173` → header `Access-Control-Allow-Origin: http://localhost:5173` ✅
2. Request desde `http://localhost:3000` → mismo header ✅
3. Request desde `http://otro-dominio.com` → **sin** el header ❌
4. Request sin origin → debe permitir (curl, server-to-server) ✅

### 3.3 Eliminar orgId Hardcodeado

**Verificación:**
```bash
grep -r "369344ae" backend/ --include="*.js" --include="*.sql"
# → debe retornar 0 resultados
```

---

## 4. FASE 1 — CRM de Leads

### 4.1 Tabla Leads + Upsert Automático

**Archivos:** `backend/src/leads/leads.service.js`, `backend/src/leads/leads.routes.js`, `backend/src/leads/leads.controller.js`

**Pruebas Unitarias:**

| # | Test | Archivo | Descripción | Criterio |
|---|------|---------|-------------|----------|
| UT-1.1 | `upsertLead crea nuevo lead si no existe` | `leads.test.js` | `upsertLead(org1, 'conv1', data, 60)` | INSERT en leads con `status='warm'`, `intent_score=60` |
| UT-1.2 | `upsertLead actualiza solo si score es mayor` | `leads.test.js` | Lead existe con score 50, upsert con 70 | score → 70. Upsert con 30 → score queda en 70 |
| UT-1.3 | `upsertLead no sobreescribe status converted` | `leads.test.js` | Lead converted, nuevo mensaje score 90 | Status sigue siendo `converted` |
| UT-1.4 | `upsertLead no sobreescribe status lost` | `leads.test.js` | Lead lost, nuevo mensaje score 80 | Status sigue siendo `lost` |
| UT-1.5 | `upsertLead merge captured_data` | `leads.test.js` | Lead tiene `{nombre: 'A'}`, upsert con `{localidad: 'LP'}` | Resultado `{nombre: 'A', localidad: 'LP'}` |
| UT-1.6 | `scoreToStatus(0-20) = 'cold'` | `leads.test.js` | Todos los valores 0..20 | status = 'cold' |
| UT-1.7 | `scoreToStatus(21-70) = 'warm'` | `leads.test.js` | Valores 21..70 | status = 'warm' |
| UT-1.8 | `scoreToStatus(71-100) = 'hot'` | `leads.test.js` | Valores 71..100 | status = 'hot' |
| UT-1.9 | `upsertLead lanza error para score > 100` | `leads.test.js` | `upsertLead(org1, 'conv1', {}, 150)` | CHECK constraint violado o error 400 |

**Pruebas de Integración (Leads → Bot):**

| # | Test | Flujo | Verificación |
|---|------|-------|-------------|
| IT-1.1 | `Bot detecta intención → upsert lead` | Mensaje → processBotResponse → intent_score 75 | Tabla `leads` contiene nuevo registro con score=75, status='hot' |
| IT-1.2 | `Dos mensajes del mismo usuario → upsert (no duplicado)` | Mensaje 1 (score 40) → Mensaje 2 (score 60) | Solo 1 registro en leads, score=60 |
| IT-1.3 | `Mensaje con score bajo (<50) → no upsert` | Mensaje con score 20 | Tabla leads no cambia |
| IT-1.4 | `GET /api/leads filtro por status` | Crear leads cold, warm, hot → GET /api/leads?status=hot | Solo retorna los hot |
| IT-1.5 | `PATCH /api/leads/:id actualiza status + notas` | PATCH `{ status: 'converted', notes: 'Compra realizada', conversion_value: 150 }` | Campos actualizados en DB |

**Pruebas de Frontend (Kanban):**

| # | Test | Descripción | Criterio |
|---|------|-------------|----------|
| UI-1.1 | `Kanban renderiza 5 columnas` | Renderizar Kanban | 5 columnas visibles: Frío, Tibio, Caliente, Convertido, Perdido |
| UI-1.2 | `Lead aparece en columna correcta según status` | Lead cold en DB | Aparece en columna "Frío" |
| UI-1.3 | `Drag & drop a otra columna cambia status` | Arrastrar lead de Frío a Caliente | PATCH a /api/leads/:id con status='hot' |
| UI-1.4 | `LeadCard muestra nombre, score, plataforma` | Renderizar card | Elementos visibles |

---

## 5. FASE 2 — Omnicanalidad (WhatsApp)

### 5.1 Tabla social_connections + Webhook Meta

**Archivos:** `backend/src/webhooks/meta.service.js`, `backend/src/webhooks/meta.routes.js`, `backend/src/webhooks/normalizer.js`, `backend/src/platforms/WhatsAppAdapter.js`

**Pruebas Unitarias:**

| # | Test | Archivo | Descripción | Criterio |
|---|------|---------|-------------|----------|
| UT-2.1 | `normalizePayload estandariza payload de WhatsApp` | `normalizer.test.js` | Payload raw de Meta → formato interno | `{ platform: 'whatsapp', conversationId, text, platformUserId, timestamp }` |
| UT-2.2 | `normalizePayload maneja payload de Instagram` | `normalizer.test.js` | Payload raw de IG DM | `platform: 'instagram'`, mismo formato |
| UT-2.3 | `normalizePayload maneja payload sin texto (solo media)` | `normalizer.test.js` | Mensaje con solo imagen | `text: null`, `mediaUrl` presente |
| UT-2.4 | `WhatsAppAdapter.sendMessage formatea request correcto` | `whatsapp.test.js` | `sendMessage('123', 'Hola')` | Llama a Meta API con body correcto: `{ messaging_product: 'whatsapp', to: '123', text: { body: 'Hola' } }` |
| UT-2.5 | `WhatsAppAdapter.sendMedia envía imagen` | `whatsapp.test.js` | `sendMedia('123', 'url.jpg', 'image')` | Body con `type: 'image'`, `image: { link: 'url.jpg' }` |
| UT-2.6 | `verifyWebhook retorna challenge string` | `meta.test.js` | GET /webhooks/meta con `hub.verify_token` correcto | Status 200, body = `hub.challenge` |
| UT-2.7 | `verifyWebhook retorna 403 si token incorrecto` | `meta.test.js` | GET con token incorrecto | Status 403 |

**Pruebas de Integración:**

| # | Test | Flujo | Verificación |
|---|------|-------|-------------|
| IT-2.1 | `Webhook Meta → normaliza → encola en botQueue` | POST /webhooks/meta con payload real simulado | BullMQ job añadido con payload normalizado |
| IT-2.2 | `Mensaje WhatsApp → bot responde` | Job process_message con platform='whatsapp' | `PlatformManager.sendMessage('whatsapp', ...)` llamado |
| IT-2.3 | `HMAC inválido → 401` | POST /webhooks/meta con firma incorrecta | Status 401, no se procesa |
| IT-2.4 | `GET /api/social_connections retorna canales conectados` | Conectar WhatsApp → GET | Array con un elemento, platform='whatsapp' |
| IT-2.5 | `Token OAuth expirado → alerta` | `token_expires_at < NOW()+7d` | `createAlert` llamado con type='token_expiring' |

### 5.2 Cifrado de Tokens OAuth

**Pruebas Unitarias:**

| # | Test | Descripción | Criterio |
|---|------|-------------|----------|
| UT-2.8 | `encryptToken cifra con AES-256-GCM` | `encryptToken('sk_test_xxx', key)` | Retorna string en base64, no contiene texto original |
| UT-2.9 | `decryptToken recupera texto original` | `decryptToken(encryptToken('x', key), key)` | Retorna 'x' |
| UT-2.10 | `decryptToken con key incorrecta falla` | `decryptToken(token, wrongKey)` | Lanza error (auth tag mismatch) |
| UT-2.11 | `cada token produce IV diferente` | encryptToken('x') dos veces | Dos outputs distintos |

---

## 6. FASE 3 — Refactor Backend

### 6.1 Estructura en Capas

**Pruebas Unitarias por Capa:**

| # | Test | Archivo | Descripción |
|---|------|---------|-------------|
| UT-3.1 | `bot.service.processIncomingMessage → llama a rag + llm + saveMessage` | `bot.test.js` | Mock rag service + llm service. Verifica que se llaman en orden |
| UT-3.2 | `rag.service.performRAGQuery → retorna chunks` | `rag.test.js` | Mock pgvector query. Retorna top 3 chunks ordenados por similitud |
| UT-3.3 | `rag.service con query vacía → retorna []` | `rag.test.js` | Embedding query vacío. Pool retorna `{ rows: [] }` |
| UT-3.4 | `inbox.service.getConversations → paginación` | `inbox.test.js` | 25 conversaciones, page=1, limit=10 → 10 items, hasMore=true |
| UT-3.5 | `llm.service.generateResponse → llama a Ollama` | `llm.test.js` | Mock axios.post Ollama. Verifica formato del prompt |
| UT-3.6 | `llm.service.parseResponse → extrae JSON` | `llm.test.js` | Response raw de Ollama → `{ response_text, intent_score, captured_data }` |
| UT-3.7 | `llm.service con JSON inválido → null (graceful)` | `llm.test.js` | Respuesta no-JSON del LLM → null, no crash |

**Pruebas de Contrato Entre Servicios:**

| # | Test | Verifica que... |
|---|------|----------------|
| CONT-3.1 | `bot.service` recibe de `rag.service`: `{ chunks: string[], query: string }` | Formato de retorno |
| CONT-3.2 | `bot.service` envía a `llm.service`: `{ systemPrompt, userMessage, history }` | Formato de entrada |
| CONT-3.3 | `llm.service` retorna a `bot.service`: `{ response_text, intent_score, confidence, captured_data }` | Formato de salida |
| CONT-3.4 | `bot.service` envía a `leads.service.upsertLead`: `{ orgId, conversationId, captured_data, intent_score }` | Solo si intent_score >= threshold |

---

## 7. FASE 4 — Refactor Frontend

### 7.1 React Router + Estado Global + Auth Flow

**Pruebas de Funcionamiento:**

| # | Test | Descripción | Criterio |
|---|------|-------------|----------|
| UT-4.1 | `authStore.login → api → setea token + user + org` | `login('mail', 'pass')` | Store tiene: `accessToken`, `user.name`, `org.name` |
| UT-4.2 | `authStore.logout → limpia store y redirige` | `logout()` | `accessToken = null`, `user = null`. Router en /login |
| UT-4.3 | `ProtectedRoute sin token → redirect a /login` | Renderizar `<ProtectedRoute />` sin token | Navegación a /login |
| UT-4.4 | `ProtectedRoute con token → renderiza children` | Con token válido | Renderiza contenido protegido |
| UT-4.5 | `api.js interceptor añade Authorization header` | Llamar `api.get('/test')` | Header `Authorization: Bearer <token>` presente |
| UT-4.6 | `api.js interceptor 401 → logout` | Response 401 | `authStore.logout()` llamado |
| UT-4.7 | `api.js interceptor refresca token en 401` | Response 401 con refresh token válido | Llama a `/auth/refresh`, reintenta request original |
| UT-4.8 | `Ruta /app/inbox renderiza BotDashboard` | Navegar a /app/inbox | Componente BotDashboard montado |

**Pruebas de Regresión (que nada se rompió al migrar):**

| # | Test | Verificación |
|---|------|-------------|
| REG-4.1 | Sidebar navegación a AI Bot Engine funciona | Click → carga /app/inbox con threads |
| REG-4.2 | Chat panel carga mensajes del thread activo | Click en thread → GET /api/conversations/:id/messages |
| REG-4.3 | Enviar mensaje como admin funciona | Input + Enter → POST /api/conversations/:id/reply |
| REG-4.4 | Take Control pausa bot | Click → POST /api/conversations/:id/take-control |
| REG-4.5 | Training Hub carga catálogo de productos | Click → /app/training → renderiza productos |

---

## 8. FASE 5 — Analytics Hub

### 8.1 Tablas + OAuth + Sincronización

**Pruebas Unitarias:**

| # | Test | Archivo | Descripción | Criterio |
|---|------|---------|-------------|----------|
| UT-5.1 | `syncSocialMetrics upsert correctamente` | `analytics.test.js` | Data mock de Meta API → `account_metrics` y `post_metrics` | ON CONFLICT DO UPDATE funciona |
| UT-5.2 | `token expirando en < 7 días → alerta` | `analytics.test.js` | `token_expires_at = NOW()+3d` | `createAlert` llamado con type='token_expiring' |
| UT-5.3 | `token expirando en > 7 días → sin alerta` | `analytics.test.js` | `token_expires_at = NOW()+30d` | No se crea alerta |
| UT-5.4 | `calcular_engagement_rate fórmula correcta` | `analytics.test.js` | `calcEngagementRate(100, 10, 5, 2, 500)` | `(100+10+5+2)/500*100 = 23.4%` |
| UT-5.5 | `calcular_engagement_rate reach=0 → 0%` | `analytics.test.js` | `calcEngagementRate(0, 0, 0, 0, 0)` | 0 (división segura) |

**Pruebas de Integración:**

| # | Test | Flujo | Verificación |
|---|------|-------|-------------|
| IT-5.1 | `OAuth Facebook → intercambio code → guarda token` | POST /api/channels/oauth/callback con code | `social_connections` nuevo registro, token cifrado |
| IT-5.2 | `GET /api/analytics/overview retorna KPIs` | Después de sync | `{ kpis: { totalReach, avgEngagementRate, totalLeads, costPerLead } }` |
| IT-5.3 | `GET /api/analytics/overview con fechas inválidas` | `from=invalido&to=tambien` | Status 400, error.code 'VALIDATION_ERROR' |
| IT-5.4 | `Sync job corre sin crash si Meta API falla` | Mock 500 de Meta API | Job no falla (try/catch), alerta generada |

**Pruebas de Frontend (Dashboard):**

| # | Test | Descripción | Criterio |
|---|------|-------------|----------|
| UI-5.1 | `KPICard renderiza valor + tendencia` | Renderizar KPI con valor 1500 y cambio +12% | Valor visible, flecha verde hacia arriba |
| UI-5.2 | `LineChart muestra 30 días de datos` | Array con 30 data points | Gráfica renderizada con 30 puntos |
| UI-5.3 | `DateRangePicker filtra datos` | Seleccionar "Últimos 7 días" | GET /api/analytics/overview con `from` y `to` actualizados |

---

## 9. FASE 6 — Content Hub

### 9.1 Assets + Sharp + Publicación

**Pruebas Unitarias:**

| # | Test | Archivo | Descripción | Criterio |
|---|------|---------|-------------|----------|
| UT-6.1 | `processAsset genera variantes Sharp correctas` | `content.test.js` | Imagen 2000x2000 → 4 variantes con dimensiones correctas | `1080x1080`, `1080x1920`, `1200x630`, `300x300` |
| UT-6.2 | `processAsset con archivo inválido → error` | `content.test.js` | Buffer corrupto | Lanza error, status='failed' |
| UT-6.3 | `schedulePost programa en BullMQ` | `content.test.js` | `schedulePost(postId, scheduledAt)` | Job 'publish_post' añadido con `scheduledAt` correcto |
| UT-6.4 | `publishPost publica en todas las cuentas` | `content.test.js` | Post con 2 accounts | PlatformManager.sendMessage llamado 2 veces |
| UT-6.5 | `publishPost reintenta hasta 3 veces` | `content.test.js` | 3 fallos seguidos | 3 llamadas, última marca como 'failed' |
| UT-6.6 | `publishPost backoff exponencial` | `content.test.js` | Retry 1: delay 5min, Retry 2: 10min, Retry 3: 20min | Tiempo entre reintentos coincide |

**Pruebas de Integración:**

| # | Test | Flujo | Verificación |
|---|------|-------|-------------|
| IT-6.1 | `POST /api/assets/upload → procesa → notifica` | Upload imagen → job process_asset → socket emit | Socket emite `asset:processed` con variantes |
| IT-6.2 | `POST /api/posts → crea post programado` | Crear post con `scheduled_at` futuro | BullMQ job programado |
| IT-6.3 | `Publish falla → alerta` | Job publish_post falla 3 veces | `createAlert(orgId, 'post_failed', 'error')` |

---

## 10. FASE 7 — Alertas y Notificaciones

### 10.1 Disparadores y Socket.IO

**Pruebas Unitarias:**

| # | Test | Archivo | Descripción | Criterio |
|---|------|---------|-------------|----------|
| UT-7.1 | `createAlert inserta en tabla alerts` | `alerts.test.js` | `createAlert(org1, 'hot_lead', 'info', { score: 85 })` | INSERT en alerts con type, severity, context_data |
| UT-7.2 | `createAlert emite socket a room correcta` | `alerts.test.js` | Mock socket.io | `io.to('org_<orgId>').emit('alert:new', ...)` llamado |
| UT-7.3 | `getAlerts retorna no leídas primero` | `alerts.test.js` | 2 alerts (1 leída, 1 no) | Array: alert no leída primero |
| UT-7.4 | `markAsRead update is_read=true` | `alerts.test.js` | `markAsRead(alertId)` | `alerts.is_read = true` solo para ese alertId |

**Pruebas de Integración (Disparadores → Alertas):**

| # | Test | Disparador | Verificación |
|---|------|-----------|-------------|
| IT-7.1 | `Lead score >= 70 → alerta hot_lead` | upsertLead con score 85 | Alerta creada con type='hot_lead' |
| IT-7.2 | `Bot escalado → alerta bot_escalated` | handoff a humano | Alerta type='bot_escalated' |
| IT-7.3 | `3 retries publish fallidos → alerta post_failed` | Job publish_post fails | Alerta type='post_failed', severity='error' |
| IT-7.4 | `Token expira < 7 días → alerta token_expiring` | syncSocialMetrics | Alerta type='token_expiring', severity='warning' |
| IT-7.5 | `Pago fallido → alerta payment_failed` | Webhook Stripe invoice.payment_failed | Alerta type='payment_failed', severity='error' |

---

## 11. FASE 8 — Onboarding

### 11.1 Flujo de 4 Pasos

**Pruebas Unitarias:**

| # | Test | Descripción | Criterio |
|---|------|-------------|----------|
| UT-8.1 | `createOrganization setea onboarding_step=0` | `createOrg(name, industry, tz)` | `organization.onboarding_step = 0` |
| UT-8.2 | `updateOnboardingStep incrementa paso` | Paso 0 → PATCH paso 1 | `onboarding_step = 1` |
| UT-8.3 | `updateOnboardingStep rechaza saltos >1` | Paso 0 → PATCH paso 2 | Error: "Debes completar el paso 1 primero" |
| UT-8.4 | `isOnboardingComplete retorna true solo en paso 4` | Paso 0,1,2,3,4 → respectivos booleanos | Solo paso 4 retorna true |

**Pruebas de Integración:**

| # | Test | Flujo | Verificación |
|---|------|-------|-------------|
| IT-8.1 | `Register → redirect a /onboarding` | POST /auth/register | Response 201 + `redirect: '/onboarding'` |
| IT-8.2 | `Onboarding paso 4 completo → redirect a /app/inbox` | PATCH paso 4 → GET /me | `onboarding_step = 4`, redirect |
| IT-8.3 | `Onboarding sin paso 2 (sin canal) → bot no activable` | Paso 1 → saltar paso 2 → intentar paso 4 | Bot activación deshabilitada |

---

## 12. FASE 9 — Billing y Monetización

### 12.1 Stripe + Plan Limiter

**Pruebas Unitarias:**

| # | Test | Archivo | Descripción | Criterio |
|---|------|---------|-------------|----------|
| UT-9.1 | `getEffectivePlan con trial activo retorna 'pro'` | `plan-limits.test.js` | `trial_ends_at = NOW()+1d` → `'pro'` |
| UT-9.2 | `getEffectivePlan con trial vencido retorna plan real` | `plan-limits.test.js` | `trial_ends_at = NOW()-1d`, `plan='free'` → `'free'` |
| UT-9.3 | `getEffectivePlan sin trial (null) retorna plan real` | `plan-limits.test.js` | `trial_ends_at = null` → `org.plan` |
| UT-9.4 | `checkAndIncrementUsage dentro del límite → ok` | `plan-limits.test.js` | Free plan, channels=1, límite=2 → no error |
| UT-9.5 | `checkAndIncrementUsage excede límite → 402` | `plan-limits.test.js` | Free plan, channels=3, límite=2 → `PlanLimitExceededError` |
| UT-9.6 | `checkAndIncrementUsage con -1 (ilimitado) → ok` | `plan-limits.test.js` | Agency plan, channels=99 → no error |
| UT-9.7 | `planFromPriceId mapeo correcto` | `billing.test.js` | `price_pro_id` → `'pro'`, `price_biz_id` → `'business'` |
| UT-9.8 | `planFromPriceId con ID desconocido → null` | `billing.test.js` | `price_id_falso` → `null` |
| UT-9.9 | `handleSubscriptionUpdated actualiza plan en DB` | `billing.test.js` | Evento Stripe → `organizations.plan = 'pro'` |
| UT-9.10 | `handlePaymentFailed primer intento → solo alerta` | `billing.test.js` | `attempt_count = 1` | No cambia plan. Alerta creada |
| UT-9.11 | `handlePaymentFailed tercer intento → degrada a free` | `billing.test.js` | `attempt_count = 3` | `organizations.plan = 'free'`, email enviado |
| UT-9.12 | `handleInvoicePaid restaura plan correcto` | `billing.test.js` | Org degradada, pago exitoso → plan restaurado | `organizations.plan = 'pro'` (el plan real) |

**Pruebas de Integración (Billing con Stripe Mock):**

| # | Test | Flujo | Verificación |
|---|------|-------|-------------|
| IT-9.1 | `POST /billing/subscribe → crea Stripe Customer + Subscription` | Mock Stripe API | `stripe.customers.create` + `stripe.subscriptions.create` llamados |
| IT-9.2 | `Webhook subscription.updated → actualiza plan` | Evento simulado → handler | `organizations.plan = 'pro'`, `subscriptions` upsert |
| IT-9.3 | `Mismo evento Stripe 2 veces → idempotente` | 2 requests con mismo stripe_event_id | 2do request: status 200, no cambia DB |
| IT-9.4 | `Upgrade Free → Pro → webhook → plan cambia` | Simular flujo completo | Plan actualizado SOLO desde webhook |
| IT-9.5 | `GET /billing/current con trial activo → effectivePlan='pro'` | Org con trial vigente | `{ plan: 'free', effectivePlan: 'pro', trialEndsAt: '...' }` |
| IT-9.6 | `Límite de canales Free (2) → 3er canal da 402` | Free plan, 2 canales ya conectados | 402 PLAN_LIMIT_EXCEEDED |
| IT-9.7 | `Límite de bot_conversations Free (100) → 101 da 402` | Free plan, 100 mensajes procesados | 402 PLAN_LIMIT_EXCEEDED |

**Pruebas de Webhook Stripe (End-to-End):**

Se deben probar con Stripe Test Clock (avanza el tiempo):

| # | Escenario | Configuración de Stripe | Resultado Esperado |
|---|-----------|------------------------|-------------------|
| E2E-9.1 | Suscripción exitosa Pro | Tarjeta 4242... | Plan='pro', email billing_welcome |
| E2E-9.2 | Pago decline (1er intento) | Tarjeta 4000...341 | Alerta payment_failed, plan NO cambia |
| E2E-9.3 | Pago decline (3er intento) | Avanzar clock 3 ciclos | Plan='free', email payment_failed_suspended |
| E2E-9.4 | 3D Secure requerido | Tarjeta 4000...155 | client_secret retornado, confirmación frontend necesaria |
| E2E-9.5 | Cancelación programada | cancel_at_period_end=true | subscriptions.cancel_at_period_end=true, plan activo hasta fin período |

---

## 13. FASE 10 — Bot Avanzado

### 13.1 Pipeline de Upload + Function Calling + State Machine

**Pruebas Unitarias:**

| # | Test | Archivo | Descripción | Criterio |
|---|------|---------|-------------|----------|
| UT-10.1 | `processCSV genera chunks por fila` | `knowledge.test.js` | CSV con 5 filas → 5 chunks con formato correcto |
| UT-10.2 | `processPDF extrae texto y chunkiza` | `knowledge.test.js` | PDF de 2000 tokens → 4 chunks de 500 tokens con overlap 50 |
| UT-10.3 | `processText chunkiza texto largo` | `knowledge.test.js` | Texto de 3000 chars → chunks < 500 tokens |
| UT-10.4 | `extractFunctionCall detecta GUARDAR_LEAD en respuesta` | `bot.test.js` | Respuesta JSON con `{ function: 'GUARDAR_LEAD', args: {...} }` | Extrae nombre y args correctos |
| UT-10.5 | `executeFunctionCall ejecuta función y retorna resultado` | `bot.test.js` | `executeFunction('CREAR_CITA', { fecha, hora })` | `crear_cita(args)` llamado, retorna resultado |
| UT-10.6 | `stateMachine.transition cambia estado` | `bot.test.js` | Estado SALUDO → input con "quiero comprar" | Estado → DESCUBRIMIENTO |
| UT-10.7 | `stateMachine.getContext retorna contexto actual` | `bot.test.js` | Estado DESCUBRIMIENTO, datos cualificación | `{ state: 'DISCOVERY', collectedData: { ... } }` |
| UT-10.8 | `stateMachine valida transiciones permitidas` | `bot.test.js` | CIERRE → SALUDO (ilegal) | Error: "Transición no permitida" |

**Pruebas de Integración (Bot Pipeline Completo):**

| # | Test | Flujo | Verificación |
|---|------|-------|-------------|
| IT-10.1 | `Upload CSV → embeddings → chunks en DB` | POST /api/bot/knowledge/upload con CSV | knowledge_chunks tiene 5 registros, embedding no null |
| IT-10.2 | `Mensaje usuario → RAG con nuevo conocimiento` | Consultar algo del CSV recién subido | LLM usa contexto del CSV |
| IT-10.3 | `LLM retorna function_call → ejecuta función → responde` | "Quiero agendar una cita para mañana" | `crear_cita()` ejecutada, respuesta al usuario confirma |
| IT-10.4 | `LLM retorna escalate → handoff a humano` | "Necesito hablar con un agente" | Bot pausado, alerta bot_escalated creada |

---

## 14. Matriz de Pruebas Generales del Sistema

### 14.1 Mapa de Cobertura por Módulo

```
Módulo          | Unitarias | Integración | E2E | Frontend UI | Total
────────────────┼──────────┼─────────────┼─────┼─────────────┼──────
FASE 0 — Auth   |     9    |      4      |  0  |      0      |  13
FASE 1 — Leads  |     9    |      5      |  0  |      4      |  18
FASE 2 — WApp   |     6    |      5      |  0  |      0      |  11
FASE 3 — Backend|     7    |      4      |  0  |      0      |  11
FASE 4 — Fr-end |     8    |      0      |  0  |      5      |  13
FASE 5 — Anlytcs|     5    |      4      |  0  |      3      |  12
FASE 6 — Cntent|     6    |      3      |  0  |      0      |   9
FASE 7 — Alerts|     4    |      5      |  0  |      0      |   9
FASE 8 — Onbrd |     4    |      3      |  0  |      0      |   7
FASE 9 — Billng|    12    |      7      |  5  |      0      |  24
FASE 10 — Bot  |     8    |      4      |  0  |      0      |  12
────────────────┼──────────┼─────────────┼─────┼─────────────┼──────
Totales         |    78    |     44      |  5  |     12      | 139
Security        |     9    |      0      |  0  |      0      |   9
                |         |             |     |             |
GRAN TOTAL      |    87    |     44      |  5  |     12      | 148
```

### 14.2 Pruebas de Regresión (Ejecutar Siempre Antes de Cada Deploy)

| # | Escenario | Script/Comando |
|---|-----------|---------------|
| SMK-1 | Smoke test: API health | `GET /health → status 200` |
| SMK-2 | Smoke test: Login flow | `POST /auth/login → status 200 + tokens` |
| SMK-3 | Smoke test: DB connection | `SELECT 1 → rowCount: 1` |
| SMK-4 | Smoke test: Redis connection | `PING → PONG` |
| SMK-5 | Smoke test: Ollama connectivity | `OLLAMA_URL/api/tags → models list` |
| SMK-6 | Smoke test: Bot response | Enviar mensaje → bot responde en < 30s |
| SMK-7 | Full regression: All FASE 0 tests | `npx jest tests/fase0/` |
| SMK-8 | Full regression: Security tests | `npx jest tests/security.test.js` |

### 14.3 Comandos de Ejecución de Pruebas

```bash
# Unit tests por fase
npx jest tests/fase0/          # 13 tests
npx jest tests/fase1/          # 18 tests
npx jest tests/fase2/          # 11 tests
npx jest tests/fase3/          # 11 tests
npx jest tests/fase4/          # 13 tests
npx jest tests/fase5/          # 12 tests
npx jest tests/fase6/          # 9 tests
npx jest tests/fase7/          # 9 tests
npx jest tests/fase8/          # 7 tests
npx jest tests/fase9/          # 24 tests
npx jest tests/fase10/         # 12 tests

# Todos los tests de una vez
npx jest --coverage           # 148 tests + coverage report

# Tests de seguridad (ejecutar en CI obligatorio)
npx jest tests/security/

# Smoke tests
node scripts/smoke-test.js    # Test de conectividad general
```

### 14.4 Cobertura Mínima por Capa

| Capa | Objetivo | Mínimo |
|------|----------|--------|
| Services (lógica de negocio) | 90% | 80% |
| Controllers (handlers) | 80% | 70% |
| Middleware (auth, tenant, plan) | 95% | 90% |
| Platforms (adapters) | 90% | 80% |
| Frontend components | 70% | 50% |
| Frontend stores (zustand) | 90% | 80% |

---

## 15. Información Pendiente del Usuario

### 15.1 Lo que DEBES Proveer (Checklist)

- [ ] **JWT_SECRET** — Generar con `node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"`
- [ ] **TOKEN_ENCRYPTION_KEY** — Generar con `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`
- [ ] **ALLOWED_ORIGINS** — Lista de dominios frontend permitidos (ej: `http://localhost:5173,https://app.tudominio.com`)
- [ ] **TELEGRAM_TOKEN** — ✅ Ya existe (confirmar que funciona)
- [ ] **META_APP_ID** — Crear App en Facebook Developers
- [ ] **META_APP_SECRET** — Desde Facebook Developers > App > Basic Settings
- [ ] **META_WEBHOOK_VERIFY_TOKEN** — Elegir un string cualquiera (ej: `omnipresence_verify_2026`)
- [ ] **WHATSAPP_PHONE_NUMBER_ID** — Desde Meta Business Suite > WhatsApp > Phone Numbers
- [ ] **STRIPE_PRICE_PRO_MONTHLY** — Crear producto en Stripe Dashboard > Products > Añadir precio $29/mes → copiar `price_xxx`
- [ ] **STRIPE_PRICE_BUSINESS_MONTHLY** — Producto $59/mes → copiar `price_xxx`
- [ ] **STRIPE_PRICE_AGENCY_MONTHLY** — Producto $89/mes → copiar `price_xxx`
- [ ] **STRIPE_SECRET_KEY** — Stripe Dashboard > Developers > API Keys (usar `sk_test_...`)
- [ ] **STRIPE_WEBHOOK_SECRET** — Stripe Dashboard > Webhooks > Añadir endpoint > `{DOMAIN}/webhooks/stripe` > copiar `whsec_...`
- [ ] **RESEND_API_KEY** — Resend.com > API Keys > Crear key
- [ ] **STORAGE_ENDPOINT** — URL de tu MinIO o Cloudflare R2
- [ ] **STORAGE_ACCESS_KEY / STORAGE_SECRET_KEY** — Credenciales de storage
- [ ] **STORAGE_BUCKET** — Nombre del bucket (ej: `omnipresence-assets`)
- [ ] **FRONTEND_URL** — URL donde corre el frontend (desarrollo: `http://localhost:5173`)
- [ ] **DOMAIN_URL** — URL donde corre el backend (desarrollo: `http://localhost:3000`)
- [ ] **VISION_API_URL** — URL de la instancia GPU con Qwen-VL

### 15.2 Lo que DEBES DECIDIR

- [ ] **¿Dónde se deploya?** — Servidor local, VPS, o cloud? (afecta configuración de webhooks, URLs)
- [ ] **¿MinIO self-hosted o Cloudflare R2?** — Para storage de assets
- [ ] **¿Nombre del bucket de storage?** — `omnipresence-assets` u otro
- [ ] **¿Meta Business App ya está creada o hay que hacerla desde cero?**
- [ ] **¿Cuenta de Stripe ya existe o necesitas crear una?**
- [ ] **¿Dominio/configuración de email para Resend?** — Verificar dominio para enviar emails
- [ ] **¿Instancia GPU ya está configurada con Qwen-VL?** — necesito la URL

### 15.3 Lo que YO (asistente) Puedo Hacer Sin Tu Input

| Feature | Depende de ti? | Puedo empezar? |
|---------|---------------|----------------|
| FASE 0 — Migraciones SQL | No | ✅ Sí (son archivos SQL) |
| FASE 0 — Estructura carpetas backend | No | ✅ Sí |
| FASE 0 — auth.service.js (lógica) | Sí (necesito JWT_SECRET) | ⚠️ Parcial (puedo escribir el código, lo configuras después) |
| FASE 1 — Tabla leads SQL | No | ✅ Sí |
| FASE 1 — leads.service.js | No | ✅ Sí (sin auth, pero funciona) |
| FASE 2 — PlatformManager refactor | No | ✅ Sí |
| FASE 2 — WhatsAppAdapter | Sí (necesito META_APP_ID, etc.) | ⚠️ Parcial (puedo escribir código, pruebas requieren credenciales) |
| FASE 3 — Refactor backend | No | ✅ Sí |
| FASE 4 — Refactor frontend | No | ✅ Sí (routing, stores, componentes) |
| FASE 5 — OAuth Facebook | Sí (necesito META_APP_ID) | ⚠️ Parcial |
| FASE 5 — Tablas analytics | No | ✅ Sí |
| FASE 6 — Sharp processing | No | ✅ Sí |
| FASE 6 — Frontend content hub | No | ✅ Sí |
| FASE 7 — Alertas | No | ✅ Sí |
| FASE 8 — Onboarding | No | ✅ Sí |
| FASE 9 — Billing | Sí (necesito Stripe keys) | ⚠️ Parcial |
| FASE 10 — Bot avanzado | No | ✅ Sí |

### 15.4 Configuración Inicial Recomendada

Antes de empezar a codificar la FASE 0, te recomiendo:

1. **Crear el archivo `.env`** con el template completo de la sección 2.4
2. **Generar JWT_SECRET y TOKEN_ENCRYPTION_KEY** (son solo comandos de node)
3. **Decidir ALLOWED_ORIGINS** (para local: `http://localhost:5173,http://localhost:3000`)
4. **Si tienes Stripe lista**, crear los 3 productos y obtener los price IDs
5. **El resto podemos postergarlo** hasta la semana que toque esa fase

Si no tienes alguna credencial, **podemos empezar igual** usando valores placeholder y configurarlos después. Lo único crítico para FASE 0 son `JWT_SECRET` y `ALLOWED_ORIGINS`.

---

## Apéndice A: Especificación de Contratos Entre Servicios

### A.1 authService → Middleware JWT

```javascript
// authService.generateTokens(user, org) → { accessToken, refreshToken }
// authService.verifyToken(token) → { sub, org_id, role, plan, trial_ends_at, iat, exp }
// authService.refreshToken(refreshToken) → { accessToken, refreshToken }

// Middleware: req.user = { id, orgId, role, plan, trialEndsAt }
```

### A.2 botService → ragService

```javascript
// botService.processIncomingMessage({ orgId, conversationId, text, platform })
//   → ragService.performRAGQuery(orgId, queryText) → { chunks: string[], query: string }

// Contrato de entrada: { orgId: string, queryText: string }
// Contrato de salida: { chunks: string[], query: string }
```

### A.3 botService → llmService

```javascript
// botService → llmService.generateResponse({ systemPrompt, userMessage, history })
//   → { response_text, intent_score, confidence, captured_data }

// Contrato de entrada: { systemPrompt: string, userMessage: string, history: string }
// Contrato de salida: { response_text: string, intent_score: number, confidence: number, captured_data: object }
```

### A.4 botService → leadsService

```javascript
// botService → leadsService.upsertLead(orgId, conversationId, captured_data, intent_score)
// Sólo si intent_score >= threshold (default 50)

// Contrato: { orgId, conversationId, captured_data, intent_score }
// NO llama si status='converted' o 'lost'
// NO llama si nuevo score <= score existente
```

### A.5 botService → PlatformManager

```javascript
// botService → PlatformManager.sendMessage(platform, chatId, text)
// platform: 'telegram' | 'whatsapp' | 'instagram' | 'facebook'
// Si platform no registrada → fallback a telegram (o log de error)
```

### A.6 alertsService → socket.io

```javascript
// alertsService.createAlert(orgId, type, severity, data)
//   → INSERT en alerts
//   → io.to(`org_${orgId}`).emit('alert:new', { id, type, severity, title, message })
```

---

## Apéndice B: Variables de Entorno — Mapa de Uso por FASE

| Variable | FASE 0 | FASE 1 | FASE 2 | FASE 3 | FASE 4 | FASE 5 | FASE 6 | FASE 7 | FASE 8 | FASE 9 | FASE 10 |
|----------|--------|--------|--------|--------|--------|--------|--------|--------|--------|--------|---------|
| DATABASE_URL | ✅ | ✅ | ✅ | ✅ | — | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| REDIS_URL | ✅ | ✅ | ✅ | ✅ | — | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| JWT_SECRET | ✅ | — | — | — | — | — | — | — | — | — | — |
| TOKEN_ENCRYPTION_KEY | ✅ | — | ✅ | — | — | ✅ | — | — | — | — | — |
| ALLOWED_ORIGINS | ✅ | — | — | — | — | — | — | — | — | — | — |
| TELEGRAM_TOKEN | ✅ | ✅ | ✅ | ✅ | — | — | — | — | — | — | ✅ |
| META_APP_ID | — | — | ✅ | — | — | ✅ | ✅ | — | — | — | — |
| META_APP_SECRET | — | — | ✅ | — | — | ✅ | ✅ | — | — | — | — |
| META_WEBHOOK_VERIFY_TOKEN | — | — | ✅ | — | — | — | — | — | — | — | — |
| WHATSAPP_PHONE_NUMBER_ID | — | — | ✅ | — | — | — | — | — | — | — | — |
| STRIPE_SECRET_KEY | — | — | — | — | — | — | — | — | — | ✅ | — |
| STRIPE_WEBHOOK_SECRET | — | — | — | — | — | — | — | — | — | ✅ | — |
| STRIPE_PRICE_* | — | — | — | — | — | — | — | — | — | ✅ | — |
| RESEND_API_KEY | — | — | — | — | — | — | — | — | — | ✅ | — |
| STORAGE_* | — | — | — | — | — | — | ✅ | — | — | — | — |
| FRONTEND_URL | ✅ | — | — | — | — | — | — | — | ✅ | ✅ | — |
| DOMAIN_URL | — | — | ✅ | — | — | ✅ | — | — | — | ✅ | — |
| OLLAMA_URL | — | — | — | — | — | — | — | — | — | — | ✅ |
| OLLAMA_EMBED_URL | — | — | — | — | — | — | — | — | — | — | ✅ |
| VISION_API_URL | — | — | — | — | — | — | — | — | — | — | ✅ |

---

## Apéndice C: Comandos Rápidos

```bash
# ─── Arrancar el sistema ──────────────────────────────────────────────
docker compose up -d                              # Iniciar servicios

# ─── Backend ──────────────────────────────────────────────────────────
cd backend && npm install                          # Instalar dependencias
cd backend && npm run dev                          # Modo desarrollo

# ─── Frontend ─────────────────────────────────────────────────────────
cd frontend && npm install                         # Instalar dependencias
cd frontend && npm run dev                         # Modo desarrollo

# ─── Tests ────────────────────────────────────────────────────────────
cd backend && npx jest                             # Todos los tests
cd backend && npx jest --watch                    # Watch mode
cd backend && npx jest --coverage                  # Coverage report

# ─── Base de datos ────────────────────────────────────────────────────
cd backend && node init_db.js                      # Crear schema inicial
cd backend && node seed.js                         # Poblar datos demo

# ─── Generar secretos ─────────────────────────────────────────────────
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"  # JWT_SECRET
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"  # TOKEN_ENCRYPTION_KEY
```

---

## Instrucciones Finales

1. **FASE 0 primero** — No importa cuánto quieras avanzar, sin seguridad todo lo demás es frágil.
2. **Prueba antes de pasar a la siguiente fase** — Cada fase tiene su suite de tests. Si no pasan todos (✅), no avances.
3. **148 tests totales** — Cuando todos pasen, el sistema es estable.
4. **Lo que necesito de ti** está en la **sección 15**.

¿Por dónde empezamos? Si me das los valores de `JWT_SECRET`, `ALLOWED_ORIGINS` y confirmas que el `.env` está configurado, arrancamos con FASE 0.
