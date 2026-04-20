# SKILL 04 — Billing y Suscripciones (Stripe)
## OmniPresence Suite · SaaS Multi-tenant

> **Propósito de este skill:** Define el ciclo completo de monetización de OmniPresence: desde la creación del customer en Stripe hasta el manejo de pagos fallidos, upgrades, downgrades, cancelaciones y el trial de 14 días. Cualquier código relacionado con billing, planes, pagos o suscripciones debe seguir estas definiciones sin excepción.

---

## 1. Modelo de datos de billing

### Campos de billing en `organizations`
```sql
-- Estos campos ya están en SKILL_02 — referencia para billing
organizations.plan              TEXT    -- 'free' | 'pro' | 'business' | 'agency'
organizations.stripe_customer_id TEXT   -- se crea en el primer pago, NULL hasta entonces
organizations.trial_ends_at    TIMESTAMPTZ -- NULL si nunca tuvo trial o ya terminó
organizations.billing_email    TEXT    -- puede diferir del owner email
```

### Tabla de eventos de billing (append-only, igual que audit_events)
```sql
CREATE TABLE billing_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id),
  stripe_event_id TEXT NOT NULL UNIQUE,       -- ID del evento de Stripe (idempotencia)
  event_type TEXT NOT NULL,                   -- ej: 'subscription.updated', 'invoice.paid'
  previous_plan TEXT,                         -- plan antes del cambio
  new_plan TEXT,                              -- plan después del cambio
  amount_usd NUMERIC(10,2),                   -- monto involucrado si aplica
  stripe_invoice_id TEXT,
  stripe_subscription_id TEXT,
  metadata JSONB DEFAULT '{}',                -- datos adicionales del evento
  processed_at TIMESTAMPTZ DEFAULT NOW()
  -- NO tiene updated_at — es append-only
);
CREATE INDEX idx_billing_events_org ON billing_events(organization_id, processed_at DESC);
```

### Tabla de suscripciones activas
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
  UNIQUE(organization_id)  -- una sola suscripción activa por org
);
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_iso ON subscriptions
  USING (organization_id = current_setting('app.current_org')::uuid);
```

---

## 2. Precios y productos en Stripe

### Configuración de productos (crear en Stripe Dashboard o con API)
```typescript
// IDs de Price en Stripe — guardar en variables de entorno
const STRIPE_PRICES = {
  pro_monthly:      process.env.STRIPE_PRICE_PRO_MONTHLY!,      // $29/mes
  business_monthly: process.env.STRIPE_PRICE_BUSINESS_MONTHLY!, // $59/mes
  agency_monthly:   process.env.STRIPE_PRICE_AGENCY_MONTHLY!,   // $89/mes
} as const;

// Mapeo plan → price_id
export function getPriceId(plan: 'pro' | 'business' | 'agency'): string {
  const priceId = STRIPE_PRICES[`${plan}_monthly`];
  if (!priceId) throw new Error(`No price configured for plan: ${plan}`);
  return priceId;
}

// Mapeo price_id → plan (para webhooks)
export function getPlanFromPriceId(priceId: string): string | null {
  const entry = Object.entries(STRIPE_PRICES).find(([, id]) => id === priceId);
  if (!entry) return null;
  return entry[0].replace('_monthly', ''); // 'pro', 'business', 'agency'
}
```

---

## 3. Flujos de billing

### 3.1 Registro + Trial de 14 días

El trial comienza automáticamente al crear la organización. No requiere tarjeta de crédito.

```typescript
// En el handler de POST /auth/register
async function createOrganizationWithTrial(userId: string, name: string): Promise<Organization> {
  const trialEndsAt = addDays(new Date(), 14);

  const org = await db.insert(organizations).values({
    name,
    slug: generateSlug(name),
    plan: 'free',       // Durante el trial el plan sigue siendo 'free' en features
    trial_ends_at: trialEndsAt,
    // stripe_customer_id: NULL — se crea cuando el usuario intenta pagar
  }).returning();

  return org[0];
}

// Verificar si el trial está activo
export function isTrialActive(org: Organization): boolean {
  if (!org.trial_ends_at) return false;
  return new Date() < new Date(org.trial_ends_at);
}

// Durante el trial: el usuario tiene acceso a features del plan Pro
// REGLA: el check de features usa esta función, no solo org.plan
export function getEffectivePlan(org: Organization): string {
  if (isTrialActive(org)) return 'pro'; // trial da acceso a pro
  return org.plan;
}
```

### 3.2 Upgrade de plan (Free/Trial → Pro/Business/Agency)

```typescript
// POST /billing/subscribe
// Body: { plan: 'pro' | 'business' | 'agency', payment_method_id: string }
async function subscribeToPlan(
  orgId: string,
  userId: string,
  plan: 'pro' | 'business' | 'agency',
  paymentMethodId: string
): Promise<{ clientSecret: string }> {

  const org = await getOrganization(orgId);

  // 1. Crear o recuperar Stripe Customer
  let stripeCustomerId = org.stripe_customer_id;
  if (!stripeCustomerId) {
    const user = await getUser(userId);
    const customer = await stripe.customers.create({
      email: org.billing_email || user.email,
      name: org.name,
      metadata: { organization_id: orgId },
    });
    stripeCustomerId = customer.id;
    await db.update(organizations)
      .set({ stripe_customer_id: stripeCustomerId })
      .where(eq(organizations.id, orgId));
  }

  // 2. Adjuntar método de pago al customer
  await stripe.paymentMethods.attach(paymentMethodId, { customer: stripeCustomerId });
  await stripe.customers.update(stripeCustomerId, {
    invoice_settings: { default_payment_method: paymentMethodId },
  });

  // 3. Crear suscripción
  const subscription = await stripe.subscriptions.create({
    customer: stripeCustomerId,
    items: [{ price: getPriceId(plan) }],
    payment_behavior: 'default_incomplete',
    expand: ['latest_invoice.payment_intent'],
    metadata: { organization_id: orgId },
  });

  const invoice = subscription.latest_invoice as Stripe.Invoice;
  const paymentIntent = invoice.payment_intent as Stripe.PaymentIntent;

  // IMPORTANTE: el plan en DB se actualiza SOLO cuando el webhook confirma el pago
  // NO actualizar organizations.plan aquí — hacerlo en el webhook

  await logAuditEvent('billing.subscribe_initiated', {
    orgId,
    plan,
    stripeSubscriptionId: subscription.id,
  });

  return { clientSecret: paymentIntent.client_secret! };
}
```

### 3.3 Upgrade entre planes pagos (Pro → Business/Agency)

```typescript
// PATCH /billing/subscription
// Body: { plan: 'business' | 'agency' }
async function upgradePlan(orgId: string, newPlan: 'business' | 'agency'): Promise<void> {
  const subscription = await getActiveSubscription(orgId);
  if (!subscription) throw new NotFoundError('No active subscription');

  const stripeSubscription = await stripe.subscriptions.retrieve(subscription.stripe_subscription_id);

  // Actualizar el item de la suscripción en Stripe (prorrateo automático)
  await stripe.subscriptions.update(subscription.stripe_subscription_id, {
    items: [{
      id: stripeSubscription.items.data[0].id,
      price: getPriceId(newPlan),
    }],
    proration_behavior: 'create_prorations', // cobra/acredita la diferencia proporcional
  });

  // El webhook subscription.updated actualizará el plan en DB
}
```

### 3.4 Downgrade de plan

```typescript
// PATCH /billing/subscription
// Body: { plan: 'pro' | 'free' }
async function downgradePlan(orgId: string, newPlan: 'pro' | 'free'): Promise<void> {
  const subscription = await getActiveSubscription(orgId);

  if (newPlan === 'free') {
    // Cancelar al final del período actual (no de inmediato)
    await stripe.subscriptions.update(subscription.stripe_subscription_id, {
      cancel_at_period_end: true,
    });
    // El webhook customer.subscription.deleted activará el downgrade a 'free'
  } else {
    // Downgrade a plan menor pagado: efectivo al próximo período
    await stripe.subscriptions.update(subscription.stripe_subscription_id, {
      items: [{
        id: (await stripe.subscriptions.retrieve(subscription.stripe_subscription_id)).items.data[0].id,
        price: getPriceId(newPlan),
      }],
      proration_behavior: 'none', // sin prorrateo en downgrade — efectivo el próximo ciclo
    });
  }

  await logAuditEvent('billing.downgrade_scheduled', { orgId, newPlan });
}

// Política de downgrade: qué pasa con los datos que exceden el nuevo límite
// REGLA: los datos NO se eliminan automáticamente — se marcan como "over_limit"
// El usuario pierde acceso a las funciones que exceden el límite pero conserva sus datos
// Cuando el límite se reduce, mostrar banner in-app explicando qué está restringido
```

---

## 4. Webhooks de Stripe

### Setup del endpoint
```typescript
// app/api/webhooks/stripe/route.ts (Next.js) o POST /webhooks/stripe (API)
// CRÍTICO: usar rawBody — NO parsear con JSON.parse antes de verificar firma
import Stripe from 'stripe';

export async function POST(req: Request) {
  const body = await req.text(); // rawBody como string
  const signature = req.headers.get('stripe-signature')!;

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(
      body,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET!
    );
  } catch (err) {
    return new Response('Webhook signature verification failed', { status: 400 });
  }

  // Idempotencia: verificar si ya procesamos este evento
  const existing = await db.query.billing_events.findFirst({
    where: eq(billing_events.stripe_event_id, event.id),
  });
  if (existing) {
    return new Response('Already processed', { status: 200 }); // responder 200 siempre
  }

  // Procesar de forma asíncrona — responder 200 ANTES de procesar
  await queue.add('process_stripe_webhook', { event });
  return new Response('Received', { status: 200 });
}
```

### Manejadores por tipo de evento
```typescript
// Job: process_stripe_webhook
async function handleStripeEvent(event: Stripe.Event): Promise<void> {
  switch (event.type) {

    case 'payment_intent.succeeded': {
      // Primera suscripción completada — activar plan
      const paymentIntent = event.data.object as Stripe.PaymentIntent;
      const orgId = paymentIntent.metadata.organization_id;
      // El plan se actualiza en subscription.updated que sigue a este evento
      break;
    }

    case 'customer.subscription.updated': {
      const subscription = event.data.object as Stripe.Subscription;
      const orgId = subscription.metadata.organization_id;
      const newPriceId = subscription.items.data[0].price.id;
      const newPlan = getPlanFromPriceId(newPriceId) ?? 'free';
      const previousPlan = (event.data.previous_attributes as any)?.items?.data?.[0]?.price?.id
        ? getPlanFromPriceId((event.data.previous_attributes as any).items.data[0].price.id)
        : undefined;

      await db.update(organizations)
        .set({ plan: newPlan })
        .where(eq(organizations.id, orgId));

      await db.insert(subscriptions).values({
        organization_id: orgId,
        stripe_subscription_id: subscription.id,
        stripe_customer_id: subscription.customer as string,
        plan: newPlan as any,
        status: subscription.status as any,
        current_period_start: new Date(subscription.current_period_start * 1000),
        current_period_end: new Date(subscription.current_period_end * 1000),
      }).onConflictDoUpdate({
        target: subscriptions.stripe_subscription_id,
        set: { plan: newPlan as any, status: subscription.status as any,
               current_period_end: new Date(subscription.current_period_end * 1000),
               updated_at: new Date() },
      });

      // Registrar en billing_events
      await db.insert(billing_events).values({
        organization_id: orgId,
        stripe_event_id: event.id,
        event_type: event.type,
        previous_plan: previousPlan ?? undefined,
        new_plan: newPlan,
        stripe_subscription_id: subscription.id,
      });

      // Invalidar JWT activos del org — el claim 'plan' debe actualizarse
      await invalidateOrgSessions(orgId);

      await logAuditEvent('billing.plan_changed', { orgId, previousPlan, newPlan });
      break;
    }

    case 'customer.subscription.deleted': {
      // Suscripción cancelada (fin del período o inmediata)
      const subscription = event.data.object as Stripe.Subscription;
      const orgId = subscription.metadata.organization_id;

      await db.update(organizations)
        .set({ plan: 'free' })
        .where(eq(organizations.id, orgId));

      await db.update(subscriptions)
        .set({ status: 'canceled', canceled_at: new Date(), updated_at: new Date() })
        .where(eq(subscriptions.organization_id, orgId));

      await db.insert(billing_events).values({
        organization_id: orgId,
        stripe_event_id: event.id,
        event_type: event.type,
        previous_plan: getPlanFromPriceId(subscription.items.data[0].price.id) ?? 'unknown',
        new_plan: 'free',
        stripe_subscription_id: subscription.id,
      });

      await invalidateOrgSessions(orgId);
      await sendEmail('subscription_canceled', orgId);
      await logAuditEvent('billing.subscription_canceled', { orgId });
      break;
    }

    case 'invoice.payment_failed': {
      // Pago fallido — iniciar período de gracia
      const invoice = event.data.object as Stripe.Invoice;
      const customerId = invoice.customer as string;
      const org = await getOrgByStripeCustomer(customerId);
      if (!org) break;

      const attemptCount = invoice.attempt_count;

      if (attemptCount === 1) {
        // Primer intento fallido: notificar + gracia de 7 días
        await sendEmail('payment_failed_first', org.id, { amount: invoice.amount_due / 100 });
        await createAlert(org.id, 'payment_failed', {
          message: 'Hubo un problema con tu pago. Por favor actualiza tu método de pago.',
          context_data: { invoice_url: invoice.hosted_invoice_url },
        });
      } else if (attemptCount >= 3) {
        // Intentos agotados: suspender acceso a features premium
        await db.update(organizations)
          .set({ plan: 'free' })   // degradar a free hasta que se resuelva
          .where(eq(organizations.id, org.id));
        await sendEmail('payment_failed_suspended', org.id);
        await invalidateOrgSessions(org.id);
      }

      await db.insert(billing_events).values({
        organization_id: org.id,
        stripe_event_id: event.id,
        event_type: event.type,
        amount_usd: invoice.amount_due / 100,
        stripe_invoice_id: invoice.id,
      });
      break;
    }

    case 'invoice.paid': {
      // Pago exitoso — reiniciar acceso si estaba suspendido
      const invoice = event.data.object as Stripe.Invoice;
      const customerId = invoice.customer as string;
      const org = await getOrgByStripeCustomer(customerId);
      if (!org) break;

      // Si la org fue suspendida por pago fallido, restaurar el plan correcto
      const subscription = await stripe.subscriptions.retrieve(invoice.subscription as string);
      const correctPlan = getPlanFromPriceId(subscription.items.data[0].price.id) ?? 'free';

      if (org.plan !== correctPlan) {
        await db.update(organizations)
          .set({ plan: correctPlan })
          .where(eq(organizations.id, org.id));
        await invalidateOrgSessions(org.id);
      }

      await db.insert(billing_events).values({
        organization_id: org.id,
        stripe_event_id: event.id,
        event_type: event.type,
        amount_usd: invoice.amount_paid / 100,
        stripe_invoice_id: invoice.id,
      });
      break;
    }
  }
}
```

---

## 5. Portal de facturación (Stripe Customer Portal)

```typescript
// GET /billing/portal — genera URL del portal de facturación de Stripe
// El usuario puede actualizar su tarjeta, ver facturas, cancelar desde el portal
async function createBillingPortalSession(orgId: string): Promise<string> {
  const org = await getOrganization(orgId);
  if (!org.stripe_customer_id) {
    throw new BadRequestError('No billing account found. Subscribe to a plan first.');
  }

  const session = await stripe.billingPortal.sessions.create({
    customer: org.stripe_customer_id,
    return_url: `${process.env.FRONTEND_URL}/settings/billing`,
  });

  return session.url;
}
// El portal de Stripe maneja: cambio de tarjeta, historial de facturas,
// descarga de receipts, cancelación de suscripción.
// NO construir estas funciones manualmente — delegar al portal.
```

---

## 6. Verificación de plan en endpoints

```typescript
// Middleware: verificar que el plan permite la acción solicitada
// Se ejecuta DESPUÉS del middleware de auth

import { PLAN_LIMITS } from './plan-limits';

export async function checkPlanLimit(
  orgId: string,
  metric: keyof typeof PLAN_LIMITS.free,
  userId?: string
): Promise<void> {
  const org = await getOrganization(orgId);
  const effectivePlan = getEffectivePlan(org); // considera trial

  const limit = PLAN_LIMITS[effectivePlan as keyof typeof PLAN_LIMITS]?.[metric];
  if (limit === -1 || limit === undefined) return; // ilimitado o no aplica

  const period = new Date().toISOString().slice(0, 7);
  const result = await db.execute(sql`
    INSERT INTO usage_counters (organization_id, metric, period, count)
    VALUES (${orgId}, ${metric}, ${period}, 1)
    ON CONFLICT (organization_id, metric, period)
    DO UPDATE SET count = usage_counters.count + 1
    RETURNING count
  `);

  if (result.rows[0].count > limit) {
    throw new PlanLimitExceededError(metric, limit, effectivePlan);
  }
}

// Respuesta de error estándar para límite excedido
class PlanLimitExceededError extends Error {
  constructor(metric: string, limit: number, plan: string) {
    super(`Has alcanzado el límite de ${limit} ${metric} en tu plan ${plan}`);
    this.name = 'PlanLimitExceededError';
  }
  toHTTP() {
    return {
      status: 402,
      error: {
        code: 'PLAN_LIMIT_EXCEEDED',
        message: this.message,
        upgrade_url: '/settings/billing',
      }
    };
  }
}
```

---

## 7. Emails de billing

| Trigger | Email | Contenido |
|---------|-------|-----------|
| `subscription.updated` (upgrade) | `billing_upgrade` | "Tu plan fue actualizado a [plan]. Gracias." |
| `subscription.deleted` | `subscription_canceled` | "Tu suscripción fue cancelada. Volverás al plan Free el [fecha]." |
| `invoice.payment_failed` (1er intento) | `payment_failed_first` | "No pudimos procesar tu pago de $[X]. Actualiza tu tarjeta antes del [fecha]." |
| `invoice.payment_failed` (3er intento) | `payment_failed_suspended` | "Tu cuenta fue suspendida temporalmente. Actualiza tu método de pago para reactivarla." |
| `invoice.paid` (primer pago) | `billing_welcome` | "¡Bienvenido al plan [plan]! Aquí está tu recibo." |
| Trial a 3 días de vencer | `trial_ending_soon` | "Tu trial vence en 3 días. Suscríbete para no perder acceso." |
| Trial vencido | `trial_expired` | "Tu trial terminó. Elige un plan para seguir usando todas las funciones." |

---

## 8. Reglas de negocio críticas de billing

1. **El plan en `organizations` SIEMPRE se actualiza desde webhooks de Stripe**, nunca directamente desde endpoints del usuario — excepto el downgrade a `free` por cancelación
2. **Nunca hacer consultas de plan en el frontend** — el plan viene en el JWT claim `plan`, siempre verificar en el servidor
3. **El trial da acceso a features de Pro** — `getEffectivePlan()` es la función canónica para verificar features, no leer `organizations.plan` directamente
4. **En downgrade**: los datos existentes que exceden el nuevo límite se conservan pero se restringe el acceso a crear nuevos hasta que estén dentro del límite
5. **`stripe_customer_id` nunca se expone al frontend** — solo para uso interno en el servidor
6. **Modo test vs producción**: usar `STRIPE_SECRET_KEY` de test en staging, de producción solo en producción — configurado por variable de entorno, nunca hardcoded
7. **Registrar TODOS los eventos de Stripe en `billing_events`** aunque no generen acción — para auditoría y soporte

---

## 9. Variables de entorno de billing

```bash
# .env.example — billing
STRIPE_SECRET_KEY=sk_test_...              # sk_live_... en producción
STRIPE_WEBHOOK_SECRET=whsec_...           # desde el dashboard de Stripe
STRIPE_PRICE_PRO_MONTHLY=price_...        # ID del precio mensual Pro
STRIPE_PRICE_BUSINESS_MONTHLY=price_...  # ID del precio mensual Business
STRIPE_PRICE_AGENCY_MONTHLY=price_...    # ID del precio mensual Agency
FRONTEND_URL=https://app.omnipresence.io  # para return_url del portal
```

---

## Checklist de billing — antes de cada deploy

- [ ] `STRIPE_WEBHOOK_SECRET` configurado en el ambiente destino
- [ ] Todos los eventos de Stripe relevantes están suscritos en el dashboard de Stripe
- [ ] Endpoint de webhook responde 200 ANTES de procesar (no en la misma request)
- [ ] Idempotencia verificada: `billing_events.stripe_event_id` es UNIQUE
- [ ] `getEffectivePlan()` usado en todos los checks de features (no `org.plan` directo)
- [ ] Plan actualizado solo desde webhooks, nunca desde acción directa del usuario
- [ ] Sesiones invalidadas tras cambio de plan (`invalidateOrgSessions`)
- [ ] Emails transaccionales configurados para los 7 triggers listados
- [ ] Modo test en staging, modo live en producción
