# Guía Técnica de Implementaciones Pendientes

> Documento de especificación técnica para desarrollar las features faltantes del sistema, ordenadas por prioridad y dependencias. Cada sección describe qué construir, con qué tecnología, y dónde encaja en la arquitectura actual.

---

## Índice

1. [Prioridad 0 — Seguridad y Fundación](#prioridad-0--seguridad-y-fundación)
2. [Prioridad 1 — CRM de Leads](#prioridad-1--crm-de-leads)
3. [Prioridad 2 — Omnicanalidad (WhatsApp)](#prioridad-2--omnicanalidad-whatsapp)
4. [Prioridad 3 — Deuda Técnica Backend](#prioridad-3--deuda-técnica-backend)
5. [Prioridad 4 — Deuda Técnica Frontend](#prioridad-4--deuda-técnica-frontend)
6. [Prioridad 5 — Analytics Hub (M1)](#prioridad-5--analytics-hub-m1)
7. [Prioridad 6 — Content Hub (M2)](#prioridad-6--content-hub-m2)
8. [Prioridad 7 — Alertas y Notificaciones](#prioridad-7--alertas-y-notificaciones)
9. [Prioridad 8 — Onboarding de Organización](#prioridad-8--onboarding-de-organización)
10. [Prioridad 9 — Billing y Monetización](#prioridad-9--billing-y-monetización)
11. [Prioridad 10 — Features Avanzadas del Bot](#prioridad-10--features-avanzadas-del-bot)

---

## Prioridad 0 — Seguridad y Fundación

### 0.1 Sistema de Autenticación (JWT)

**Archivos a crear/modificar:**
- `backend/src/auth/auth.routes.js` — Rutas de auth
- `backend/src/auth/auth.controller.js` — Handlers
- `backend/src/auth/auth.service.js` — Lógica: register, login, refresh
- `backend/src/auth/jwt.middleware.js` — Middleware de verificación JWT
- `backend/src/auth/plan.middleware.js` — Middleware de verificación de plan
- `frontend/src/pages/Login.jsx` — Página de login
- `frontend/src/pages/Register.jsx` — Página de registro

**Tablas necesarias (nuevas):**
```sql
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    name TEXT NOT NULL,
    avatar_url TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE memberships (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id),
    organization_id UUID NOT NULL REFERENCES organizations(id),
    role TEXT NOT NULL CHECK (role IN ('owner','admin','member','viewer')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, organization_id)
);

ALTER TABLE organizations ADD COLUMN IF NOT EXISTS slug TEXT UNIQUE;
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS billing_email TEXT;
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS settings JSONB DEFAULT '{}';
```

**Especificación técnica:**
- JWT con RS256, incluir claims: `sub` (user_id), `org_id`, `role`, `plan`, `trial_ends_at`
- Refresh token en tabla `sessions` con expiración a 7 días, rotación
- Middleware `authenticate` que extrae y valida JWT del header `Authorization: Bearer {token}`
- Middleware `requireRole(...roles)` que verifica `req.user.role`
- Middleware `checkPlanLimit(metric)` que verifica contadores antes de acciones

### 0.2 Multi-tenancy Real (RLS + Middleware)

**Eliminar:** orgId hardcodeado `369344ae-f39e-4eaa-a684-4e63c5a3a48a` de `backend/index.js`

**Implementar:**
- Middleware `tenantIsolation` que lee `org_id` del JWT y lo inyecta como `current_setting('app.current_org')` en PostgreSQL
- Habilitar RLS en todas las tablas business (knowledge_chunks, messages, products, leads, etc.)
- Políticas RLS: `USING (organization_id = current_setting('app.current_org')::uuid)`

### 0.3 Webhook Security

- Implementar HMAC verification para Meta webhooks (Facebook/Instagram/WhatsApp)
- Implementar Stripe webhook signature verification
- Añadir rate limiting (express-rate-limit) en endpoints públicos
- CORS restrictivo: solo orígenes permitidos por env var

---

## Prioridad 1 — CRM de Leads

### 1.1 Tabla Independiente de Leads

**Archivo nuevo:** `backend/src/leads/leads.schema.sql`

```sql
CREATE TABLE leads (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id),
    platform TEXT NOT NULL,
    platform_user_id TEXT,
    display_name TEXT,
    phone TEXT,
    email TEXT,
    avatar_url TEXT,
    status TEXT NOT NULL DEFAULT 'cold' CHECK (status IN ('cold','warm','hot','converted','lost')),
    intent_score INTEGER DEFAULT 0,
    captured_data JSONB DEFAULT '{}',
    first_contact_source TEXT,
    first_contact_at TIMESTAMPTZ DEFAULT NOW(),
    last_activity_at TIMESTAMPTZ DEFAULT NOW(),
    converted_at TIMESTAMPTZ,
    conversion_value DECIMAL(10,2),
    notes TEXT,
    assigned_to_user_id UUID REFERENCES users(id),
    deleted_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_leads_org_status ON leads(organization_id, status);
CREATE INDEX idx_leads_org_score ON leads(organization_id, intent_score DESC);
CREATE INDEX idx_leads_org_activity ON leads(organization_id, last_activity_at DESC);
```

### 1.2 Upsert Automático desde Messages

**Modificar:** `backend/logic.js` — En `processBotResponse`, después de guardar el mensaje:

```javascript
// Si intent_score >= umbral (configurable, default 50), upsert en leads
if (result.intent_score >= 50) {
    await upsertLead(orgId, conversationId, result.captured_data, result.intent_score);
}
```

### 1.3 API REST de Leads

| Endpoint | Método | Descripción |
|----------|--------|-------------|
| `/api/leads` | GET | Listar leads con filtros (status, score, platform, date) |
| `/api/leads/:id` | GET | Detalle del lead + historial de conversación |
| `/api/leads/:id` | PATCH | Actualizar status, notas, valor de conversión |
| `/api/leads/:id/gdpr-erase` | DELETE | Anonimizar datos personales |

### 1.4 Kanban Dashboard en Frontend

**Componentes a crear (frontend/src/components/leads/):**
- `LeadsKanban.jsx` — Vista drag & drop tipo Trello
- `LeadCard.jsx` — Card con nombre, score, plataforma, último mensaje
- `LeadDetail.jsx` — Panel lateral con detalle del lead
- `LeadFilters.jsx` — Filtros por estado, plataforma, fecha

Columnas: Frío (0-20) / Tibio (21-50) / Caliente (51-80) / Convertido (81-100) / Perdido

---

## Prioridad 2 — Omnicanalidad (WhatsApp)

### 2.1 WhatsApp Business API via Meta Webhook

**Arquitectura:**
```
Meta Cloud API Webhook → Backend (/webhooks/meta) → Normalizador → botQueue → PlatformManager.sendMessage('whatsapp', ...)
```

**Archivos a crear:**
- `backend/src/webhooks/meta.routes.js` — Endpoint POST/GET para webhook Meta
- `backend/src/webhooks/meta.service.js` — Verificación HMAC, normalización de payload
- `backend/src/webhooks/normalizer.js` — Normalizador de payloads multi-plataforma a formato interno estándar

**Payload normalizado:**
```javascript
{
    platform: 'whatsapp' | 'telegram' | 'instagram' | 'facebook',
    conversationId: string,     // platform_user_id + platform
    text: string | null,
    mediaUrl: string | null,
    mediaType: 'image' | 'audio' | 'video' | null,
    platformUserId: string,
    platformUserName: string | null,
    timestamp: number,
    raw: object                  // payload original para debugging
}
```

### 2.2 Adaptador WhatsApp en PlatformManager

**Modificar:** `backend/platforms/PlatformManager.js`

```javascript
// Registrar adaptador WhatsApp
PlatformManager.register('whatsapp', WhatsAppAdapter);

class WhatsAppAdapter {
    async sendMessage(chatId, text) {
        // Meta Cloud API: POST /v21.0/{phone_number_id}/messages
        // { messaging_product: "whatsapp", to: chatId, text: { body: text } }
    }
    
    async sendMedia(chatId, mediaUrl, type) {
        // Enviar imagen/audio/documento
    }
    
    async markAsRead(chatId) {
        // Marcar mensaje como leído
    }
}
```

### 2.3 Indicador de Origen en Sidebar

**Modificar:** `frontend/src/App.jsx` — Añadir badge con ícono de plataforma en cada thread:
- WhatsApp → verde (`<MessageCircle />`)
- Telegram → azul (`<Send />`)
- Instagram → rosa (`<Camera />`)
- Facebook → azul oscuro (`<MessageSquare />`)

---

## Prioridad 3 — Deuda Técnica Backend

### 3.1 Refactor a Arquitectura en Capas

**Estructura objetivo:**
```
backend/
├── src/
│   ├── index.js              # Entry point (Express + Socket.IO setup)
│   ├── config/
│   │   ├── db.js             # Pool de conexiones
│   │   ├── env.js            # Validación de env vars
│   │   └── redis.js          # Conexión Redis
│   ├── middleware/
│   │   ├── auth.js           # JWT verify
│   │   ├── tenant.js         # Tenant isolation
│   │   ├── plan.js           # Plan limit check
│   │   └── security.js       # Actual: sanitization + HMAC
│   ├── routes/
│   │   ├── conversations.routes.js
│   │   ├── products.routes.js
│   │   ├── leads.routes.js
│   │   ├── auth.routes.js
│   │   ├── analytics.routes.js
│   │   └── webhooks/
│   │       ├── telegram.js   # Polling mover aquí
│   │       └── meta.js
│   ├── controllers/
│   │   ├── conversation.controller.js
│   │   ├── product.controller.js
│   │   ├── lead.controller.js
│   │   └── auth.controller.js
│   ├── services/
│   │   ├── bot.service.js    # Lógica de bot (actual logic.js)
│   │   ├── rag.service.js    # RAG retrieval
│   │   ├── llm.service.js    # Llamadas a Ollama/Qwen
│   │   ├── platform.service.js # PlatformManager wrapper
│   │   └── lead.service.js   # CRM upsert y scoring
│   ├── platforms/            # Ya existe
│   ├── queues/               # Ya existe
│   └── tests/                # Ya existe
├── init_db.js                # Schema init
├── seed.js                    # Seed data
└── index.js                   # Legacy (deprecated post-refactor)
```

### 3.2 Migrar a Drizzle ORM (opcional pero recomendado)

**Beneficios:** Type safety, migraciones automáticas, query builder, RLS integrado.

### 3.3 Tests

- Cobertura mínima: 70% en servicios core
- Tests de integración para cada endpoint REST
- Tests de seguridad: inyección SQL, prompt injection, XSS
- Tests de planes: verificar que limits se aplican correctamente

---

## Prioridad 4 — Deuda Técnica Frontend

### 4.1 Migrar de App.jsx Monolítico a Componentes con Router

**Estructura objetivo:**
```
frontend/src/
├── main.jsx                   # Entry point
├── App.jsx                    # Layout + Router
├── components/
│   ├── layout/
│   │   ├── Header.jsx
│   │   ├── Sidebar.jsx
│   │   └── Layout.jsx
│   ├── dashboard/
│   │   ├── ThreadList.jsx
│   │   ├── ChatPanel.jsx
│   │   ├── IntelPanel.jsx
│   │   └── Message.jsx
│   ├── training/
│   │   ├── ProductGallery.jsx
│   │   ├── OutfitCreator.jsx
│   │   └── VisionInfo.jsx
│   ├── leads/
│   │   ├── LeadsKanban.jsx
│   │   └── LeadCard.jsx
│   └── common/
│       ├── DataField.jsx
│       ├── NavItem.jsx
│       └── LoadingSpinner.jsx
├── hooks/
│   ├── useSocket.js
│   ├── useThreads.js
│   └── useMessages.js
├── services/
│   ├── api.js                 # Axios instance + interceptors
│   └── socket.js              # Socket.IO client
├── pages/
│   ├── BotDashboard.jsx
│   ├── TrainingHub.jsx
│   ├── AnalyticsHub.jsx
│   ├── ContentHub.jsx
│   ├── LeadsPage.jsx
│   ├── Login.jsx
│   └── Register.jsx
├── store/                     # Zustand
│   ├── useAuthStore.js
│   └── useUIStore.js
├── App.css
└── index.css
```

### 4.2 Introducir React Router

```jsx
<Routes>
    <Route path="/login" element={<Login />} />
    <Route path="/register" element={<Register />} />
    <Route element={<PrivateRoute />}>
        <Route element={<AppLayout />}>
            <Route path="/" element={<Navigate to="/bot" />} />
            <Route path="/bot" element={<BotDashboard />} />
            <Route path="/training" element={<TrainingHub />} />
            <Route path="/analytics" element={<AnalyticsHub />} />
            <Route path="/content" element={<ContentHub />} />
            <Route path="/leads" element={<LeadsPage />} />
            <Route path="/settings" element={<Settings />} />
        </Route>
    </Route>
</Routes>
```

### 4.3 Estado Global con Zustand

```javascript
// store/useAuthStore.js
const useAuthStore = create((set) => ({
    user: null,
    token: null,
    org: null,
    login: async (email, password) => { ... },
    logout: () => { ... },
}));

// store/useUIStore.js
const useUIStore = create((set) => ({
    sidebarOpen: true,
    activeThread: null,
    notifications: [],
}));
```

### 4.4 Cliente API Centralizado

```javascript
// services/api.js
const api = axios.create({
    baseURL: import.meta.env.VITE_API_URL,
});

api.interceptors.request.use((config) => {
    const token = useAuthStore.getState().token;
    if (token) config.headers.Authorization = `Bearer ${token}`;
    return config;
});

api.interceptors.response.use(
    (res) => res,
    (err) => {
        if (err.response?.status === 401) {
            useAuthStore.getState().logout();
        }
        return Promise.reject(err);
    }
);
```

---

## Prioridad 5 — Analytics Hub (M1)

### 5.1 Tablas Nuevas

```sql
CREATE TABLE social_connections (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id),
    platform TEXT NOT NULL CHECK (platform IN ('facebook','instagram','tiktok','linkedin')),
    platform_account_id TEXT NOT NULL,
    username TEXT NOT NULL,
    access_token_encrypted TEXT NOT NULL,
    refresh_token_encrypted TEXT,
    token_expires_at TIMESTAMPTZ,
    last_synced_at TIMESTAMPTZ,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(organization_id, platform_account_id)
);

CREATE TABLE account_metrics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    connection_id UUID NOT NULL REFERENCES social_connections(id),
    metric_date DATE NOT NULL,
    followers INTEGER,
    followers_delta INTEGER,
    total_reach INTEGER,
    total_impressions INTEGER,
    avg_engagement_rate DECIMAL(5,2),
    total_spend DECIMAL(10,2),
    total_conversions INTEGER,
    total_leads INTEGER,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(connection_id, metric_date)
);

CREATE TABLE post_metrics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    connection_id UUID NOT NULL REFERENCES social_connections(id),
    platform_post_id TEXT NOT NULL,
    caption TEXT,
    post_type TEXT,
    posted_at TIMESTAMPTZ,
    impressions INTEGER,
    reach INTEGER,
    likes INTEGER,
    comments INTEGER,
    shares INTEGER,
    saves INTEGER,
    engagement_rate DECIMAL(5,2),
    video_completion_rate DECIMAL(5,2),
    clicks INTEGER,
    spend DECIMAL(10,2),
    conversions INTEGER,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(connection_id, platform_post_id)
);
```

### 5.2 Jobs de Sincronización

**Archivo nuevo:** `backend/src/jobs/syncSocialMetrics.js`

```javascript
// Job recurrente: cada 4h para orgs activas con canales conectados
// 1. Fetch de account_metrics y post_metrics via Meta/TikTok/LinkedIn APIs
// 2. Upsert en DB
// 3. Invalidar caché Redis
// 4. Actualizar last_synced_at
```

### 5.3 Endpoints REST

| Endpoint | Método | Descripción |
|----------|--------|-------------|
| `/api/analytics/overview` | GET | KPIs agregados del período |
| `/api/analytics/channels` | GET | Métricas por canal |
| `/api/analytics/posts` | GET | Métricas por publicación |
| `/api/analytics/export?format=pdf\|xlsx` | GET | Exportar reporte |

### 5.4 Frontend — Dashboard Analítico

**Componentes:**
- `KpiCards.jsx` — 4 tarjetas: Alcance, Engagement, Leads, CPL
- `TrendChart.jsx` — Gráfica de evolución temporal (Recharts/Chart.js)
- `TopPostsTable.jsx` — Tabla top posts por engagement
- `ChannelBreakdown.jsx` — Desglose por canal
- `DateRangePicker.jsx` — Selector de período
- `ExportButton.jsx` — Botón de exportación PDF/Excel

---

## Prioridad 6 — Content Hub (M2)

### 6.1 Tablas Nuevas

```sql
CREATE TABLE assets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id),
    original_filename TEXT NOT NULL,
    mime_type TEXT NOT NULL,
    file_size_bytes INTEGER NOT NULL,
    storage_key TEXT NOT NULL,
    width INTEGER,
    height INTEGER,
    alt_text TEXT,
    tags TEXT[],
    uploaded_by UUID REFERENCES users(id),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE post_assets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    post_id UUID NOT NULL REFERENCES posts(id),
    asset_id UUID NOT NULL REFERENCES assets(id),
    variant_platform TEXT,
    variant_format TEXT,
    variant_storage_key TEXT NOT NULL,
    width INTEGER,
    height INTEGER,
    file_size_kb DECIMAL(10,2)
);

CREATE TABLE posts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id),
    status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','scheduled','publishing','published','failed','cancelled')),
    caption_template TEXT,
    platform_captions JSONB DEFAULT '{}',
    platform_hashtags JSONB DEFAULT '{}',
    scheduled_at TIMESTAMPTZ,
    published_at TIMESTAMPTZ,
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE post_accounts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    post_id UUID NOT NULL REFERENCES posts(id),
    connection_id UUID NOT NULL REFERENCES social_connections(id),
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','publishing','published','failed','skipped')),
    platform_post_id TEXT,
    error_message TEXT,
    retry_count INTEGER DEFAULT 0,
    published_at TIMESTAMPTZ
);
```

### 6.2 Pipeline de Procesamiento de Assets

**Job:** `process_asset` — se dispara inmediatamente al upload

1. Validar mime type y dimensiones
2. Generar variantes con Sharp:
   - IG Feed 1:1 (1080×1080)
   - IG Stories 9:16 (1080×1920)
   - FB Feed 1.91:1 (1200×630)
   - LinkedIn Feed 1.91:1 (1200×627)
3. Subir variantes a storage (S3/R2 compatible)
4. Notificar frontend via Socket.IO

### 6.3 Scheduler de Publicaciones

**Job:** `publish_post` — se ejecuta en `scheduled_at`

1. Obtener post con variantes y cuentas destino
2. Publicar vía API de cada plataforma
3. Actualizar estado y manejar reintentos (máx 3, backoff exponencial)
4. Alerta si falla después de reintentos

### 6.4 Frontend

**Páginas/Componentes:**
- `ContentHub.jsx` — Calendario de contenido (vista mensual)
- `NewPost.jsx` — Upload zone + grid de variantes + captions + scheduling
- `AssetLibrary.jsx` — Grid con filtros y búsqueda
- `PostCard.jsx` — Card con estado y metadatos
- `SchedulePicker.jsx` — Date-time picker para programar

---

## Prioridad 7 — Alertas y Notificaciones

### 7.1 Tabla de Alertas

```sql
CREATE TABLE alerts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id),
    type TEXT NOT NULL CHECK (type IN ('token_expiring','hot_lead','post_failed','engagement_drop','plan_limit_near','sync_error','payment_failed','bot_escalated')),
    severity TEXT NOT NULL CHECK (severity IN ('info','warning','error')),
    title TEXT NOT NULL,
    message TEXT,
    context_data JSONB DEFAULT '{}',
    is_read BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_alerts_org_unread ON alerts(organization_id, is_read, created_at DESC);
```

### 7.2 Disparadores de Alertas

| Alerta | Trigger | Dónde implementar |
|--------|---------|-------------------|
| `hot_lead` | intent_score >= threshold (default 70) | `lead.service.js` — después de upsert |
| `token_expiring` | token_expires_at < NOW() + 7 días | Job diario de revisión |
| `post_failed` | post_accounts.status = 'failed' tras 3 retries | `publish_post` job |
| `engagement_drop` | Engagement 7d < 50% del mes anterior | Job semanal de análisis |
| `sync_error` | Sync falla 2 veces consecutivas | `syncSocialMetrics` job |
| `payment_failed` | invoice.payment_failed | Webhook Stripe |
| `bot_escalated` | Bot hace handoff a humano | `processBotResponse` |

### 7.3 Notificaciones en Tiempo Real

**Socket.IO events a implementar:**
```javascript
socket.emit('alert:new', { alertId, type, severity, title });
socket.emit('lead:hot', { leadId, score, name });
socket.emit('post:failed', { postId, platform, error });
```

### 7.4 Endpoints REST

| Endpoint | Método | Descripción |
|----------|--------|-------------|
| `/api/alerts` | GET | Listar alertas (no leídas primero) |
| `/api/alerts/:id/read` | PATCH | Marcar como leída |
| `/api/alerts/read-all` | POST | Marcar todas como leídas |

---

## Prioridad 8 — Onboarding de Organización

### 8.1 Flujo de 4 Pasos

**Paso 1 — Crear organización:**
- Formulario: nombre del negocio, industria (select), zona horaria
- Crear `organizations` + `membership` con role `owner`
- Iniciar trial de 14 días
- Slug generado automáticamente

**Paso 2 — Conectar red social:**
- OAuth popup para Facebook/Instagram (por ahora)
- Guardar token cifrado en `social_connections`
- Disparar primer sync de métricas

**Paso 3 — Subir knowledge base:**
- Drag & drop: CSV, PDF, o texto libre
- Chunking automático → embeddings → `knowledge_chunks`
- Feedback visual del progreso

**Paso 4 — Activar bot:**
- Seleccionar canales donde responderá
- Configurar tono (formal/amigable/casual/profesional)
- Definir mensaje de escalado

### 8.2 Componentes Frontend

- `OnboardingWizard.jsx` — Contenedor del flujo multi-paso
- `StepOrgCreate.jsx` — Paso 1
- `StepConnectChannel.jsx` — Paso 2 (OAuth popup)
- `StepUploadKnowledge.jsx` — Paso 3 (file upload + progress)
- `StepActivateBot.jsx` — Paso 4 (configuración)
- `ProgressBar.jsx` — Indicador de progreso (25/50/75/100%)

---

## Prioridad 9 — Billing y Monetización

Ver documento específico: `CONTEXTO_TECNICO_BILLING.md`

**Resumen de implementación:**
1. Tablas: `subscriptions`, `billing_events`, `usage_counters`
2. Webhook Stripe: verificación HMAC + 6 event handlers
3. API: `POST /billing/subscribe`, `PATCH /billing/subscription`, `GET /billing/portal`
4. Stripe Customer Portal para autogestión
5. Plan limiter middleware en endpoints protegidos
6. Emails transaccionales para los 7 triggers de billing

---

## Prioridad 10 — Features Avanzadas del Bot

### 10.1 State Machine Flow

Reemplazar el prompt único actual por un sistema de estados:

```
Estado: SALUDO
  → Bot saluda y cualifica (nombre, qué busca)
  → Transición a: DESCUBRIMIENTO

Estado: DESCUBRIMIENTO
  → RAG enfocado en catálogo
  → Muestra productos relevantes
  → Transición a: CIERRE si hay intención de compra

Estado: CIERRE
  → RAG enfocado en políticas de venta, pagos, envío
  → Puede llamar a función crear_cita() o confirmar_pedido()
```

### 10.2 Function Calling

Permitir que el LLM invoque funciones específicas del backend:

```javascript
const functions = {
    crear_cita: async ({ fecha, hora, servicio }) => {
        // Crear evento en DB
        return { success: true, cita_id: '...' };
    },
    guardar_lead: async ({ nombre, telefono, interes }) => {
        // Upsert en tabla leads
        return { success: true };
    },
    consultar_stock: async ({ producto_id }) => {
        // Query a products
        return { disponible: true, cantidad: 5 };
    }
};
```

### 10.3 Pipeline de Upload de Knowledge Base

**Archivo nuevo:** `backend/src/services/knowledge.service.js`

```javascript
// Upload CSV
async function processCSV(buffer, orgId) {
    const records = await parseCSV(buffer);
    const chunks = records.map(row => formatearChunk(row));
    const embeddings = await generarEmbeddings(chunks);
    await storeChunks(orgId, chunks, embeddings);
}

// Upload PDF
async function processPDF(buffer, orgId) {
    const text = await extractTextFromPDF(buffer);
    const chunks = splitIntoChunks(text, { maxTokens: 500, overlap: 50 });
    const embeddings = await generarEmbeddings(chunks);
    await storeChunks(orgId, chunks, embeddings);
}
```

### 10.4 Métricas del Bot

| Métrica | Objetivo | Cómo medir |
|---------|----------|------------|
| Tiempo primera respuesta | < 60s | Diferencia entre created_at del user msg y del assistant msg |
| Tasa resolución sin humano | > 60% | Conversaciones sin handoff / total |
| Latencia RAG | < 50ms | Query performance pgvector |
| Latencia total (RAG+LLM+envío) | < 8s | Tiempo total del worker |
| Tasa de leads calificados (warm+) | > 20% | Leads con score > 20 / total leads |
| Tasa de conversión | > 5% | Leads converted / total leads |

---

## Resumen de Archivos a Crear/Modificar

| Prioridad | Archivos nuevos | Archivos a modificar |
|-----------|----------------|---------------------|
| P0 — Seguridad | ~10 | `backend/index.js`, `backend/db_init.sql` |
| P1 — Leads CRM | ~8 | `backend/logic.js`, `backend/index.js` |
| P2 — WhatsApp | ~5 | `backend/platforms/PlatformManager.js` |
| P3 — Refactor Backend | ~25 | `backend/*` (reestructurar) |
| P4 — Refactor Frontend | ~25 | `frontend/src/App.jsx` (dividir) |
| P5 — Analytics Hub | ~15 | `backend/index.js`, `backend/db_init.sql` |
| P6 — Content Hub | ~15 | `backend/index.js`, `backend/db_init.sql` |
| P7 — Alertas | ~5 | `backend/index.js`, `backend/db_init.sql` |
| P8 — Onboarding | ~8 | `frontend/src/App.jsx` |
| P9 — Billing | ~8 | `backend/index.js`, `backend/db_init.sql` |
| P10 — Bot Avanzado | ~5 | `backend/logic.js` |

**Total estimado: ~130 archivos nuevos, ~15 archivos modificados.**
