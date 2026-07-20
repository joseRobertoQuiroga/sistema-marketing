# Guía Técnica de Producción — OmniPresence Suite

> **Arquitectura Hexagonal + SOLID + OOP**
> Documento canónico para entender, mantener y escalar el sistema.

---

## Índice

1. [Estructura del Proyecto (Hexagonal)](#1-estructura-del-proyecto-hexagonal)
2. [Backend — Capas y Componentes](#2-backend--capas-y-componentes)
3. [Frontend — Arquitectura de Componentes](#3-frontend--arquitectura-de-componentes)
4. [Base de Datos — Esquema Completo](#4-base-de-datos--esquema-completo)
5. [Infraestructura — Docker y DevOps](#5-infraestructura--docker-y-devops)
6. [Autenticación y Seguridad](#6-autenticación-y-seguridad)
7. [Pipeline del Bot IA](#7-pipeline-del-bot-ia)
8. [API REST — Contratos](#8-api-rest--contratos)
9. [Pruebas — Estrategia y Cobertura](#9-pruebas--estrategia-y-cobertura)
10. [Guía de Despliegue a Producción](#10-guía-de-despliegue-a-producción)

---

## 1. Estructura del Proyecto (Hexagonal)

```
sistema-marketing/
├── backend/                          # Backend — Arquitectura Hexagonal
│   ├── src/
│   │   ├── domain/                   # ███ DOMAIN LAYER ███ (Núcleo puro)
│   │   │   ├── entities/             #   Entidades de negocio
│   │   │   │   ├── Organization.js
│   │   │   │   ├── User.js
│   │   │   │   ├── Lead.js
│   │   │   │   ├── Conversation.js
│   │   │   │   └── Product.js
│   │   │   ├── value-objects/        #   Value Objects inmutables
│   │   │   │   ├── Email.js
│   │   │   │   ├── Phone.js
│   │   │   │   ├── IntentScore.js
│   │   │   │   └── Money.js
│   │   │   ├── ports/                #   Interfaces (Puertos)
│   │   │   │   ├── in/               #     Puertos de entrada
│   │   │   │   │   ├── IAuthService.js
│   │   │   │   │   ├── IBotService.js
│   │   │   │   │   ├── ILeadService.js
│   │   │   │   │   └── IAnalyticsService.js
│   │   │   │   └── out/              #     Puertos de salida
│   │   │   │       ├── IUserRepository.js
│   │   │   │       ├── IOrganizationRepository.js
│   │   │   │       ├── IMessageRepository.js
│   │   │   │       ├── ILeadRepository.js
│   │   │   │       ├── IKnowledgeRepository.js
│   │   │   │       ├── IPlatformAdapter.js
│   │   │   │       └── ILLMService.js
│   │   │   └── services/             #   Servicios de dominio (puros)
│   │   │       ├── ScoringService.js
│   │   │       ├── BotStateMachine.js
│   │   │       └── LeadScoringService.js
│   │   │
│   │   ├── application/              # ███ APPLICATION LAYER ███
│   │   │   ├── use-cases/            #   Casos de uso (orquestación)
│   │   │   │   ├── auth/
│   │   │   │   │   ├── RegisterUserUseCase.js
│   │   │   │   │   ├── LoginUserUseCase.js
│   │   │   │   │   └── RefreshSessionUseCase.js
│   │   │   │   ├── bot/
│   │   │   │   │   ├── ProcessMessageUseCase.js
│   │   │   │   │   ├── HandoffConversationUseCase.js
│   │   │   │   │   └── UploadKnowledgeUseCase.js
│   │   │   │   ├── leads/
│   │   │   │   │   ├── UpsertLeadUseCase.js
│   │   │   │   │   └── UpdateLeadStatusUseCase.js
│   │   │   │   └── billing/
│   │   │   │       ├── SubscribeUseCase.js
│   │   │   │       └── ChangePlanUseCase.js
│   │   │   └── dto/                  #   Data Transfer Objects
│   │   │       ├── AuthDTO.js
│   │   │       ├── MessageDTO.js
│   │   │       └── LeadDTO.js
│   │   │
│   │   ├── infrastructure/           # ███ INFRASTRUCTURE LAYER ███
│   │   │   ├── persistence/          #   Implementaciones de repositorios
│   │   │   │   ├── repositories/
│   │   │   │   │   ├── PostgresUserRepository.js
│   │   │   │   │   ├── PostgresOrganizationRepository.js
│   │   │   │   │   ├── PostgresLeadRepository.js
│   │   │   │   │   ├── PostgresMessageRepository.js
│   │   │   │   │   └── PostgresKnowledgeRepository.js
│   │   │   │   ├── migrations/       #   Migraciones SQL
│   │   │   │   │   ├── 001_users_sessions.sql
│   │   │   │   │   ├── 002_organizations_extend.sql
│   │   │   │   │   ├── 003_rls_enable.sql
│   │   │   │   │   ├── 004_leads.sql
│   │   │   │   │   └── 005_billing.sql
│   │   │   │   └── db.js             #   Pool de conexiones
│   │   │   ├── cache/                #   Redis
│   │   │   │   ├── redis.js
│   │   │   │   └── BotResponseCache.js
│   │   │   ├── queue/                #   BullMQ
│   │   │   │   ├── botQueue.js
│   │   │   │   ├── botWorker.js
│   │   │   │   ├── emailQueue.js
│   │   │   │   └── analyticsQueue.js
│   │   │   ├── ai/                   #   Adaptadores IA
│   │   │   │   ├── OllamaAdapter.js
│   │   │   │   ├── WhisperAdapter.js
│   │   │   │   └── QwenVLAdapter.js
│   │   │   ├── platforms/            #   Adaptadores de plataforma
│   │   │   │   ├── PlatformManager.js
│   │   │   │   ├── TelegramAdapter.js
│   │   │   │   ├── WhatsAppAdapter.js
│   │   │   │   └── InstagramAdapter.js
│   │   │   ├── webhooks/             #   Manejadores de webhooks
│   │   │   │   ├── stripeWebhook.js
│   │   │   │   └── metaWebhook.js
│   │   │   ├── email/                #   Emails transaccionales
│   │   │   │   └── ResendAdapter.js
│   │   │   └── storage/              #   Asset storage
│   │   │       └── S3StorageAdapter.js
│   │   │
│   │   ├── api/                      # ███ API LAYER (Controllers) ███
│   │   │   ├── routes/
│   │   │   │   ├── index.js          #   Assembly de rutas
│   │   │   │   ├── auth.routes.js
│   │   │   │   ├── conversations.routes.js
│   │   │   │   ├── leads.routes.js
│   │   │   │   ├── products.routes.js
│   │   │   │   ├── analytics.routes.js
│   │   │   │   ├── content.routes.js
│   │   │   │   ├── billing.routes.js
│   │   │   │   └── alerts.routes.js
│   │   │   ├── controllers/
│   │   │   │   ├── auth.controller.js
│   │   │   │   ├── conversation.controller.js
│   │   │   │   ├── lead.controller.js
│   │   │   │   └── product.controller.js
│   │   │   ├── middleware/
│   │   │   │   ├── auth.js           #   JWT verification
│   │   │   │   ├── tenant.js         #   Tenant isolation
│   │   │   │   ├── planLimiter.js    #   Plan quota check
│   │   │   │   ├── security.js       #   Sanitization + HMAC
│   │   │   │   └── errorHandler.js   #   Error handling
│   │   │   └── validators/           #   Request validation (Zod)
│   │   │       ├── auth.validator.js
│   │   │       ├── lead.validator.js
│   │   │       └── message.validator.js
│   │   │
│   │   ├── config/
│   │   │   ├── env.js
│   │   │   └── di.js                 #   Dependency Injection container
│   │   │
│   │   └── server.js                 #   Entry point (Express setup)
│   │
│   ├── tests/
│   │   ├── unit/                     #   Pruebas unitarias por capa
│   │   │   ├── domain/
│   │   │   ├── application/
│   │   │   └── infrastructure/
│   │   ├── integration/              #   Pruebas de integración
│   │   ├── e2e/                      #   End-to-end tests
│   │   └── fixtures/                 #   Mocks y datos de prueba
│   │
│   ├── index.js                      #   Legacy (punto de entrada actual)
│   ├── logic.js                      #   Legacy (será refactorizado)
│   ├── init_db.js
│   ├── seed.js
│   ├── package.json
│   ├── Dockerfile
│   └── .env
│
├── frontend/                         # Frontend — React + Vite
│   ├── src/
│   │   ├── App.jsx                   #   Entry point con Router
│   │   ├── main.jsx
│   │   ├── index.css
│   │   ├── components/               #   Componentes UI
│   │   │   ├── layout/
│   │   │   │   ├── AppLayout.jsx
│   │   │   │   ├── Header.jsx
│   │   │   │   └── Sidebar.jsx
│   │   │   ├── dashboard/            #   Bot Dashboard
│   │   │   │   ├── ThreadList.jsx
│   │   │   │   ├── ChatPanel.jsx
│   │   │   │   ├── IntelPanel.jsx
│   │   │   │   └── Message.jsx
│   │   │   ├── training/
│   │   │   │   ├── ProductGallery.jsx
│   │   │   │   └── OutfitCreator.jsx
│   │   │   ├── leads/                #   CRM Leads
│   │   │   │   ├── LeadsKanban.jsx
│   │   │   │   ├── LeadCard.jsx
│   │   │   │   └── LeadDetail.jsx
│   │   │   ├── analytics/            #   Analytics Hub
│   │   │   │   ├── KpiCards.jsx
│   │   │   │   └── TrendChart.jsx
│   │   │   ├── content/              #   Content Hub
│   │   │   │   ├── Calendar.jsx
│   │   │   │   └── AssetLibrary.jsx
│   │   │   ├── billing/              #   Billing
│   │   │   │   └── PlanCard.jsx
│   │   │   └── common/
│   │   │       ├── Button.jsx
│   │   │       ├── Input.jsx
│   │   │       └── LoadingSpinner.jsx
│   │   ├── pages/
│   │   │   ├── Login.jsx
│   │   │   ├── Register.jsx
│   │   │   ├── BotDashboard.jsx
│   │   │   ├── TrainingHub.jsx
│   │   │   ├── AnalyticsHub.jsx
│   │   │   ├── ContentHub.jsx
│   │   │   ├── LeadsPage.jsx
│   │   │   ├── Settings.jsx
│   │   │   └── Onboarding.jsx
│   │   ├── hooks/
│   │   │   ├── useSocket.js
│   │   │   ├── useAuth.js
│   │   │   └── useApi.js
│   │   ├── services/
│   │   │   ├── api.js                #   Axios instance + interceptors
│   │   │   └── socket.js
│   │   └── store/
│   │       ├── useAuthStore.js       #   Zustand auth store
│   │       └── useUIStore.js         #   Zustand UI store
│   │
│   ├── public/
│   ├── package.json
│   ├── vite.config.js
│   ├── Dockerfile
│   └── index.html
│
├── docs/
│   ├── VISION_PROYECTO.md            #   Visión y objetivos del proyecto
│   ├── GUIA_TECNICA_PRODUCCION.md    #   Este documento
│   ├── API_REFERENCE.md              #   Referencia completa de API
│   ├── DB_SCHEMA.md                  #   Esquema de base de datos
│   └── legacy/                       #   Documentación original preservada
│
├── mockups/                          #   Mockups HTML de UI
├── docker-compose.yml
└── .gitignore
```

---

## 2. Backend — Capas y Componentes

### 2.1 Domain Layer (Núcleo)

Contiene la lógica de negocio pura, sin dependencias externas.

**Principios:**
- Zero dependencias de frameworks (Express, etc.)
- Zero dependencias de infraestructura (DB, cache, APIs)
- Solo JavaScript/TypeScript puro
- Testeable sin mocks

**Ejemplo — Entidad Lead:**
```javascript
// domain/entities/Lead.js
class Lead {
    constructor({ id, orgId, platform, platformUserId, displayName, status, intentScore, capturedData }) {
        this.id = id;
        this.orgId = orgId;
        this.platform = platform;
        this.platformUserId = platformUserId;
        this.displayName = displayName;
        this.status = status;        // cold | warm | hot | converted | lost
        this.intentScore = intentScore;
        this.capturedData = capturedData;
    }

    static scoreToStatus(score) {
        if (score >= 71) return 'hot';
        if (score >= 21) return 'warm';
        return 'cold';
    }

    canUpsert(newScore) {
        if (this.status === 'converted' || this.status === 'lost') return false;
        return newScore > this.intentScore;
    }
}
```

**Ejemplo — Value Object Email:**
```javascript
// domain/value-objects/Email.js
class Email {
    constructor(value) {
        if (!value || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
            throw new Error('Invalid email address');
        }
        this.value = value.toLowerCase();
        Object.freeze(this);
    }
}
```

**Ejemplo — Puerto de Salida:**
```javascript
// domain/ports/out/ILeadRepository.js
class ILeadRepository {
    async findByOrgAndPlatformUserId(orgId, platformUserId) { throw new Error('Not implemented'); }
    async upsert(lead) { throw new Error('Not implemented'); }
    async findByOrg(orgId, filters) { throw new Error('Not implemented'); }
    async updateStatus(leadId, status) { throw new Error('Not implemented'); }
}
```

### 2.2 Application Layer (Casos de Uso)

Orquesta el flujo entre el dominio y la infraestructura.

**Ejemplo — UpsertLeadUseCase:**
```javascript
class UpsertLeadUseCase {
    constructor(leadRepository, alertService) {
        this.leadRepository = leadRepository;
        this.alertService = alertService;
    }

    async execute({ orgId, conversationId, capturedData, intentScore }) {
        const platformUserId = conversationId;
        let lead = await this.leadRepository.findByOrgAndPlatformUserId(orgId, platformUserId);

        if (!lead) {
            lead = new Lead({
                id: crypto.randomUUID(),
                orgId,
                platform: capturedData.platform || 'telegram',
                platformUserId,
                displayName: capturedData.nombre || 'Usuario',
                status: Lead.scoreToStatus(intentScore),
                intentScore,
                capturedData,
            });
        } else if (!lead.canUpsert(intentScore)) {
            return lead;
        } else {
            lead.intentScore = intentScore;
            lead.status = Lead.scoreToStatus(intentScore);
            lead.capturedData = { ...lead.capturedData, ...capturedData };
        }

        await this.leadRepository.upsert(lead);

        if (lead.status === 'hot') {
            await this.alertService.createAlert(orgId, 'hot_lead', {
                title: 'Lead caliente',
                message: `${lead.displayName} (score: ${lead.intentScore})`,
            });
        }

        return lead;
    }
}
```

### 2.3 Infrastructure Layer

Implementaciones concretas de los puertos definidos en domain.

**Ejemplo — PostgresLeadRepository:**
```javascript
class PostgresLeadRepository extends ILeadRepository {
    constructor(pool) {
        super();
        this.pool = pool;
    }

    async upsert(lead) {
        const result = await this.pool.query(`
            INSERT INTO leads (organization_id, platform, platform_user_id, display_name, status, intent_score, captured_data)
            VALUES ($1, $2, $3, $4, $5, $6, $7)
            ON CONFLICT (organization_id, platform_user_id)
            DO UPDATE SET
                intent_score = GREATEST(leads.intent_score, EXCLUDED.intent_score),
                status = CASE
                    WHEN leads.status IN ('converted', 'lost') THEN leads.status
                    ELSE EXCLUDED.status
                END,
                captured_data = leads.captured_data || EXCLUDED.captured_data,
                last_activity_at = NOW()
            RETURNING *
        `, [lead.orgId, lead.platform, lead.platformUserId, lead.displayName, lead.status, lead.intentScore, JSON.stringify(lead.capturedData)]);
        return Lead.fromDB(result.rows[0]);
    }
}
```

### 2.4 API Layer (Controllers)

Capa delgada que solo maneja HTTP request/response.

```javascript
class LeadController {
    constructor(upsertLeadUseCase, listLeadsUseCase) {
        this.upsertLeadUseCase = upsertLeadUseCase;
        this.listLeadsUseCase = listLeadsUseCase;
    }

    async list(req, res) {
        const { status, platform, page = 1, limit = 20 } = req.query;
        const leads = await this.listLeadsUseCase.execute({
            orgId: req.user.orgId,
            filters: { status, platform },
            pagination: { page: Number(page), limit: Number(limit) },
        });
        res.json(leads);
    }

    async updateStatus(req, res) {
        const { id } = req.params;
        const { status, notes, conversionValue } = req.body;
        const lead = await this.updateLeadStatusUseCase.execute({ id, orgId: req.user.orgId, status, notes, conversionValue });
        res.json(lead);
    }
}
```

---

## 3. Frontend — Arquitectura de Componentes

### 3.1 Estructura de Estado (Zustand)

```javascript
// store/useAuthStore.js
const useAuthStore = create((set) => ({
    user: null,
    org: null,
    accessToken: null,
    refreshToken: null,
    isAuthenticated: false,

    login: async (email, password) => {
        const res = await api.post('/auth/login', { email, password });
        set({
            user: res.data.user,
            org: res.data.org,
            accessToken: res.data.accessToken,
            refreshToken: res.data.refreshToken,
            isAuthenticated: true,
        });
        localStorage.setItem('refreshToken', res.data.refreshToken);
    },

    logout: () => {
        set({ user: null, org: null, accessToken: null, refreshToken: null, isAuthenticated: false });
        localStorage.removeItem('refreshToken');
    },
}));
```

### 3.2 Árbol de Rutas (React Router v7)

```jsx
<Routes>
    <Route path="/login" element={<Login />} />
    <Route path="/register" element={<Register />} />
    <Route element={<ProtectedRoute />}>
        <Route element={<AppLayout />}>
            <Route index element={<Navigate to="/bot" />} />
            <Route path="/bot" element={<BotDashboard />} />
            <Route path="/training" element={<TrainingHub />} />
            <Route path="/analytics" element={<AnalyticsHub />} />
            <Route path="/content" element={<ContentHub />} />
            <Route path="/leads" element={<LeadsPage />} />
            <Route path="/settings" element={<Settings />} />
            <Route path="/onboarding" element={<Onboarding />} />
        </Route>
    </Route>
</Routes>
```

### 3.3 Cliente API Centralizado

```javascript
const api = axios.create({ baseURL: import.meta.env.VITE_API_URL });

api.interceptors.request.use((config) => {
    const token = useAuthStore.getState().accessToken;
    if (token) config.headers.Authorization = `Bearer ${token}`;
    return config;
});

api.interceptors.response.use(
    (res) => res,
    async (err) => {
        if (err.response?.status === 401) {
            const refreshToken = localStorage.getItem('refreshToken');
            if (refreshToken) {
                try {
                    const res = await axios.post(`${import.meta.env.VITE_API_URL}/auth/refresh`, { refreshToken });
                    useAuthStore.getState().setTokens(res.data.accessToken, res.data.refreshToken);
                    err.config.headers.Authorization = `Bearer ${res.data.accessToken}`;
                    return api(err.config);
                } catch {
                    useAuthStore.getState().logout();
                    window.location.href = '/login';
                }
            } else {
                useAuthStore.getState().logout();
                window.location.href = '/login';
            }
        }
        return Promise.reject(err);
    }
);
```

---

## 4. Base de Datos — Esquema Completo

### 4.1 Tablas Core (Multi-tenant con RLS)

| Tabla | Propósito | RLS |
|-------|-----------|-----|
| `organizations` | Tenants / organizaciones | No (tabla padre) |
| `users` | Usuarios del sistema | No |
| `memberships` | Relación user ↔ org con rol | Sí |
| `sessions` | Sesiones JWT refresh | No |

### 4.2 Tablas de Negocio (Con RLS)

| Tabla | Propósito | RLS |
|-------|-----------|-----|
| `knowledge_chunks` | Base de conocimiento vectorial | Sí |
| `products` | Catálogo de productos | Sí |
| `product_sets` | Conjuntos/Outfits | Sí |
| `product_set_items` | Relación conjunto ↔ producto | Sí |
| `messages` | Historial de conversaciones | Sí |
| `bot_configs` | Configuración del bot por org | Sí |
| `leads` | CRM de leads | Sí |
| `alerts` | Alertas y notificaciones | Sí |
| `social_connections` | Conexiones OAuth a redes | Sí |
| `account_metrics` | Métricas de redes sociales | Sí |
| `post_metrics` | Métricas por publicación | Sí |
| `assets` | Assets subidos (imágenes) | Sí |
| `posts` | Publicaciones programadas | Sí |
| `post_assets` | Variantes de assets por post | Sí |
| `post_accounts` | Estado por plataforma | Sí |

### 4.3 Tablas de Billing (Sin RLS explícito)

| Tabla | Propósito |
|-------|-----------|
| `subscriptions` | Suscripciones Stripe |
| `billing_events` | Log de eventos de Stripe |
| `usage_counters` | Contadores de uso mensual |

### 4.4 Política RLS Estándar

```sql
ALTER TABLE <tabla> ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON <tabla>
    USING (organization_id = current_setting('app.current_org')::uuid);
```

---

## 5. Infraestructura — Docker y DevOps

### 5.1 Servicios (docker-compose.yml)

| Servicio | Imagen | Puerto |
|----------|--------|--------|
| `db` | ankane/pgvector | 5432 |
| `redis` | redis:alpine | 6379 |
| `backend` | node:20 (custom) | 3000 |
| `frontend` | node:20 (custom) | 5173 |

### 5.2 Variables de Entorno Críticas

```env
# Seguridad (FASE 0)
JWT_SECRET=<64+ chars hex>
TOKEN_ENCRYPTION_KEY=<32 bytes hex>
ALLOWED_ORIGINS=http://localhost:5173,https://app.omnipresence.io

# IA Local
OLLAMA_URL=http://localhost:11434/api/generate
OLLAMA_EMBED_URL=http://localhost:11434/api/embeddings

# IA Cloud
VISION_API_URL=http://<gpu-instance>:8000/v1/chat/completions

# Plataformas
TELEGRAM_TOKEN=<from @BotFather>
META_APP_ID=<from Facebook Developers>
META_APP_SECRET=<from Facebook Developers>
WHATSAPP_PHONE_NUMBER_ID=<from Meta Business>

# Stripe
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_PRICE_PRO_MONTHLY=price_...
STRIPE_PRICE_BUSINESS_MONTHLY=price_...
STRIPE_PRICE_AGENCY_MONTHLY=price_...

# Email
RESEND_API_KEY=re_...
```

### 5.3 Pipeline CI/CD (GitHub Actions)

```yaml
# .github/workflows/deploy.yml
name: Deploy
on: push to main
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: cd backend && npm ci && npx jest --coverage
      - run: cd frontend && npm ci && npm run build
  deploy:
    needs: test
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: docker compose -f docker-compose.prod.yml up -d --build
```

---

## 6. Autenticación y Seguridad

### 6.1 Flujo de Tokens

```
REGISTER / LOGIN
  → Server genera:
    → Access Token (JWT, 15 min, en memoria)
    → Refresh Token (opaco, 64 bytes, 7 días, httpOnly cookie)
  → Refresh Token guardado en DB (SHA-256 hash)

CADA REQUEST
  → Middleware extrae JWT de Authorization: Bearer <token>
  → Verify signature + expiry
  → Inyecta req.user = { id, orgId, role, plan }

REFRESH
  → Frontend detecta 401 → POST /auth/refresh con cookie
  → Server invalida refresh anterior + emite nuevo par
  → Si refresh falla → redirect /login

INVALIDACIÓN MASIVA
  → Al cambiar plan: invalidateOrgSessions(orgId)
  → Actualiza todas las sessions.revoked_at = NOW()
  → Próximo refresh: usuario obtiene JWT con nuevo plan
```

### 6.2 Claims del JWT

```json
{
  "sub": "uuid-del-usuario",
  "org_id": "uuid-de-la-organizacion",
  "org_slug": "nombre-del-negocio",
  "role": "owner|admin|member|viewer",
  "plan": "free|pro|business|agency",
  "trial_ends_at": "ISO date o null",
  "iat": 1234567890,
  "exp": 1234568790
}
```

### 6.3 Multi-tenancy (RLS)

El middleware `tenant.js` ejecuta antes de cada request:

```javascript
await client.query('SET LOCAL app.current_org = $1', [req.user.orgId]);
```

Todas las tablas de negocio tienen RLS habilitado:
```sql
USING (organization_id = current_setting('app.current_org')::uuid)
```

### 6.4 Reglas de Seguridad

- **Nunca** tomar `organization_id` del body del request — siempre del JWT
- **Nunca** guardar tokens OAuth en texto plano — cifrar con AES-256-GCM
- **Nunca** exponer `stripe_customer_id` al frontend
- **Siempre** verificar webhooks con HMAC antes de procesar
- **Siempre** sanitizar mensajes del usuario antes del LLM (anti prompt injection)
- **Siempre** rate limiting en endpoints públicos (login: 20/15min, register: 5/15min)

---

## 7. Pipeline del Bot IA

```
MESSAGE IN (Webhook / Polling)
    │
    ▼
[1] PlatformManager.receive(platform, rawPayload)
    │   → Normalizar payload a formato estándar
    ▼
[2] Sanitize (anti prompt injection)
    │   → Detectar patrones de inyección
    ▼
[3] RAG Retrieval
    │   → Generar embedding (nomic-embed-text)
    │   → Búsqueda pgvector (top 5, threshold 0.72)
    ▼
[4] Build Prompt
    │   → System prompt + contexto RAG + historial
    ▼
[5] LLM Call (Ollama Mistral)
    │   → structured output: { response_text, intent_score, confidence, captured_data }
    ▼
[6] Post-processing
    │   → Guardar mensajes en DB
    │   → Upsert lead si intent_score >= 50
    │   → Crear alerta si hot_lead (score >= 70)
    ▼
[7] PlatformManager.sendMessage(platform, chatId, response)
    │   → Enviar respuesta al usuario
    ▼
[8] Socket.IO emit (tiempo real)
    │   → Actualizar dashboard en vivo
```

---

## 8. API REST — Contratos

### 8.1 Auth

| Método | Ruta | Auth | Body | Response |
|--------|------|------|------|----------|
| POST | `/auth/register` | No | `{ email, password, name, orgName }` | `{ user, org, accessToken, refreshToken }` |
| POST | `/auth/login` | No | `{ email, password }` | `{ user, org, accessToken, refreshToken }` |
| POST | `/auth/refresh` | No | `{ refreshToken }` | `{ accessToken, refreshToken }` |
| POST | `/auth/logout` | No | `{ refreshToken }` | `{ success: true }` |

### 8.2 Inbox (Conversaciones)

| Método | Ruta | Auth | Query | Response |
|--------|------|------|-------|----------|
| GET | `/api/conversations` | JWT | `page, limit, status` | `[{ id, name, status, score, lastMsg, time }]` |
| GET | `/api/conversations/:id/messages` | JWT | — | `[{ type, content, time }]` |
| POST | `/api/conversations/:id/reply` | JWT | — | `{ success }` |
| POST | `/api/conversations/:id/take-control` | JWT | — | `{ success }` |

### 8.3 Leads (CRM)

| Método | Ruta | Auth | Body/Query | Response |
|--------|------|------|------------|----------|
| GET | `/api/leads` | JWT | `status, platform, page, limit` | `[{ id, name, status, score, platform, lastActivity }]` |
| GET | `/api/leads/:id` | JWT | — | `{ lead, conversationHistory }` |
| PATCH | `/api/leads/:id` | JWT | `{ status, notes, conversionValue }` | `{ lead }` |
| DELETE | `/api/leads/:id/gdpr-erase` | JWT | — | `{ success }` |

### 8.4 Products

| Método | Ruta | Auth | Response |
|--------|------|------|----------|
| GET | `/api/products` | JWT | `[{ id, name, price, category, imageUrl }]` |

### 8.5 Billing

| Método | Ruta | Auth | Body | Response |
|--------|------|------|------|----------|
| POST | `/billing/subscribe` | JWT | `{ plan, paymentMethodId }` | `{ clientSecret }` |
| PATCH | `/billing/subscription` | JWT | `{ plan }` | `{ success, effectiveDate }` |
| GET | `/billing/current` | JWT | — | `{ plan, effectivePlan, features, usage }` |
| GET | `/billing/portal` | JWT | — | Redirect a Stripe Customer Portal |

---

## 9. Pruebas — Estrategia y Cobertura

### 9.1 Pirámide de Pruebas

```
        ╱╲
       ╱ E2E ╲          5 tests (flujos completos)
      ╱────────╲
     ╱ Integration ╲   44 tests (entre servicios)
    ╱────────────────╲
   ╱   Unit Tests     ╲  87 tests (por capa)
  ╱──────────────────────╲
 ╱    Frontend UI Tests   ╲  12 tests (componentes)
╱────────────────────────────╲
```

### 9.2 Cobertura Mínima por Capa

| Capa | Objetivo | Mínimo |
|------|----------|--------|
| Domain (entities, value objects) | 95% | 90% |
| Application (use cases) | 90% | 80% |
| Infrastructure (repositories) | 85% | 70% |
| API (controllers, middleware) | 90% | 80% |
| Frontend components | 70% | 50% |

### 9.3 Comandos de Test

```bash
# Unit tests
cd backend && npx jest tests/unit/        # 87 tests

# Integration tests
cd backend && npx jest tests/integration/ # 44 tests

# All tests
cd backend && npx jest --coverage         # 148 tests

# Smoke tests
curl http://localhost:3000/health         # Status 200
```

### 9.4 Tests de Seguridad (Críticos)

| ID | Test | Criterio |
|----|------|----------|
| SEC-1 | Sin JWT → 401 | `GET /api/leads` sin header → 401 |
| SEC-2 | JWT expirado → 401 | Token con `exp` pasado → 401 |
| SEC-3 | Login rate limit | 21 requests → 429 |
| SEC-4 | Prompt injection | Mensaje con "ignora instrucciones" → respuesta normal |
| SEC-5 | SQL injection | `'; DROP TABLE leads;--` → sin efecto |
| SEC-6 | CORS | Origin no permitido → sin Access-Control-Allow-Origin |

---

## 10. Guía de Despliegue a Producción

### 10.1 Prerrequisitos

- [ ] **JWT_SECRET** generado (64+ chars hex)
- [ ] **TOKEN_ENCRYPTION_KEY** generado (32 bytes hex)
- [ ] **ALLOWED_ORIGINS** configurado con dominios reales
- [ ] **TELEGRAM_TOKEN** configurado y probado
- [ ] **STRIPE** productos creados y price IDs configurados
- [ ] **META** App de Facebook Developer configurada
- [ ] **RESEND** API key generada y dominio verificado
- [ ] **STORAGE** (MinIO/R2) configurado con credenciales
- [ ] **GPU Instance** con Qwen-VL funcionando

### 10.2 Pasos de Despliegue

```bash
# 1. Clonar y configurar
git clone https://github.com/tu-repo/sistema-marketing.git
cd sistema-marketing
cp .env.example .env    # Configurar todas las variables

# 2. Inicializar infraestructura
docker compose up -d db redis

# 3. Inicializar base de datos
cd backend && node init_db.js && node seed.js

# 4. Iniciar servicios
docker compose up -d

# 5. Verificar
curl http://localhost:3000/health    # → { status: "ok" }
```

### 10.3 Servidor de Producción (Recomendado)

| Recurso | Mínimo | Recomendado |
|---------|--------|-------------|
| CPU | 4 cores | 8 cores |
| RAM | 16 GB | 32 GB |
| Disco | 50 GB SSD | 100 GB SSD |
| GPU | Opcional | NVIDIA T4+ (para Qwen-VL) |
| SO | Ubuntu 22.04 LTS | Ubuntu 24.04 LTS |
| Docker | 24+ | 27+ |

### 10.4 Checklist Pre-Producción

- [ ] Migraciones DB ejecutadas en orden (001 → 005)
- [ ] RLS habilitado en todas las tablas de negocio
- [ ] Seed data cargada (org demo + bot config + knowledge chunks)
- [ ] Todos los tests unitarios pasan ✅
- [ ] Todos los tests de integración pasan ✅
- [ ] Smoke tests pasan (health, login, bot response)
- [ ] CORS configurado con orígenes correctos
- [ ] Rate limiting activo en /auth
- [ ] Helmet headers de seguridad activos
- [ ] Sin orgId hardcodeado (`grep -r "369344ae" backend/` → 0 resultados)
- [ ] Stripe webhook configurado y probado
- [ ] Meta webhook configurado y verificado (HMAC)
- [ ] SSL/TLS configurado (certbot/nginx)
- [ ] Logs configurados sin datos sensibles
- [ ] Monitoreo de errores (opcional: Sentry)

### 10.5 Monitoreo y Mantenimiento

```bash
# Logs
docker compose logs -f backend
docker compose logs -f frontend

# Base de datos
docker compose exec db psql -U user -d omnipresence -c "SELECT count(*) FROM leads;"
docker compose exec db psql -U user -d omnipresence -c "SELECT count(*) FROM messages;"

# Redis
docker compose exec redis redis-cli PING

# Backups
docker compose exec db pg_dump -U user omnipresence > backup_$(date +%Y%m%d).sql
```

---

## Apéndice A: Glosario de Términos

| Término | Definición |
|---------|-----------|
| **Tenant** | Organización cliente del SaaS |
| **RLS** | Row Level Security — aislamiento a nivel DB |
| **RAG** | Retrieval Augmented Generation — búsqueda semántica + LLM |
| **PGVector** | Extensión de PostgreSQL para vectores de embeddings |
| **BullMQ** | Cola de trabajos con Redis |
| **Handoff** | Transferencia de conversación del bot a humano |
| **Intent Score** | Puntuación 0-100 que mide intención de compra |
| **JWT** | JSON Web Token para autenticación stateless |
| **HMAC** | Hash-based Message Authentication Code para webhooks |
| **OAuth** | Protocolo de autorización para APIs externas |

## Apéndice B: Referencia Rápida de Comandos

```bash
# Desarrollo
cd backend && npm run dev           # Backend con nodemon
cd frontend && npm run dev          # Frontend con Vite
docker compose up -d db redis       # Solo DB + Redis

# Producción
docker compose up -d                # Todos los servicios
docker compose -f docker-compose.prod.yml up -d

# Testing
cd backend && npx jest              # Todos los tests
cd backend && npx jest --watch      # Watch mode
cd backend && npx jest --coverage   # Con covertura

# DB
cd backend && node init_db.js       # Crear schema
cd backend && node seed.js          # Poblar datos demo

# Generación de secretos
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"   # JWT_SECRET
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"   # TOKEN_ENCRYPTION_KEY
```
