# Contexto Técnico de Billing — OmniPresence Suite

> Documento integral que consolida toda la información necesaria para implementar el sistema de facturación, suscripciones y monetización del SaaS. Basado en SKILL_04, SKILL_01, SKILL_02, SKILL_03 y SKILL_07.

---

## Índice

1. [Modelo de Precios](#1-modelo-de-precios)
2. [Esquema de Base de Datos](#2-esquema-de-base-de-datos)
3. [Flujo de Suscripción Completo](#3-flujo-de-suscripción-completo)
4. [Stripe Webhooks (6 eventos)](#4-stripe-webhooks-6-eventos)
5. [API REST de Billing](#5-api-rest-de-billing)
6. [Plan Limiter — Enforcement de Cuotas](#6-plan-limiter--enforcement-de-cuotas)
7. [Emails de Billing (7 triggers)](#7-emails-de-billing-7-triggers)
8. [Stripe Customer Portal](#8-stripe-customer-portal)
9. [Manejo de Pagos Fallidos](#9-manejo-de-pagos-fallidos)
10. [Upgrade, Downgrade y Cancelación](#10-upgrade-downgrade-y-cancelación)
11. [Trial de 14 Días](#11-trial-de-14-días)
12. [Reglas de Negocio Críticas](#12-reglas-de-negocio-críticas)
13. [Variables de Entorno](#13-variables-de-entorno)
14. [Checklist de Deploy](#14-checklist-de-deploy)
15. [Pruebas Requeridas](#15-pruebas-requeridas)

---

## 1. Modelo de Precios

### Planes

| Plan | Precio (USD/mes) | Canales | Posts/mes | Conversaciones Bot/mes | Target |
|------|-----------------|---------|-----------|----------------------|--------|
| **Free** | $0 | 2 | 30 | 100 | Prueba / micropymes |
| **Pro** | $29 | 5 | Ilimitado | 1,000 | PYMEs en crecimiento |
| **Business** | $59 | Ilimitado | Ilimitado | 5,000 | Negocios establecidos |
| **Agency** | $89 | Ilimitado | Ilimitado | Ilimitado | Agencias / multi-cliente |

### IDs de Precios en Stripe (variables de entorno)

```bash
STRIPE_PRICE_PRO_MONTHLY=price_pro_monthly_id      # $29/mes
STRIPE_PRICE_BUSINESS_MONTHLY=price_business_id    # $59/mes
STRIPE_PRICE_AGENCY_MONTHLY=price_agency_id        # $89/mes
```

### Política de Precios

- **Trial 14 días gratis** — sin tarjeta, acceso a features Pro
- **Facturación mensual** — sin plan anual en v1 (post-MVP)
- **Prorrateo en upgrades** — se cobra diferencia proporcional
- **Sin prorrateo en downgrades** — efectivo al próximo ciclo
- **Período de gracia en pagos fallidos** — 7 días tras 3 intentos

---

## 2. Esquema de Base de Datos

### 2.1 Tablas Nuevas

#### `subscriptions` — Suscripciones activas

```sql
CREATE TABLE subscriptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    stripe_subscription_id TEXT NOT NULL UNIQUE,
    stripe_customer_id TEXT NOT NULL,
    plan TEXT NOT NULL CHECK (plan IN ('pro','business','agency')),
    status TEXT NOT NULL CHECK (status IN ('active','past_due','canceled','incomplete','trialing')),
    current_period_start TIMESTAMPTZ NOT NULL,
    current_period_end TIMESTAMPTZ NOT NULL,
    cancel_at_period_end BOOLEAN DEFAULT false,
    canceled_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(organization_id)
);

CREATE INDEX idx_subscriptions_org ON subscriptions(organization_id);
CREATE INDEX idx_subscriptions_stripe ON subscriptions(stripe_subscription_id);
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;
```

#### `billing_events` — Registro append-only de eventos Stripe

```sql
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
CREATE INDEX idx_billing_events_stripe_id ON billing_events(stripe_event_id);
```

#### `usage_counters` — Contadores de uso mensual por org

```sql
CREATE TABLE usage_counters (
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    metric TEXT NOT NULL CHECK (metric IN ('channels_connected','posts_published','bot_conversations')),
    period TEXT NOT NULL,
    count INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (organization_id, metric, period)
);
```

### 2.2 Modificaciones a Tablas Existentes

```sql
-- organizations: añadir campos de billing
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS stripe_customer_id TEXT UNIQUE;
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS trial_ends_at TIMESTAMPTZ;
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS billing_email TEXT;

-- Índices
CREATE INDEX IF NOT EXISTS idx_org_stripe ON organizations(stripe_customer_id) WHERE stripe_customer_id IS NOT NULL;
```

### 2.3 Diccionario de Campos

| Tabla | Campo | Tipo | Descripción |
|-------|-------|------|-------------|
| `organizations` | `plan` | TEXT | Plan actual: 'free','pro','business','agency' |
| `organizations` | `stripe_customer_id` | TEXT | ID del customer en Stripe (NULL si nunca pagó) |
| `organizations` | `trial_ends_at` | TIMESTAMPTZ | Fin del trial de 14 días (NULL si no aplica) |
| `organizations` | `billing_email` | TEXT | Email de facturación (puede diferir del owner) |
| `subscriptions` | `plan` | TEXT | Plan suscrito (solo planes pagos) |
| `subscriptions` | `status` | TEXT | Estado en Stripe: active, past_due, canceled, trialing |
| `subscriptions` | `cancel_at_period_end` | BOOLEAN | Programado para cancelar al fin del período |
| `billing_events` | `stripe_event_id` | TEXT | ID de idempotencia de Stripe (UNIQUE) |
| `usage_counters` | `metric` | TEXT | channels_connected / posts_published / bot_conversations |
| `usage_counters` | `period` | TEXT | Formato YYYY-MM (ej: 2026-06) |

---

## 3. Flujo de Suscripción Completo

### 3.1 Registro + Trial

```
Usuario completa formulario de registro
  → POST /auth/register
    → Crear organizations con plan='free', trial_ends_at=NOW()+14d
    → Crear users + memberships con role='owner'
    → stripe_customer_id = NULL (se crea al primer pago)
    → Responder con access_token + org info
  → Frontend redirige a onboarding
  → Durante trial: getEffectivePlan() retorna 'pro'
```

### 3.2 Upgrade (Free/Trial → Pro/Business/Agency)

```
Usuario selecciona plan en settings/billing
  → POST /billing/subscribe { plan: 'pro', payment_method_id: 'pm_...' }
    → 1. Obtener/crear Stripe Customer (si no existe)
    → 2. Attach payment method al customer
    → 3. Crear suscripción en Stripe con payment_behavior: 'default_incomplete'
    → 4. Retornar client_secret para confirmación 3D Secure (si aplica)
    → 5. NO actualizar organizations.plan aquí — esperar webhook
  → Frontend confirma payment intent con Stripe.js (handleCardPayment)
  → Webhook subscription.updated → actualiza organizations.plan
```

### 3.3 Upgrade entre Planes Pagos

```
Usuario cambia de Pro → Business
  → PATCH /billing/subscription { plan: 'business' }
    → 1. Obtener subscription activa de DB
    → 2. Actualizar item en Stripe (prorrateo automático)
    → 3. Webhook subscription.updated → actualiza plan en DB
  → El usuario paga la diferencia prorrateada en la siguiente factura
```

### 3.4 Downgrade

```
Usuario cambia de Business → Pro
  → PATCH /billing/subscription { plan: 'pro' }
    → 1. Si destino es 'free': cancel_at_period_end = true
    → 2. Si destino es pago menor: actualizar en Stripe con proration_behavior: 'none'
    → 3. Efectivo al próximo ciclo de facturación
  → Los datos existentes que exceden el nuevo límite se conservan (over_limit)
  → Banner in-app informando restricciones
```

### 3.5 Cancelación

```
Usuario cancela desde Stripe Customer Portal o API
  → Stripe envía customer.subscription.deleted
  → Webhook: organizations.plan = 'free', subscriptions.status = 'canceled'
  → Email de confirmación
  → Sesiones invalidadas (JWT ya no tiene el claim del plan anterior)
```

---

## 4. Stripe Webhooks (6 eventos)

### 4.1 Arquitectura del Endpoint

```
POST /webhooks/stripe
  → Leer raw body (NO parsear con JSON antes de verificar)
  → Verificar stripe-signature con STRIPE_WEBHOOK_SECRET
  → Verificar idempotencia en billing_events.stripe_event_id
  → Encolar en BullMQ para procesamiento async
  → Responder 200 inmediatamente (< 5s)
```

### 4.2 Manejadores por Evento

| Evento Stripe | Handler | Acción en DB |
|---------------|---------|--------------|
| `customer.subscription.updated` | `handleSubscriptionUpdated` | Actualizar `organizations.plan`, upsert `subscriptions`, insert `billing_events`, invalidar sesiones |
| `customer.subscription.deleted` | `handleSubscriptionDeleted` | Set `organizations.plan='free'`, `subscriptions.status='canceled'`, email, invalidar sesiones |
| `invoice.payment_failed` | `handlePaymentFailed` | 1er intento: email + alerta; 3er intento: degradar a 'free', email de suspensión |
| `invoice.paid` | `handleInvoicePaid` | Si estaba suspendido: restaurar plan correcto, email de bienvenida si es primer pago |
| `payment_intent.succeeded` | `handlePaymentIntentSucceeded` | Logging — plan se actualiza por subscription.updated |
| `customer.subscription.trial_will_end` | `handleTrialWillEnd` | Email recordatorio 3 días antes |

### 4.3 Código de Referencia

```javascript
// webhook handler principal
async function handleStripeWebhook(event) {
    if (await billingEventExists(event.id)) return; // idempotencia

    switch (event.type) {
        case 'customer.subscription.updated':
            const sub = event.data.object;
            const newPlan = planFromPriceId(sub.items.data[0].price.id);
            const orgId = sub.metadata.organization_id;

            await db.update(organizations)
                .set({ plan: newPlan })
                .where(eq(organizations.id, orgId));

            await db.insert(subscriptions).values({
                organization_id: orgId,
                stripe_subscription_id: sub.id,
                stripe_customer_id: sub.customer,
                plan: newPlan,
                status: sub.status,
                current_period_start: new Date(sub.current_period_start * 1000),
                current_period_end: new Date(sub.current_period_end * 1000),
            }).onConflictDoUpdate({
                target: subscriptions.stripe_subscription_id,
                set: { plan: newPlan, status: sub.status,
                       current_period_end: new Date(sub.current_period_end * 1000),
                       updated_at: new Date() }
            });

            await invalidateOrgSessions(orgId);
            break;

        case 'invoice.payment_failed':
            if (attemptCount === 1) {
                await sendEmail('payment_failed_first', orgId, { amount });
                await createAlert(orgId, 'payment_failed', { ... });
            } else if (attemptCount >= 3) {
                await db.update(organizations).set({ plan: 'free' })
                    .where(eq(organizations.id, orgId));
                await sendEmail('payment_failed_suspended', orgId);
                await invalidateOrgSessions(orgId);
            }
            break;

        case 'invoice.paid':
            if (wasSuspended(org)) {
                await restorePlan(orgId);
                await invalidateOrgSessions(orgId);
            }
            if (isFirstPayment(orgId)) {
                await sendEmail('billing_welcome', orgId, { plan });
            }
            break;
    }

    await logBillingEvent(event, orgId, previousPlan, newPlan);
}
```

---

## 5. API REST de Billing

| Endpoint | Método | Auth | Descripción |
|----------|--------|------|-------------|
| `/billing/subscribe` | POST | JWT + owner | Iniciar suscripción a plan pago. Body: `{ plan, payment_method_id }`. Retorna `{ client_secret }` |
| `/billing/subscription` | PATCH | JWT + admin/owner | Cambiar plan. Body: `{ plan }` |
| `/billing/portal` | GET | JWT + admin/owner | Retorna URL del Stripe Customer Portal para autogestión |
| `/billing/invoices` | GET | JWT + admin/owner | Historial de facturas (desde Stripe) |
| `/billing/current` | GET | JWT | Retorna plan actual, estado, features disponibles |
| `/webhooks/stripe` | POST | Público (firma) | Webhook de Stripe (raw body) |

### Detalle de Endpoints

#### `POST /billing/subscribe`

```javascript
Request Body: { plan: 'pro' | 'business' | 'agency', payment_method_id: 'pm_...' }
Response 200: { client_secret: 'pi_..._secret_...' }
Errors:
  - 400: plan inválido o payment_method_id faltante
  - 402: PLAN_LIMIT_EXCEEDED
  - 409: ya tiene suscripción activa

Flow:
  1. Verificar que no haya subscription activa
  2. Crear Stripe Customer si no existe
  3. Attach payment method
  4. Crear subscription en Stripe
  5. Retornar client_secret para confirmación frontend
```

#### `PATCH /billing/subscription`

```javascript
Request Body: { plan: 'pro' | 'business' | 'agency' | 'free' }
Response 200: { success: true, effective_date: '2026-07-01' }
Errors:
  - 400: plan inválido o mismo plan actual
  - 404: no hay suscripción activa

Reglas:
  - Si newPlan > currentPlan → upgrade inmediato con prorrateo
  - Si newPlan < currentPlan → downgrade al final del período
  - Si newPlan = 'free' → cancel_at_period_end = true
```

#### `GET /billing/portal`

```javascript
Response 302: Redirect a Stripe Customer Portal URL
Flow:
  1. Verificar stripe_customer_id existe
  2. Crear sesión de portal con return_url = /settings/billing
  3. Retornar session.url
```

#### `GET /billing/current`

```javascript
Response 200: {
    plan: 'pro',
    effectivePlan: 'pro',       // considera trial
    trialEndsAt: null,
    status: 'active',
    features: {
        maxChannels: 5,
        postsUnlimited: true,
        botConversations: 1000
    },
    usage: {
        channels: 3,
        postsThisMonth: 15,
        botConversationsThisMonth: 234
    }
}
```

---

## 6. Plan Limiter — Enforcement de Cuotas

### 6.1 Middleware de Verificación

```javascript
// PLAN_LIMITS — fuente de verdad
const PLAN_LIMITS = {
    free:     { channels: 2, posts_month: 30, bot_conversations_month: 100 },
    pro:      { channels: 5, posts_month: -1, bot_conversations_month: 1000 },
    business: { channels: -1, posts_month: -1, bot_conversations_month: 5000 },
    agency:   { channels: -1, posts_month: -1, bot_conversations_month: -1 },
};

// getEffectivePlan — considera trial como Pro
function getEffectivePlan(org) {
    if (org.trial_ends_at && new Date() < new Date(org.trial_ends_at)) return 'pro';
    return org.plan;
}

// checkAndIncrementUsage — ejecutar ANTES de cada acción limitada
async function checkAndIncrementUsage(orgId, metric) {
    const org = await getOrganization(orgId);
    const effectivePlan = getEffectivePlan(org);
    const limit = PLAN_LIMITS[effectivePlan][metric];
    if (limit === -1) return; // ilimitado

    const period = new Date().toISOString().slice(0, 7); // '2026-06'
    const result = await pool.query(`
        INSERT INTO usage_counters (organization_id, metric, period, count)
        VALUES ($1, $2, $3, 1)
        ON CONFLICT (organization_id, metric, period)
        DO UPDATE SET count = usage_counters.count + 1
        RETURNING count
    `, [orgId, metric, period]);

    if (result.rows[0].count > limit) {
        throw new PlanLimitExceededError(metric, limit, effectivePlan);
    }
}
```

### 6.2 Dónde Aplicar Cada Límite

| Límite | Acción | Dónde implementar |
|--------|--------|-------------------|
| `channels` | Conectar nueva red social | `POST /channels/oauth/callback` |
| `posts_month` | Publicar o programar post | `POST /posts` o `POST /posts/:id/publish` |
| `bot_conversations_month` | Procesar mensaje de bot | `botQueue` worker, antes de procesar |

### 6.3 Error Response Estándar

```json
{
    "error": {
        "code": "PLAN_LIMIT_EXCEEDED",
        "message": "Has alcanzado el límite de 100 conversaciones del bot en tu plan Free",
        "upgrade_url": "/settings/billing"
    }
}
```

---

## 7. Emails de Billing (7 triggers)

### Catálogo Completo

| ID | Trigger | Asunto | Datos requeridos |
|----|---------|--------|-----------------|
| `billing_welcome` | `invoice.paid` (primer pago) | "Bienvenido al plan [Plan]" | `{ org_name, plan, amount, next_billing_date }` |
| `billing_upgrade` | `subscription.updated` (upgrade) | "Tu plan fue actualizado a [Plan]" | `{ org_name, new_plan, effective_date }` |
| `payment_failed_first` | `invoice.payment_failed` (1er intento) | "Problema con tu pago" | `{ org_name, amount, update_url, deadline }` |
| `payment_failed_suspended` | `invoice.payment_failed` (3er intento) | "Cuenta suspendida temporalmente" | `{ org_name, update_url }` |
| `subscription_canceled` | `subscription.deleted` | "Tu suscripción fue cancelada" | `{ org_name, access_until, reactivate_url }` |
| `trial_ending_soon` | Job 3 días antes de `trial_ends_at` | "Tu trial vence en 3 días" | `{ org_name, trial_ends_at, plans_url }` |
| `trial_expired` | Job cuando `trial_ends_at < NOW()` | "Tu período de prueba terminó" | `{ org_name, plans_url }` |

### Renderizado de Emails

```javascript
const EMAIL_TEMPLATES = {
    billing_welcome: (data) => ({
        subject: `Bienvenido al plan ${data.plan} — OmniPresence`,
        html: `<h1>¡Hola!</h1><p>Tu plan ${data.plan} está activo.</p>...`
    }),
    payment_failed_first: (data) => ({
        subject: 'Problema con tu pago — OmniPresence',
        html: `<p>No pudimos procesar tu pago de $${data.amount}.</p>...`
    }),
    // ... resto de plantillas
};

async function sendBillingEmail(templateId, orgId, data) {
    const org = await getOrganization(orgId);
    const to = org.billing_email || await getOrgOwnerEmail(orgId);
    const template = EMAIL_TEMPLATES[templateId](data);

    await resend.emails.send({
        from: 'OmniPresence <billing@omnipresence.io>',
        to,
        subject: template.subject,
        html: template.html,
    });
}
```

---

## 8. Stripe Customer Portal

### Propósito
Delegar la autogestión de facturación al portal de Stripe en lugar de construir UIs propias.

### Funcionalidades del Portal
- Cambiar método de pago (tarjeta)
- Ver historial de facturas y descargas
- Actualizar email de facturación
- Cancelar suscripción
- Ver próximo cobro

### Integración

```javascript
// GET /billing/portal
async function createBillingPortalSession(orgId) {
    const org = await getOrganization(orgId);
    if (!org.stripe_customer_id) {
        throw new Error('No billing account found');
    }

    const session = await stripe.billingPortal.sessions.create({
        customer: org.stripe_customer_id,
        return_url: `${FRONTEND_URL}/settings/billing`,
    });

    return session.url;
}
```

### Qué NO hacer manualmente
- ❌ No construir UI de cambio de tarjeta
- ❌ No mostrar historial de facturas desde DB
- ❌ No manejar cancelaciones manualmente
- ✅ Delegar todo al Stripe Customer Portal

---

## 9. Manejo de Pagos Fallidos

### Timeline

| Intento | Acción | Estado de la cuenta |
|---------|--------|---------------------|
| **1er fallido** | Email `payment_failed_first` + alerta in-app + notificación | Plan activo (período de gracia) |
| **2do fallido** | Stripe reintenta automáticamente (día 3) | Plan activo (período de gracia) |
| **3er fallido** | Email `payment_failed_suspended` | Degradado a Free (features premium restringidas) |
| **Pago exitoso** | Email `billing_welcome` o sin email si ya estaba | Plan restaurado al nivel correcto |

### Jobs Programados

```javascript
// Job diario: revisar subscriptions past_due
async function checkPastDueSubscriptions() {
    const pastDue = await db.query.subscriptions.findMany({
        where: and(
            eq(subscriptions.status, 'past_due'),
            lt(subscriptions.updated_at, subDays(new Date(), 7))
        )
    });

    for (const sub of pastDue) {
        // 7+ días en past_due sin resolver → cancelar
        await stripe.subscriptions.cancel(sub.stripe_subscription_id);
    }
}
```

---

## 10. Upgrade, Downgrade y Cancelación

### Upgrade (plan menor → plan mayor)

| Característica | Valor |
|----------------|-------|
| **Efectivo** | Inmediato |
| **Prorrateo** | Sí (create_prorations) — se cobra diferencia proporcional |
| **Pérdida de datos** | Ninguna |
| **Facturación** | Próximo ciclo normal, con ajuste prorrateado |

### Downgrade (plan mayor → plan menor pago)

| Característica | Valor |
|----------------|-------|
| **Efectivo** | Próximo ciclo de facturación |
| **Prorrateo** | No (proration_behavior: 'none') |
| **Pérdida de datos** | Datos se conservan pero se marcan over_limit |
| **Acceso** | Features del nuevo plan disponibles al inicio del próximo período |

### Downgrade a Free (cancelación)

| Característica | Valor |
|----------------|-------|
| **Efectivo** | Fin del período actual (cancel_at_period_end) |
| **Pérdida de datos** | No se elimina nada — solo se restringe acceso |
| **Bot** | Se desactiva automáticamente (is_active = false) |
| **Reactivación** | Posible vía Stripe Customer Portal antes del fin del período |

### Política de Datos Post-Downgrade

> Los datos existentes que exceden el nuevo límite NO se eliminan automáticamente. Se marcan como "over_limit" y:
> - El usuario puede verlos pero no crear nuevos
> - Se muestra banner in-app explicando qué está restringido
> - Si el usuario vuelve a un plan superior, los datos recuperan acceso completo

---

## 11. Trial de 14 Días

### Activación

```javascript
// Se activa automáticamente al crear la organización
async function createOrganization(userId, name) {
    const trialEndsAt = addDays(new Date(), 14);

    const org = await db.insert(organizations).values({
        name,
        slug: generateSlug(name),
        plan: 'free',
        trial_ends_at: trialEndsAt,
    }).returning();

    // Durante el trial, getEffectivePlan() retorna 'pro'
    return org[0];
}
```

### Reglas del Trial

- **Sin tarjeta requerida** — el usuario solo necesita email
- **Acceso a features Pro** — getEffectivePlan() retorna 'pro'
- **Sin límites** — usage_counters no se bloquean durante trial
- **Vencimiento:** a los 14 días, `trial_ends_at < NOW()` → getEffectivePlan() retorna `org.plan` (free)
- **Recordatorio:** email a 3 días del vencimiento
- **Post-trial:** el usuario puede seguir usando plan Free sin perder datos
- **Upgrade durante trial:** si se subscribe, `trial_ends_at` se setea a NULL y el plan cambia al pagado

### Jobs de Trial

```javascript
// Job diario: trial ending soon (3 días antes)
async function notifyTrialEndingSoon() {
    const expiring = await db.query.organizations.findMany({
        where: and(
            isNotNull(organizations.trial_ends_at),
            eq(organizations.plan, 'free'),
            between(
                organizations.trial_ends_at,
                addDays(new Date(), 3),
                addDays(new Date(), 4)
            )
        )
    });
    for (const org of expiring) {
        await sendBillingEmail('trial_ending_soon', org.id, {
            org_name: org.name,
            trial_ends_at: org.trial_ends_at,
            plans_url: `${FRONTEND_URL}/settings/billing`,
        });
    }
}

// Job diario: trial expired
async function notifyTrialExpired() {
    const expired = await db.query.organizations.findMany({
        where: and(
            isNotNull(organizations.trial_ends_at),
            eq(organizations.plan, 'free'),
            lt(organizations.trial_ends_at, new Date())
        )
    });
    for (const org of expired) {
        await sendBillingEmail('trial_expired', org.id, {
            org_name: org.name,
            plans_url: `${FRONTEND_URL}/settings/billing`,
        });
    }
}
```

---

## 12. Reglas de Negocio Críticas

1. **El plan en `organizations` SIEMPRE se actualiza desde webhooks de Stripe**, nunca directamente desde endpoints del usuario — excepto el downgrade a `free` por cancelación o pagos fallidos.

2. **Nunca hacer consultas de plan en el frontend** — el plan viene en el JWT claim `plan`, siempre verificar en el servidor.

3. **El trial da acceso a features de Pro** — `getEffectivePlan()` es la función canónica para verificar features, no leer `organizations.plan` directamente.

4. **Idempotencia en webhooks** — `billing_events.stripe_event_id` es UNIQUE para evitar procesamiento duplicado.

5. **Sesiones invalidadas tras cambio de plan** — para que el JWT refleje el nuevo plan inmediatamente.

6. **Sin exposición de `stripe_customer_id` al frontend** — solo uso interno en servidor.

7. **Modo test vs producción** — usar `STRIPE_SECRET_KEY` de test en staging, de producción solo en producción. Configurado por variable de entorno, nunca hardcodeado.

8. **Registrar TODOS los eventos de Stripe en `billing_events`** aunque no generen acción — para auditoría y soporte.

9. **En downgrade**: los datos existentes que exceden el nuevo límite se conservan pero se restringe el acceso a crear nuevos hasta que estén dentro del límite.

10. **Un tenant nunca ve datos de otro** — RLS en todas las tablas, incluyendo billing.

11. **`stripe_customer_id` se crea SOLO cuando el usuario intenta pagar** — no durante el registro.

12. **El webhook responde 200 en menos de 5 segundos** — procesar de forma asíncrona vía BullMQ.

---

## 13. Variables de Entorno

```bash
# .env — Billing & Stripe
STRIPE_SECRET_KEY=sk_test_YOUR_SECRET_KEY
STRIPE_WEBHOOK_SECRET=whsec_YOUR_WEBHOOK_SECRET
STRIPE_PRICE_PRO_MONTHLY=price_1PRO...
STRIPE_PRICE_BUSINESS_MONTHLY=price_1BIZ...
STRIPE_PRICE_AGENCY_MONTHLY=price_1AGENCY...
FRONTEND_URL=https://app.omnipresence.io

# API Keys de terceros (para emails)
RESEND_API_KEY=re_1234567890
```

### Validación al Inicio

```javascript
const REQUIRED_ENV_VARS = [
    'STRIPE_SECRET_KEY',
    'STRIPE_WEBHOOK_SECRET',
    'STRIPE_PRICE_PRO_MONTHLY',
    'STRIPE_PRICE_BUSINESS_MONTHLY',
    'STRIPE_PRICE_AGENCY_MONTHLY',
    'FRONTEND_URL',
];

function validateEnv() {
    const missing = REQUIRED_ENV_VARS.filter(v => !process.env[v]);
    if (missing.length > 0) {
        throw new Error(`Missing required env vars: ${missing.join(', ')}`);
    }
}
```

---

## 14. Checklist de Deploy

### Pre-Producción
- [ ] `STRIPE_SECRET_KEY` configurado con clave de TEST en staging
- [ ] `STRIPE_WEBHOOK_SECRET` configurado con el secreto del endpoint de test
- [ ] Products y Prices creados en Stripe Dashboard (modo test)
- [ ] Endpoint de webhook configurado en Stripe Dashboard: `POST /webhooks/stripe`
- [ ] Eventos suscritos en Stripe: `customer.subscription.updated`, `customer.subscription.deleted`, `invoice.payment_failed`, `invoice.paid`, `payment_intent.succeeded`, `customer.subscription.trial_will_end`
- [ ] Migration DB ejecutada: `subscriptions`, `billing_events`, `usage_counters`
- [ ] Tabla `usage_counters` creada con CHECK constraint correcto

### Producción
- [ ] `STRIPE_SECRET_KEY` cambiado a clave de LIVE
- [ ] `STRIPE_WEBHOOK_SECRET` cambiado al secreto del endpoint de LIVE
- [ ] Products y Prices creados en modo LIVE
- [ ] Endpoint de webhook de LIVE configurado en Stripe Dashboard
- [ ] Rate limiting activo en endpoint `/webhooks/stripe`
- [ ] Monitoreo de errores (Sentry/Datadog) para eventos de billing
- [ ] Emails transaccionales probados con Resend
- [ ] Portal de facturación probado (redirect + return)
- [ ] Tests de integración de billing pasando en CI

### Post-Deploy
- [ ] Probar suscripción completa: register → trial → upgrade → downgrade → cancel
- [ ] Probar pago fallido: tarjeta de prueba 4000000000000341 (declined)
- [ ] Probar 3D Secure: tarjeta de prueba 4000002500003155
- [ ] Verificar que `billing_events` registra todos los eventos
- [ ] Verificar que `usage_counters` incrementa correctamente
- [ ] Verificar que downgrade a Free desactiva bot (bot_configs.is_active = false)

---

## 15. Pruebas Requeridas

### Unitarias

| Test | Archivo | Descripción |
|------|---------|-------------|
| `getEffectivePlan` con trial activo | `plan-limits.test.js` | Debe retornar 'pro' durante trial |
| `getEffectivePlan` con trial vencido | `plan-limits.test.js` | Debe retornar el plan real |
| `checkAndIncrementUsage` sin límite | `plan-limits.test.js` | No debe lanzar error si hay cupo |
| `checkAndIncrementUsage` excedido | `plan-limits.test.js` | Debe lanzar `PlanLimitExceededError` |
| `planFromPriceId` / `priceIdFromPlan` | `billing.test.js` | Mapeo correcto de IDs |
| Stripe webhook signature verification | `billing.test.js` | Firma inválida → 400 |

### Integración

| Test | Descripción |
|------|-------------|
| Registro + trial | Verificar trial_ends_at = NOW()+14d, plan = 'free' |
| Upgrade a Pro | POST /billing/subscribe → webhook → plan = 'pro' |
| Downgrade a Free | PATCH → cancel_at_period_end = true |
| Pago fallido (1er intento) | Alerta + email generados, plan no cambia |
| Pago fallido (3er intento) | plan = 'free', email enviado, sesiones invalidadas |
| Límite de channels | Free: conectar 3er channel → 402 PLAN_LIMIT_EXCEEDED |
| Límite de bot_conversations | Free: enviar 101 mensajes → bloqueado |
| Idempotencia de webhook | Mismo evento → segunda vez responde 200 sin cambios |
| Stripe Customer Portal | GET /billing/portal → URL válida de Stripe |

### End-to-End

| Test | Descripción |
|------|-------------|
| Flujo completo | Register → onboarding → upgrade a Pro → usar features → conectar channels → cancelar → verificar downgrade |
| Pago con 3D Secure | Usar tarjeta de prueba 4000002500003155, confirmar autenticación |
| Ciclo de facturación | Esperar invoice final (simular con stripe test clock) |

---

## Apéndice A: Mapeo de Código a Skills

| Concepto | Skill de referencia |
|----------|-------------------|
| Planes y precios | SKILL_04 §1-2 |
| Flujo de suscripción | SKILL_04 §3 |
| Webhooks Stripe | SKILL_04 §4 |
| Portal de facturación | SKILL_04 §5 |
| Plan limiter middleware | SKILL_04 §6 + SKILL_01 §9 |
| Emails de billing | SKILL_04 §7 + SKILL_03 §14 |
| Reglas de negocio | SKILL_04 §8 |
| Variables de entorno | SKILL_04 §9 |
| Schema DB completo | SKILL_02 §2 |
| Tabla usage_counters | SKILL_02 §2 + SKILL_01 §9 |
| Error codes | SKILL_03 §15 |
| Frontend plan-limit-banner | SKILL_06 |

## Apéndice B: Stripe Modo Test

### Tarjetas de Prueba

| Número | Escenario |
|--------|-----------|
| `4242424242424242` | Pago exitoso (Visa) |
| `4000002500003155` | 3D Secure requerido |
| `4000000000000341` | Pago decline (genérico) |
| `4000000000003220` | Decline por insufficient_funds |
| `4000000000002000` | Decline por expired_card |

### Test Clock (Stripe)

Para simular ciclos de facturación sin esperar 30 días:
1. Crear un Test Clock en Stripe Dashboard
2. Avanzar el reloj a la fecha deseada
3. Los webhooks se disparan automáticamente
