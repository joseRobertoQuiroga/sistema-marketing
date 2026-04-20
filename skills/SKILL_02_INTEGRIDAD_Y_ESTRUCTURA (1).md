# SKILL 02 — Integridad y Estructura
## OmniPresence Suite · SaaS Multi-tenant

> **Propósito de este skill:** Define el esquema completo de base de datos, las convenciones de datos, las relaciones entre entidades, las reglas de integridad referencial, las decisiones de arquitectura de datos y el schema Drizzle ORM en TypeScript. Es la fuente de verdad del modelo de datos de la plataforma.

---

## 1. Convenciones globales del sistema

### Identificadores
- **UUIDs v4** como PK en todas las tablas — generados con `gen_random_uuid()` en PostgreSQL
- Nunca se usan IDs incrementales — evitan enumeración y funcionan en entornos distribuidos
- Los IDs de plataformas externas se guardan en campos `platform_*_id TEXT` separados

### Timestamps
- **Siempre `TIMESTAMPTZ`** (timestamp with timezone) — almacenados en UTC
- Toda tabla lleva `created_at TIMESTAMPTZ DEFAULT NOW()`
- Tablas mutables llevan además `updated_at TIMESTAMPTZ DEFAULT NOW()` con trigger de auto-update
- La conversión a timezone local ocurre en el frontend según `organizations.settings.timezone`

### Soft delete
- Entidades con valor histórico tienen `deleted_at TIMESTAMPTZ` en lugar de eliminación física
- Entidades con soft delete: `leads`, `conversations`, `knowledge_chunks`, `posts` (borradores)
- `assets` se eliminan físicamente (también del storage) — tiene sentido liberar espacio
- Todas las queries de listado filtran `WHERE deleted_at IS NULL`

### JSONB para datos variables por plataforma
- Campos que varían según el canal (captions, variantes de assets, metadata de mensajes) usan `JSONB`
- Los campos JSONB críticos tienen constraints de validación de estructura donde sea posible
- Nunca se usan para datos que necesiten indexación frecuente — esos van en columnas propias

### Naming
- Tablas: `snake_case`, plural (`organizations`, `social_connections`, `knowledge_chunks`)
- Columnas: `snake_case` siempre
- Índices: `idx_{tabla}_{columnas}` (`idx_posts_org_scheduled`)
- Constraints: `chk_{tabla}_{campo}` para checks, `uniq_{tabla}_{campo}` para unique


---

## 2. Schema completo — Grupo 1: Core / Identity

```sql
CREATE TABLE organizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  plan TEXT NOT NULL DEFAULT 'free'
    CHECK (plan IN ('free','pro','business','agency')),
  billing_email TEXT,
  settings JSONB NOT NULL DEFAULT '{"timezone": "America/La_Paz","language": "es","bot_default_tone": "amigable","notifications": {"email": true, "in_app": true}}',
  trial_ends_at TIMESTAMPTZ,
  stripe_customer_id TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT UNIQUE NOT NULL,
  email_verified_at TIMESTAMPTZ,
  name TEXT NOT NULL,
  avatar_url TEXT,
  password_hash TEXT,
  mfa_secret TEXT,
  mfa_enabled BOOLEAN DEFAULT false,
  mfa_backup_codes TEXT[],
  last_login_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE memberships (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'member'
    CHECK (role IN ('owner','admin','member','viewer')),
  invited_by UUID REFERENCES users(id),
  invited_at TIMESTAMPTZ,
  accepted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(organization_id, user_id)
);

CREATE TABLE sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL UNIQUE,
  user_agent TEXT,
  ip_address INET,
  revoked_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE usage_counters (
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  metric TEXT NOT NULL
    CHECK (metric IN ('channels_connected','posts_published','bot_conversations')),
  period TEXT NOT NULL,
  count INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (organization_id, metric, period)
);

CREATE TABLE audit_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID,
  actor_user_id UUID,
  actor_type TEXT NOT NULL DEFAULT 'user'
    CHECK (actor_type IN ('user','system','bot','api')),
  action TEXT NOT NULL,
  resource_type TEXT,
  resource_id UUID,
  metadata JSONB DEFAULT '{}',
  ip_address INET,
  user_agent TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
) PARTITION BY RANGE (created_at);

CREATE TABLE audit_events_2025_q2 PARTITION OF audit_events
  FOR VALUES FROM ('2025-04-01') TO ('2025-07-01');
```

---

## 3. Schema completo — Grupo 2: Redes sociales y analytics

```sql
CREATE TABLE social_connections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  platform TEXT NOT NULL
    CHECK (platform IN ('facebook','instagram','tiktok','linkedin','google')),
  platform_account_id TEXT NOT NULL,
  username TEXT,
  encrypted_token BYTEA NOT NULL,
  token_iv BYTEA NOT NULL,
  encrypted_refresh_token BYTEA,
  refresh_token_iv BYTEA,
  token_expires_at TIMESTAMPTZ,
  scopes TEXT[],
  page_name TEXT,
  page_category TEXT,
  is_active BOOLEAN DEFAULT true,
  connected_at TIMESTAMPTZ DEFAULT NOW(),
  last_synced_at TIMESTAMPTZ,
  UNIQUE(organization_id, platform, platform_account_id)
);
ALTER TABLE social_connections ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_iso ON social_connections
  USING (organization_id = current_setting('app.current_org')::uuid);

CREATE TABLE account_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  social_connection_id UUID NOT NULL REFERENCES social_connections(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL,
  metric_date DATE NOT NULL,
  followers INTEGER,
  followers_delta INTEGER,
  total_posts INTEGER,
  avg_engagement_rate NUMERIC(5,4),
  total_reach INTEGER,
  total_impressions INTEGER,
  total_spend_usd NUMERIC(10,2),
  total_leads INTEGER,
  total_conversions INTEGER,
  synced_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(social_connection_id, metric_date)
) PARTITION BY RANGE (metric_date);

CREATE TABLE account_metrics_2025_q2 PARTITION OF account_metrics
  FOR VALUES FROM ('2025-04-01') TO ('2025-07-01');
```

---

## 4. Schema completo — Grupo 3: Publicación de contenido

```sql
CREATE TABLE assets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  uploaded_by UUID REFERENCES users(id),
  filename TEXT NOT NULL,
  storage_key TEXT NOT NULL UNIQUE,
  mime_type TEXT NOT NULL,
  file_size_kb INTEGER NOT NULL,
  width_px INTEGER,
  height_px INTEGER,
  duration_sec INTEGER,
  alt_text TEXT,
  focal_point JSONB,
  tags TEXT[],
  uploaded_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE assets ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_iso ON assets
  USING (organization_id = current_setting('app.current_org')::uuid);

CREATE TABLE posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  author_id UUID REFERENCES users(id),
  status TEXT NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft','scheduled','publishing','published','failed','cancelled')),
  caption_template TEXT,
  platform_captions JSONB DEFAULT '{}',
  platform_hashtags JSONB DEFAULT '{}',
  scheduled_at TIMESTAMPTZ,
  published_at TIMESTAMPTZ,
  deleted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE posts ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_iso ON posts
  USING (organization_id = current_setting('app.current_org')::uuid);

CREATE TABLE post_assets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id UUID NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  asset_id UUID NOT NULL REFERENCES assets(id),
  asset_type TEXT NOT NULL CHECK (asset_type IN ('image','video','carousel')),
  original_url TEXT NOT NULL,
  variants JSONB NOT NULL DEFAULT '[]',
  display_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE post_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id UUID NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  social_connection_id UUID NOT NULL REFERENCES social_connections(id),
  platform_post_id TEXT,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','publishing','published','failed','skipped')),
  error_message TEXT,
  retry_count INTEGER DEFAULT 0,
  published_at TIMESTAMPTZ,
  UNIQUE(post_id, social_connection_id)
);

CREATE TABLE post_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_account_id UUID NOT NULL REFERENCES post_accounts(id) ON DELETE CASCADE,
  metric_date DATE NOT NULL,
  impressions INTEGER DEFAULT 0,
  reach INTEGER DEFAULT 0,
  likes INTEGER DEFAULT 0,
  comments INTEGER DEFAULT 0,
  shares INTEGER DEFAULT 0,
  saves INTEGER DEFAULT 0,
  clicks INTEGER DEFAULT 0,
  video_views INTEGER DEFAULT 0,
  video_completion_rate NUMERIC(4,3),
  engagement_rate NUMERIC(5,4),
  spend_usd NUMERIC(10,2) DEFAULT 0,
  conversions INTEGER DEFAULT 0,
  leads INTEGER DEFAULT 0,
  cost_per_lead NUMERIC(10,2),
  roas NUMERIC(8,2),
  synced_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(post_account_id, metric_date)
) PARTITION BY RANGE (metric_date);

CREATE TABLE post_metrics_2025_q2 PARTITION OF post_metrics
  FOR VALUES FROM ('2025-04-01') TO ('2025-07-01');
```


---

## 5. Schema completo — Grupo 4: Bot IA y leads

```sql
CREATE TABLE knowledge_chunks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  source_type TEXT NOT NULL
    CHECK (source_type IN ('csv','pdf','text','url','manual')),
  source_name TEXT NOT NULL,
  content TEXT NOT NULL,
  embedding vector(1536),
  metadata JSONB DEFAULT '{}',
  is_active BOOLEAN DEFAULT true,
  deleted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE knowledge_chunks ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_iso ON knowledge_chunks
  USING (organization_id = current_setting('app.current_org')::uuid);

CREATE INDEX idx_knowledge_chunks_embedding ON knowledge_chunks
  USING hnsw (embedding vector_cosine_ops)
  WITH (m = 16, ef_construction = 64)
  WHERE is_active = true AND deleted_at IS NULL;

CREATE TABLE leads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  social_connection_id UUID REFERENCES social_connections(id),
  platform TEXT NOT NULL
    CHECK (platform IN ('instagram','facebook','whatsapp','tiktok','web')),
  platform_user_id TEXT,
  display_name TEXT,
  contact_identifier TEXT,
  status TEXT NOT NULL DEFAULT 'cold'
    CHECK (status IN ('cold','warm','hot','converted','lost')),
  intent_score INTEGER DEFAULT 0
    CHECK (intent_score >= 0 AND intent_score <= 100),
  first_contact_source TEXT,
  first_contact_at TIMESTAMPTZ,
  last_activity_at TIMESTAMPTZ,
  converted_at TIMESTAMPTZ,
  conversion_value NUMERIC(10,2),
  notes TEXT,
  deleted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE leads ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_iso ON leads
  USING (organization_id = current_setting('app.current_org')::uuid);

CREATE TABLE conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id UUID NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  social_connection_id UUID NOT NULL REFERENCES social_connections(id),
  platform_thread_id TEXT,
  assigned_to_user_id UUID REFERENCES users(id),
  bot_active BOOLEAN DEFAULT true,
  handoff_reason TEXT
    CHECK (handoff_reason IN ('low_confidence','user_request','hot_lead','fallback','manual')),
  message_count INTEGER DEFAULT 0,
  last_message_at TIMESTAMPTZ,
  resolved_at TIMESTAMPTZ,
  deleted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  direction TEXT NOT NULL CHECK (direction IN ('inbound','outbound')),
  content TEXT NOT NULL,
  sender_type TEXT NOT NULL CHECK (sender_type IN ('user','bot','agent')),
  platform_message_id TEXT,
  confidence_score NUMERIC(3,2),
  rag_chunks_used UUID[],
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE bot_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  is_active BOOLEAN DEFAULT false,
  tone TEXT NOT NULL DEFAULT 'amigable'
    CHECK (tone IN ('formal','amigable','casual','profesional')),
  business_name TEXT,
  active_platforms TEXT[] DEFAULT '{}',
  confidence_threshold NUMERIC(3,2) DEFAULT 0.60,
  hot_lead_threshold INTEGER DEFAULT 70,
  auto_response_delay_sec INTEGER DEFAULT 3,
  custom_instructions TEXT,
  escalation_message TEXT DEFAULT 'Te estoy comunicando con uno de nuestros asesores.',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(organization_id)
);
ALTER TABLE bot_configs ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_iso ON bot_configs
  USING (organization_id = current_setting('app.current_org')::uuid);

CREATE TABLE alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  type TEXT NOT NULL
    CHECK (type IN ('token_expiring','hot_lead','post_failed','engagement_drop','plan_limit_near','sync_error','payment_failed')),
  severity TEXT NOT NULL DEFAULT 'info'
    CHECK (severity IN ('info','warning','error')),
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  context_data JSONB DEFAULT '{}',
  is_read BOOLEAN DEFAULT false,
  triggered_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ
);
ALTER TABLE alerts ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_iso ON alerts
  USING (organization_id = current_setting('app.current_org')::uuid);
```

---

## 6. Schema completo — Grupo 5: Billing

```sql
CREATE TABLE subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  stripe_subscription_id TEXT NOT NULL UNIQUE,
  stripe_customer_id TEXT NOT NULL,
  plan TEXT NOT NULL CHECK (plan IN ('pro','business','agency')),
  status TEXT NOT NULL
    CHECK (status IN ('active','past_due','canceled','incomplete','trialing')),
  current_period_start TIMESTAMPTZ NOT NULL,
  current_period_end TIMESTAMPTZ NOT NULL,
  cancel_at_period_end BOOLEAN DEFAULT false,
  canceled_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(organization_id)
);
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_iso ON subscriptions
  USING (organization_id = current_setting('app.current_org')::uuid);

CREATE TABLE billing_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id),
  stripe_event_id TEXT NOT NULL UNIQUE,
  event_type TEXT NOT NULL,
  previous_plan TEXT,
  new_plan TEXT,
  amount_usd NUMERIC(10,2),
  stripe_invoice_id TEXT,
  stripe_subscription_id TEXT,
  metadata JSONB DEFAULT '{}',
  processed_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_billing_events_org ON billing_events(organization_id, processed_at DESC);

CREATE TABLE webhook_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  platform TEXT NOT NULL,
  platform_event_id TEXT NOT NULL,
  organization_id UUID,
  processed_at TIMESTAMPTZ,
  status TEXT DEFAULT 'pending',
  UNIQUE(platform, platform_event_id)
);
```


---

## 7. Índices críticos de performance

```sql
-- Core
CREATE INDEX idx_sessions_user_active ON sessions(user_id) WHERE revoked_at IS NULL;
CREATE INDEX idx_sessions_org_active ON sessions(organization_id) WHERE revoked_at IS NULL;
CREATE INDEX idx_memberships_user ON memberships(user_id);
CREATE INDEX idx_memberships_org ON memberships(organization_id);

-- Social connections
CREATE INDEX idx_social_connections_org_active ON social_connections(organization_id)
  WHERE is_active = true;
CREATE INDEX idx_social_connections_token_expiry ON social_connections(token_expires_at)
  WHERE is_active = true;

-- Posts
CREATE INDEX idx_posts_org_status_scheduled ON posts(organization_id, status, scheduled_at)
  WHERE deleted_at IS NULL;

-- Métricas: queries de dashboard
CREATE INDEX idx_account_metrics_org_date ON account_metrics(organization_id, metric_date DESC);
CREATE INDEX idx_post_metrics_date ON post_metrics(post_account_id, metric_date DESC);

-- Leads y conversaciones
CREATE INDEX idx_leads_org_status ON leads(organization_id, status) WHERE deleted_at IS NULL;
CREATE INDEX idx_leads_org_intent ON leads(organization_id, intent_score DESC) WHERE deleted_at IS NULL;
CREATE INDEX idx_conversations_lead ON conversations(lead_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_messages_conversation ON messages(conversation_id, created_at DESC);

-- Knowledge base
CREATE INDEX idx_knowledge_chunks_org ON knowledge_chunks(organization_id)
  WHERE is_active = true AND deleted_at IS NULL;

-- Alerts
CREATE INDEX idx_alerts_org_unread ON alerts(organization_id, triggered_at DESC)
  WHERE is_read = false;

-- Audit log
CREATE INDEX idx_audit_events_org_date ON audit_events(organization_id, created_at DESC);
```

---

## 8. Triggers de integridad

```sql
-- Auto-update de updated_at en tablas mutables
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_organizations_updated BEFORE UPDATE ON organizations
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_users_updated BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_posts_updated BEFORE UPDATE ON posts
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_leads_updated BEFORE UPDATE ON leads
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_bot_configs_updated BEFORE UPDATE ON bot_configs
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_subscriptions_updated BEFORE UPDATE ON subscriptions
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Auto-actualizar intent_score → status del lead
CREATE OR REPLACE FUNCTION sync_lead_status()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.status = 'converted' THEN
    NEW.status = 'converted'; -- proteger historial — no degradar convertidos
    RETURN NEW;
  END IF;
  IF NEW.intent_score <= 20 THEN NEW.status = 'cold';
  ELSIF NEW.intent_score <= 50 THEN NEW.status = 'warm';
  ELSIF NEW.intent_score <= 80 THEN NEW.status = 'hot';
  ELSE NEW.status = 'converted';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_lead_status_sync BEFORE INSERT OR UPDATE OF intent_score ON leads
  FOR EACH ROW EXECUTE FUNCTION sync_lead_status();
```

---

## 9. Flujo de datos por módulo

### Módulo 1 — Analytics Hub
```
OAuth connect → social_connections (token cifrado)
  → Job BullMQ cada 4h por canal activo
  → Meta Graph API / TikTok API / LinkedIn API
  → account_metrics (upsert connection_id + metric_date)
  → post_metrics (upsert post_account_id + metric_date)
  → Redis cache de agregaciones por org (TTL 1h)
  → Frontend consulta /api/analytics?period=30d
  → API lee de Redis o query directa con partition pruning
```

### Módulo 2 — Content Hub
```
Upload asset → validación mime + tamaño
  → MinIO/R2: /{org_id}/assets/{id}.ext
  → registro en assets tabla
  → Job BullMQ: Sharp genera variantes por plataforma
  → variantes en /{org_id}/variants/{asset_id}/{platform}_{format}.ext
  → post_assets.variants actualizado
  → Usuario crea post: caption por canal, hashtags, scheduling
  → post.status = 'scheduled'
  → Job publish_post corre en scheduled_at
  → Para cada canal: llamada a API de la plataforma
  → post_accounts.status = published / failed (retry hasta 3 veces)
  → post_metrics sync comienza 4h después
```

### Módulo 3 — Bot IA y Leads
```
Webhook Meta → verificación HMAC → idempotency check
  → identificar social_connection_id
  → buscar/crear lead por platform_user_id
  → buscar/crear conversation por platform_thread_id
  → guardar message (inbound)
  → sanitizar mensaje (anti prompt injection)
  → RAG: knowledge_chunks WHERE organization_id = X, similarity > 0.72
  → buildSystemPrompt(bot_config + chunks)
  → LLM: respuesta estructurada JSON (confidence, intent_score, captured_data)
  → si confidence < 0.60: handoff → alerta al equipo
  → si confidence >= 0.60: enviar respuesta vía Meta API
  → guardar message (outbound) con confidence + rag_chunks_used
  → actualizar lead.intent_score → trigger sync_lead_status
  → si intent_score >= hot_lead_threshold: crear alerta 'hot_lead'
```

---

## 10. Reglas de integridad referencial

| Relación | ON DELETE | Razón |
|----------|-----------|-------|
| `organizations` → todos los hijos | CASCADE | Si se elimina una org, todo su dato va con ella |
| `users` → `posts.author_id` | SET NULL | El post puede sobrevivir al usuario |
| `users` → `conversations.assigned_to_user_id` | SET NULL | La conversación no se pierde si el agente se va |
| `social_connections` → `leads.social_connection_id` | SET NULL | El lead puede existir sin la conexión que lo originó |
| `leads` → `conversations` | CASCADE | Sin lead, la conversación no tiene sentido |
| `conversations` → `messages` | CASCADE | Los mensajes son parte de la conversación |
| `posts` → `post_accounts` | CASCADE | Sin el post padre, los registros de canal no tienen sentido |
| `posts` → `post_assets` | CASCADE | Los assets adjuntos van con el post |

---

## 11. Migrations — estrategia y orden

### Orden de creación (no cambiar — dependencias FK)
1. `users`
2. `organizations`
3. `memberships`
4. `sessions`
5. `usage_counters`
6. `audit_events` (particionada)
7. `social_connections`
8. `account_metrics` (particionada)
9. `assets`
10. `posts`
11. `post_assets`
12. `post_accounts`
13. `post_metrics` (particionada)
14. `knowledge_chunks` (requiere pgvector)
15. `leads`
16. `conversations`
17. `messages`
18. `bot_configs`
19. `alerts`
20. `subscriptions`
21. `billing_events`
22. `webhook_events`
23. Todos los índices
24. Todos los triggers
25. Todas las RLS policies

### Gestión de migrations
- Usar **Drizzle ORM** con `drizzle-kit` para migrations tipo-safe
- Cada migration en archivo separado: `0001_initial_core.sql`, `0002_analytics.sql`, etc.
- Nunca editar migrations ya ejecutadas en producción — siempre crear una nueva
- Antes de cada deploy con migration: `pg_dump` de backup obligatorio (ver SKILL_07 §7)

### Extensions requeridas
```sql
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgvector";
CREATE EXTENSION IF NOT EXISTS "pg_partman";  -- gestión automática de particiones (recomendado)
```

---

## 12. Datos de referencia

### Estados del pipeline de leads
```
cold (0–20) → warm (21–50) → hot (51–80) → converted (81–100)
  ↘ lost (solo manual — puede venir de cualquier estado, nunca automático)
```

### Estados del post
```
draft → scheduled → publishing → published
                              ↘ failed (retry hasta 3 veces con backoff exponencial)
draft → cancelled
```

### Límites de caption por plataforma
```typescript
export const CAPTION_LIMITS = {
  instagram: 2200,
  facebook: 63206,
  tiktok: 2200,
  linkedin: 3000,
} as const;
```

---

## 13. Schema Drizzle ORM — TypeScript (fuente de verdad de tipos)

```typescript
// packages/db/src/schema/core.ts
import {
  pgTable, uuid, text, boolean, timestamp,
  inet, jsonb, integer, unique, numeric,
} from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

export const organizations = pgTable('organizations', {
  id:              uuid('id').primaryKey().defaultRandom(),
  name:            text('name').notNull(),
  slug:            text('slug').notNull().unique(),
  plan:            text('plan', { enum: ['free','pro','business','agency'] })
                     .notNull().default('free'),
  billingEmail:    text('billing_email'),
  settings:        jsonb('settings').notNull().default({
                     timezone: 'America/La_Paz', language: 'es',
                     bot_default_tone: 'amigable',
                     notifications: { email: true, in_app: true },
                   }),
  trialEndsAt:     timestamp('trial_ends_at', { withTimezone: true }),
  stripeCustomerId: text('stripe_customer_id'),
  createdAt:       timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt:       timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

export const users = pgTable('users', {
  id:               uuid('id').primaryKey().defaultRandom(),
  email:            text('email').notNull().unique(),
  emailVerifiedAt:  timestamp('email_verified_at', { withTimezone: true }),
  name:             text('name').notNull(),
  avatarUrl:        text('avatar_url'),
  passwordHash:     text('password_hash'),
  mfaSecret:        text('mfa_secret'),
  mfaEnabled:       boolean('mfa_enabled').default(false).notNull(),
  mfaBackupCodes:   text('mfa_backup_codes').array(),
  lastLoginAt:      timestamp('last_login_at', { withTimezone: true }),
  createdAt:        timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt:        timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

export const memberships = pgTable('memberships', {
  id:             uuid('id').primaryKey().defaultRandom(),
  organizationId: uuid('organization_id').notNull()
                    .references(() => organizations.id, { onDelete: 'cascade' }),
  userId:         uuid('user_id').notNull()
                    .references(() => users.id, { onDelete: 'cascade' }),
  role:           text('role', { enum: ['owner','admin','member','viewer'] })
                    .notNull().default('member'),
  invitedBy:      uuid('invited_by').references(() => users.id),
  invitedAt:      timestamp('invited_at', { withTimezone: true }),
  acceptedAt:     timestamp('accepted_at', { withTimezone: true }),
  createdAt:      timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (t) => ({ uniqueMemberOrg: unique().on(t.organizationId, t.userId) }));

// Relaciones (para joins con Drizzle ORM)
export const organizationsRelations = relations(organizations, ({ many }) => ({
  memberships: many(memberships),
}));
export const usersRelations = relations(users, ({ many }) => ({
  memberships: many(memberships),
}));
export const membershipsRelations = relations(memberships, ({ one }) => ({
  organization: one(organizations, { fields: [memberships.organizationId], references: [organizations.id] }),
  user: one(users, { fields: [memberships.userId], references: [users.id] }),
}));

// packages/db/src/index.ts
import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as schema from './schema';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
export const db = drizzle(pool, { schema });

// Tipos inferidos — usar en toda la aplicación, nunca definir los mismos tipos de nuevo
export type Organization    = typeof organizations.$inferSelect;
export type NewOrganization = typeof organizations.$inferInsert;
export type User            = typeof users.$inferSelect;
export type NewUser         = typeof users.$inferInsert;
export type Membership      = typeof memberships.$inferSelect;
```

---

## 14. Seed data inicial

```sql
-- packages/db/src/seed.sql
-- Ejecutar en: local + staging. NUNCA en producción.

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgvector";

-- Organización de prueba con plan Pro activo
INSERT INTO organizations (id, name, slug, plan, trial_ends_at, settings) VALUES (
  '00000000-0000-0000-0000-000000000001',
  'Tienda Demo SCZ',
  'tienda-demo-scz',
  'pro',
  NOW() + INTERVAL '14 days',
  '{"timezone":"America/La_Paz","language":"es","bot_default_tone":"amigable","notifications":{"email":true,"in_app":true}}'
);

-- Usuario owner (password: DemoPass123!)
INSERT INTO users (id, email, name, password_hash, email_verified_at) VALUES (
  '00000000-0000-0000-0000-000000000002',
  'demo@omnipresence.io',
  'Demo Owner',
  '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewdBPj4J/HzXH3.e',
  NOW()
);

-- Membership owner
INSERT INTO memberships (organization_id, user_id, role, accepted_at) VALUES (
  '00000000-0000-0000-0000-000000000001',
  '00000000-0000-0000-0000-000000000002',
  'owner',
  NOW()
);

-- Bot config inicial (inactivo — se activa tras subir knowledge base)
INSERT INTO bot_configs (organization_id, is_active, tone, business_name) VALUES (
  '00000000-0000-0000-0000-000000000001',
  false,
  'amigable',
  'Tienda Demo SCZ'
);
```

---

## 15. Estrategia de backup y recuperación

```bash
# Ver SKILL_07 §7 para el script completo automatizado.
# Reglas mínimas:
# - Backup diario a las 3:00 AM → Cloudflare R2
# - Retención: 30 días
# - Antes de cada deploy con migrations en producción: backup manual obligatorio
# - Verificar integridad post-backup con conteos básicos:
psql "${DATABASE_URL}" -c "SELECT COUNT(*) FROM organizations;"
psql "${DATABASE_URL}" -c "SELECT COUNT(*) FROM leads WHERE deleted_at IS NULL;"
psql "${DATABASE_URL}" -c "SELECT COUNT(*) FROM knowledge_chunks WHERE is_active = true;"
```
