# SKILL 01 — Seguridad y Parámetros
## OmniPresence Suite · SaaS Multi-tenant

> **Propósito de este skill:** Define las reglas, restricciones, patrones y configuraciones de seguridad que aplican a **toda** la plataforma. Cualquier módulo, feature o integración que se construya debe respetar estas definiciones. Son no negociables.

---

## 1. Modelo de multi-tenancy

### Estrategia elegida: Row-Level Security (RLS) en PostgreSQL

Cada tenant es una `organization`. Toda tabla de datos de negocio incluye `organization_id UUID NOT NULL`. La base de datos hace cumplir el aislamiento por sí misma, independientemente del código de aplicación.

### Implementación obligatoria

**En cada tabla de datos:**
```sql
ALTER TABLE <tabla> ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON <tabla>
  USING (organization_id = current_setting('app.current_org')::uuid);
```

**En cada request autenticado (middleware):**
```typescript
// Antes de cualquier query a la DB
await db.execute(sql`SET LOCAL app.current_org = ${orgId}`);
```

**Regla absoluta:** El `organization_id` nunca viene del frontend. Siempre se extrae del JWT firmado por el servidor.

### Tablas que NO llevan organization_id
- `users` — aisladas por `memberships`
- `plans` — catálogo global de planes
- `audit_events` — tienen `organization_id` pero sin RLS (append-only, solo escritura desde servidor)

---

## 2. Autenticación y sesiones

### Flujo de tokens
| Token | Tipo | TTL | Almacenamiento |
|-------|------|-----|----------------|
| Access token | JWT firmado (RS256) | 15 minutos | Memoria del cliente (no localStorage) |
| Refresh token | Opaco, 64 bytes random | 30 días | `httpOnly; Secure; SameSite=Strict` cookie |
| Session ID | UUID v4 | Igual al refresh token | Tabla `sessions` en DB |

### Claims obligatorios en JWT
```json
{
  "sub": "uuid-del-usuario",
  "org": "uuid-de-la-organization",
  "role": "owner|admin|member|viewer",
  "plan": "free|pro|business|agency",
  "jti": "uuid-unico-del-token",
  "iat": 1234567890,
  "exp": 1234568790
}
```

### Invalidación de sesiones
- Refresh tokens se guardan hasheados (`SHA-256`) en tabla `sessions`
- Al logout: marcar sesión como `revoked_at = NOW()`
- Al cambio de contraseña: revocar **todas** las sesiones del usuario
- Al downgrade de plan: revocar sesiones con permisos superiores
- Al cambio de plan (upgrade o downgrade): invocar `invalidateOrgSessions(orgId)` para que el nuevo claim `plan` entre en vigor en el próximo refresh

### MFA
- TOTP (Google Authenticator compatible) — obligatorio para roles `owner` y `admin` en plan Business+
- Códigos de backup: 10 códigos de un solo uso, cifrados en DB
- Recovery vía email con token de 1 uso y 15 min de expiración

---

## 3. OAuth tokens de redes sociales — manejo crítico

Las credenciales OAuth de Meta/TikTok/LinkedIn son el activo más sensible del sistema. Dan acceso a publicar, leer DMs y ver datos de inversión del negocio del cliente.

### Regla principal: nunca en texto plano en la DB

```typescript
// CIFRADO antes de guardar
const { encrypted, iv } = encryptAES256GCM(rawToken, process.env.TOKEN_ENCRYPTION_KEY);
await db.insert(social_connections).values({
  organization_id: orgId,
  platform: 'facebook',
  encrypted_token: encrypted,  // Buffer/Bytea
  token_iv: iv,                // Buffer/Bytea
  expires_at: tokenExpiry,
});

// DESCIFRADO solo en el momento de uso, en memoria
const rawToken = decryptAES256GCM(row.encrypted_token, row.token_iv, process.env.TOKEN_ENCRYPTION_KEY);
// Usar y descartar — nunca logear, nunca serializar a JSON de respuesta
```

### Esquema de la tabla
```sql
CREATE TABLE social_connections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  platform TEXT NOT NULL CHECK (platform IN ('facebook','instagram','tiktok','linkedin','google')),
  platform_account_id TEXT NOT NULL,
  username TEXT,
  encrypted_token BYTEA NOT NULL,
  token_iv BYTEA NOT NULL,
  encrypted_refresh_token BYTEA,
  refresh_token_iv BYTEA,
  token_expires_at TIMESTAMPTZ,
  scopes TEXT[],
  is_active BOOLEAN DEFAULT true,
  connected_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(organization_id, platform, platform_account_id)
);
ALTER TABLE social_connections ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON social_connections
  USING (organization_id = current_setting('app.current_org')::uuid);
```

### Rotación y expiración
- Job diario revisa tokens con `token_expires_at < NOW() + INTERVAL '7 days'`
- Alerta automática al owner de la org 7 días antes del vencimiento (email `token_expiring`)
- Refresh automático cuando el proveedor lo permite (Meta long-lived tokens: 60 días)
- Si el refresh falla: marcar `is_active = false`, crear alerta, NO desconectar silenciosamente

---

## 4. Verificación de webhooks externos

Meta (Facebook/Instagram), TikTok y LinkedIn envían eventos via webhook. Todo webhook entrante debe verificarse criptográficamente antes de procesarse.

### Meta Webhooks
```typescript
function verifyMetaWebhook(rawBody: Buffer, signatureHeader: string): boolean {
  const expected = crypto
    .createHmac('sha256', process.env.META_APP_SECRET!)
    .update(rawBody)          // rawBody ANTES de JSON.parse — crítico
    .digest('hex');
  const received = signatureHeader.replace('sha256=', '');
  // timingSafeEqual previene timing attacks
  return crypto.timingSafeEqual(
    Buffer.from(expected, 'hex'),
    Buffer.from(received, 'hex')
  );
}

// Middleware que va ANTES de cualquier body parser en la ruta de webhooks
app.post('/webhooks/meta', rawBodyMiddleware, (req, res) => {
  if (!verifyMetaWebhook(req.rawBody, req.headers['x-hub-signature-256'])) {
    return res.status(401).end();
  }
  // Responder 200 INMEDIATAMENTE — procesar en background vía BullMQ
  res.status(200).end();
  queue.add('process_meta_webhook', { body: req.body });
});
```

### Webhook de Stripe
```typescript
// POST /webhooks/stripe — SIEMPRE usar rawBody antes de parsear
export async function handleStripeWebhook(req: Request, res: Response) {
  const rawBody = await req.text();
  const signature = req.headers.get('stripe-signature')!;
  try {
    stripe.webhooks.constructEvent(rawBody, signature, process.env.STRIPE_WEBHOOK_SECRET!);
  } catch {
    return res.status(400).end();
  }
  res.status(200).end(); // responder 200 antes de procesar
  queue.add('process_stripe_webhook', { rawBody });
}
```

### Idempotencia de webhooks
```sql
CREATE TABLE webhook_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  platform TEXT NOT NULL,
  platform_event_id TEXT NOT NULL,   -- ID único del evento según la plataforma
  organization_id UUID,
  processed_at TIMESTAMPTZ,
  status TEXT DEFAULT 'pending',      -- pending / processed / failed
  UNIQUE(platform, platform_event_id) -- evita duplicados
);
```
Si el evento ya existe en `webhook_events`: responder 200 y no procesar. Meta reintenta hasta 5 veces.

---

## 5. Seguridad de media storage

Los assets (imágenes, videos) se almacenan en MinIO (self-hosted) o Cloudflare R2.

### Estructura de paths
```
/{organization_id}/assets/{asset_id}.{ext}
/{organization_id}/variants/{asset_id}/{platform}_{format}.{ext}
/{organization_id}/knowledge/{doc_id}/{chunk_id}.txt
```

### Acceso vía URLs firmadas (OBLIGATORIO)
```typescript
// Nunca exponer el path directo. Siempre URL firmada con expiración.
async function getSignedUrl(storageKey: string, expiresInSeconds = 900): Promise<string> {
  return await storage.getSignedUrl(storageKey, {
    expiresIn: expiresInSeconds, // 15 minutos por defecto
  });
}

// En la API: verificar que el storage_key pertenece al org del request
const asset = await db.query.assets.findFirst({
  where: and(eq(assets.id, assetId), eq(assets.organization_id, orgId))
});
if (!asset) throw new ForbiddenError();
return { url: await getSignedUrl(asset.storage_key) };
```

### Validación de uploads
```typescript
const ALLOWED_MIME_TYPES = ['image/jpeg','image/png','image/webp','video/mp4','video/quicktime'];
const MAX_FILE_SIZE_BYTES = 100 * 1024 * 1024; // 100MB

// Validar MIME por magic bytes, no solo por extensión o Content-Type del cliente
import fileType from 'file-type';
const detected = await fileType.fromBuffer(buffer.slice(0, 4100));
if (!ALLOWED_MIME_TYPES.includes(detected?.mime ?? '')) {
  throw new ValidationError('Tipo de archivo no permitido');
}
```

---

## 6. Aislamiento del bot IA y knowledge base

### Búsqueda vectorial con filtro de tenant PRIMERO
```sql
-- CORRECTO: filtrar por org antes del cálculo de distancia vectorial
SELECT content, 1 - (embedding <=> $1) AS similarity
FROM knowledge_chunks
WHERE organization_id = $2          -- filtro de tenant primero
  AND is_active = true
  AND deleted_at IS NULL
  AND 1 - (embedding <=> $1) > 0.72
ORDER BY similarity DESC
LIMIT 5;
```

### Índice para búsqueda eficiente y aislada
```sql
CREATE INDEX idx_knowledge_chunks_org_embedding
ON knowledge_chunks USING hnsw (embedding vector_cosine_ops)
WITH (m = 16, ef_construction = 64)
WHERE is_active = true AND deleted_at IS NULL;
-- Considerar índice parcial por org para tenants con knowledge base grande
```

### Prompt del bot — inyección segura del contexto
```typescript
function buildSystemPrompt(orgContext: OrgBotConfig, chunks: string[]): string {
  return `Eres el asistente de atención al cliente de "${orgContext.businessName}".
Tu ÚNICO conocimiento válido es el siguiente contexto del negocio:

${chunks.map((c, i) => `[${i+1}] ${c}`).join('\n\n')}

REGLAS ABSOLUTAS:
- Solo respondes preguntas relacionadas con ${orgContext.businessName}
- Si no tienes información suficiente, dices "No tengo esa información, te comunico con un asesor"
- Nunca revelas que eres una IA a menos que el usuario pregunte directamente
- Nunca mencionas otras empresas, competidores, ni información externa al contexto dado
- Tono: ${orgContext.botTone}`;
}
```

---

## 7. Rate limiting y protección de API

### Niveles de rate limiting

| Nivel | Límite | Ventana | Acción |
|-------|--------|---------|--------|
| Global por IP | 1000 req | 15 min | 429 + Retry-After header |
| Por usuario autenticado | 300 req | 1 min | 429 |
| Endpoint de login | 10 intentos | 15 min | 429 + bloqueo temporal |
| Webhooks entrantes | 500 req | 1 min | 429 |
| Upload de assets | 20 archivos | 1 hora | 429 por org |
| Endpoint de registro | 5 intentos | 15 min | 429 |
| Forgot password | 3 intentos | 30 min | 429 |

### Headers de seguridad obligatorios
```typescript
// Helmet.js o equivalente
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"], // Tailwind requiere inline
      imgSrc: ["'self'", "data:", "*.r2.dev", "*.cloudfront.net"],
      connectSrc: ["'self'", "https://api.anthropic.com"],
      frameSrc: ["'none'"],
    }
  },
  hsts: { maxAge: 31536000, includeSubDomains: true, preload: true },
  referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
}));
```

### CORS
```typescript
const ALLOWED_ORIGINS = [
  process.env.FRONTEND_URL,          // app.omnipresence.io
  process.env.AGENCY_PORTAL_URL,     // agency.omnipresence.io (futuro)
].filter(Boolean);

app.use(cors({
  origin: (origin, callback) => {
    if (!origin || ALLOWED_ORIGINS.includes(origin)) callback(null, true);
    else callback(new Error('CORS not allowed'));
  },
  credentials: true, // necesario para cookies httpOnly
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
}));
```

---

## 8. Audit log — trazabilidad total

### Tabla inmutable
```sql
CREATE TABLE audit_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL,
  actor_user_id UUID,                  -- NULL si es acción de sistema/bot
  actor_type TEXT DEFAULT 'user' CHECK (actor_type IN ('user','system','bot','api')),
  action TEXT NOT NULL,                -- ej: 'post.created', 'channel.connected', 'lead.converted'
  resource_type TEXT,                  -- ej: 'post', 'lead', 'social_connection'
  resource_id UUID,
  metadata JSONB DEFAULT '{}',         -- datos adicionales sin PII sensible
  ip_address INET,
  user_agent TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW() -- NO tiene updated_at — es inmutable
) PARTITION BY RANGE (created_at);
-- Solo INSERT permitido — nunca UPDATE ni DELETE en esta tabla

CREATE TABLE audit_events_2025_q2 PARTITION OF audit_events
  FOR VALUES FROM ('2025-04-01') TO ('2025-07-01');
```

### Acciones que SIEMPRE generan audit event
- `auth.login`, `auth.logout`, `auth.login_failed`, `auth.mfa_enabled`, `auth.password_changed`
- `channel.connected`, `channel.disconnected`, `channel.token_refreshed`
- `post.created`, `post.published`, `post.failed`, `post.deleted`
- `lead.created`, `lead.status_changed`, `lead.converted`, `lead.gdpr_erased`
- `bot.trained`, `bot.activated`, `bot.deactivated`
- `knowledge.uploaded`, `knowledge.deleted`, `knowledge.replaced`
- `org.plan_changed`, `org.member_added`, `org.member_removed`
- `asset.uploaded`, `asset.deleted`
- `billing.subscribe_initiated`, `billing.plan_changed`, `billing.subscription_canceled`

---

## 9. Enforcement de planes y cuotas

### Tabla de contadores de uso
```sql
CREATE TABLE usage_counters (
  organization_id UUID NOT NULL REFERENCES organizations(id),
  metric TEXT NOT NULL,    -- 'bot_conversations', 'posts_published', 'channels_connected'
  period TEXT NOT NULL,    -- formato: '2025-04' (año-mes)
  count INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (organization_id, metric, period)
);
```

### Función de verificación (ejecutar ANTES de cada acción limitada)
```typescript
const PLAN_LIMITS = {
  free:     { channels: 2, posts_month: 30, bot_conversations_month: 100 },
  pro:      { channels: 5, posts_month: -1, bot_conversations_month: 1000 },  // -1 = ilimitado
  business: { channels: -1, posts_month: -1, bot_conversations_month: 5000 },
  agency:   { channels: -1, posts_month: -1, bot_conversations_month: -1 },
} as const;

async function checkAndIncrementUsage(
  orgId: string, plan: string, metric: keyof typeof PLAN_LIMITS.free
): Promise<void> {
  const limit = PLAN_LIMITS[plan][metric];
  if (limit === -1) return; // ilimitado

  const period = new Date().toISOString().slice(0, 7); // '2025-04'
  const result = await db.execute(sql`
    INSERT INTO usage_counters (organization_id, metric, period, count)
    VALUES (${orgId}, ${metric}, ${period}, 1)
    ON CONFLICT (organization_id, metric, period)
    DO UPDATE SET count = usage_counters.count + 1
    RETURNING count
  `);

  if (result.rows[0].count > limit) {
    throw new PlanLimitExceededError(metric, limit, plan);
  }
}

// SIEMPRE usar esta función en lugar de leer org.plan directamente
// El trial activo otorga acceso a features del plan Pro
export function getEffectivePlan(org: { plan: string; trial_ends_at: string | null }): string {
  if (org.trial_ends_at && new Date() < new Date(org.trial_ends_at)) return 'pro';
  return org.plan;
}
```

---

## 10. Variables de entorno y secretos

### Clasificación de secretos
| Variable | Descripción | Nunca en |
|----------|-------------|----------|
| `DATABASE_URL` | URL completa con credenciales | Logs, código fuente, respuestas API |
| `JWT_PRIVATE_KEY` | RS256 para firmar tokens | Ningún lado excepto el proceso |
| `TOKEN_ENCRYPTION_KEY` | AES-256 para OAuth tokens | DB (solo el encrypted output) |
| `META_APP_SECRET` | Verificación de webhooks Meta | Frontend, logs |
| `STRIPE_WEBHOOK_SECRET` | Verificación de webhooks Stripe | Frontend, logs |
| `OPENAI_API_KEY` / `ANTHROPIC_API_KEY` | LLM calls | Frontend |
| `STORAGE_ACCESS_KEY` | MinIO/R2 acceso | Frontend, logs |
| `HCAPTCHA_SECRET_KEY` | Verificación CAPTCHA server-side | Frontend |

### Reglas
- Rotación de `TOKEN_ENCRYPTION_KEY` requiere re-cifrar todos los tokens — planificar con migration script
- En producción: usar HashiCorp Vault o AWS Secrets Manager, no `.env` en disco
- En CI/CD: usar secrets del repositorio (GitHub Actions secrets), nunca en el código
- Nunca hacer `console.log(process.env)` en producción
- Logging con Pino: configurar `redact` para eliminar automáticamente campos sensibles de los logs

---

## 11. Protección de datos personales (leads y conversaciones)

Los leads son personas reales. Sus conversaciones son datos personales.

### Política de retención
- Conversaciones activas: retención indefinida mientras el lead esté activo
- Leads marcados `lost` hace más de 12 meses: archivado (datos anonimizados excepto `conversion_value`)
- Eliminación por petición: `DELETE /api/leads/{id}/gdpr-erase` — anonimiza PII
- `contact_identifier` (email/teléfono) se almacena cifrado, nunca en texto plano

### Anonimización de lead
```typescript
async function gdprEraseLead(leadId: string, orgId: string): Promise<void> {
  await db.update(leads).set({
    display_name: '[eliminado]',
    contact_identifier: null,
    platform_user_id: `erased_${crypto.randomUUID()}`, // mantiene unicidad sin PII
    deleted_at: new Date(),
  }).where(and(eq(leads.id, leadId), eq(leads.organization_id, orgId)));
  // Mantener conversion_value y analytics — son datos del negocio, no personales
  await logAuditEvent('lead.gdpr_erased', { orgId, leadId });
}
```

---

## 12. Silent refresh del access token

El access token vive en memoria del cliente (15 min). Al vencer, el cliente realiza un refresh silencioso usando la cookie httpOnly, sin interrupción para el usuario.

### Endpoint de refresh
```typescript
// POST /auth/refresh — recibe el refresh token desde cookie httpOnly automáticamente
// NO requiere Authorization header
async function refreshSession(req: Request): Promise<{ accessToken: string }> {
  const refreshToken = req.cookies['refresh_token'];
  if (!refreshToken) throw new UnauthorizedException();

  const tokenHash = crypto.createHash('sha256').update(refreshToken).digest('hex');

  const session = await db.query.sessions.findFirst({
    where: and(
      eq(sessions.token_hash, tokenHash),
      isNull(sessions.revoked_at),
      gt(sessions.expires_at, new Date())
    ),
    with: { organization: true },
  });

  if (!session) throw new UnauthorizedException('Session expired or revoked');

  const newAccessToken = generateAccessToken({
    sub: session.user_id,
    org: session.organization_id,
    role: session.membership_role,
    plan: getEffectivePlan(session.organization), // refleja trial activo correctamente
  });

  return { accessToken: newAccessToken };
}
```

### Invalidación masiva de sesiones de una org
```typescript
// Usar tras cambio de plan para que el nuevo claim 'plan' entre en vigor inmediatamente
async function invalidateOrgSessions(orgId: string): Promise<void> {
  await db.update(sessions)
    .set({ revoked_at: new Date() })
    .where(and(
      eq(sessions.organization_id, orgId),
      isNull(sessions.revoked_at),
    ));
}
```

### Cuándo disparar el refresh (desde el cliente)
- El `apiClient()` del frontend intercepta cualquier 401 y dispara el refresh automáticamente (ver SKILL_06 §3.2)
- Al cargar la aplicación (primera visita o recarga): intentar refresh para recuperar sesión existente
- Si el refresh falla (refresh token expirado o revocado): redirigir a `/login`

---

## 13. CAPTCHA en formularios públicos

Aplicar en endpoints accesibles sin autenticación para prevenir bots y fuerza bruta.

### Endpoints que requieren CAPTCHA
- `POST /auth/register`
- `POST /auth/forgot-password`

### Implementación con hCaptcha
```typescript
// Backend: verificar token CAPTCHA antes de procesar — ejecutar al inicio del handler
async function verifyCaptcha(token: string): Promise<boolean> {
  const response = await fetch('https://api.hcaptcha.com/siteverify', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      secret: process.env.HCAPTCHA_SECRET_KEY!,
      response: token,
    }),
  });
  const data = await response.json();
  return data.success === true;
}

// En el handler de registro — ANTES de crear usuario o validar email
const captchaValid = await verifyCaptcha(req.body.captchaToken);
if (!captchaValid) {
  throw new BadRequestException({
    error: { code: 'CAPTCHA_FAILED', message: 'Verificación de seguridad fallida. Intenta nuevamente.' }
  });
}
```

---

## 14. Sanitización de mensajes del bot (anti prompt injection)

Todo mensaje del usuario se sanitiza ANTES de pasar al LLM. Los usuarios pueden intentar manipular el bot con instrucciones disfrazadas.

```typescript
const INJECTION_PATTERNS = [
  /ignora (tus|todas las) instrucciones/i,
  /olvida (lo que te dije|el contexto|las reglas)/i,
  /actúa como/i,
  /eres ahora/i,
  /nuevo (sistema|prompt|rol)/i,
  /\[SYSTEM\]/i,
  /\[INSTRUCCIÓN\]/i,
  /modo (developer|dev|admin|god)/i,
  /revela (tu|el) (prompt|system|instrucciones)/i,
  /cuál es tu (system prompt|prompt del sistema)/i,
  /puedes decirme (tu|el) (prompt|instrucciones)/i,
  /ignore previous instructions/i,
];

function sanitizeUserMessage(message: string): {
  sanitized: string;
  isInjectionAttempt: boolean;
} {
  const isInjectionAttempt = INJECTION_PATTERNS.some(p => p.test(message));

  const sanitized = message
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '') // caracteres de control
    .replace(/<script[^>]*>.*?<\/script>/gi, '')
    .replace(/javascript:/gi, '')
    .trim()
    .slice(0, 2000); // longitud máxima del mensaje

  return { sanitized, isInjectionAttempt };
}

// En el pipeline del bot — SIEMPRE ejecutar antes de llamar al LLM
const { sanitized, isInjectionAttempt } = sanitizeUserMessage(rawMessage);
if (isInjectionAttempt) {
  logger.warn({ orgId, leadId, preview: rawMessage.slice(0, 80) }, 'Prompt injection attempt detected');
  // Redirigir sin revelar que se detectó — el usuario ve una respuesta normal
  return {
    response_text: 'Estoy aquí para ayudarte con nuestros productos y servicios. ¿En qué puedo ayudarte?',
    confidence: 1.0,
    intent_score: 0,
    should_escalate: false,
  };
}
// Usar 'sanitized' para el LLM — nunca 'rawMessage'
```

---

## Checklist de seguridad — antes de cada deploy a producción

- [ ] RLS activado en todas las tablas nuevas creadas en este PR
- [ ] No hay `organization_id` tomado del request body — siempre del JWT
- [ ] Webhooks nuevos tienen verificación HMAC antes de procesar
- [ ] Webhooks responden 200 ANTES de procesar (no en la misma request)
- [ ] URLs de assets son firmadas, no paths directos
- [ ] Variables de entorno nuevas documentadas en `.env.example` (sin valores reales)
- [ ] No hay `console.log` con datos de usuarios o tokens
- [ ] Rate limiting aplicado a endpoints nuevos
- [ ] Acción nueva registrada en `audit_events`
- [ ] Límites de plan verificados con `getEffectivePlan()`, no con `org.plan` directo
- [ ] Endpoints públicos nuevos tienen CAPTCHA si procesan datos de usuarios
- [ ] Mensajes del bot pasan por `sanitizeUserMessage()` antes del LLM
- [ ] Cambios de plan llaman `invalidateOrgSessions()` para actualizar claims
- [ ] Logs configurados con `redact` para campos sensibles (tokens, passwords, claves)
