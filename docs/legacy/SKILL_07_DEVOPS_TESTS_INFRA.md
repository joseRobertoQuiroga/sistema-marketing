# SKILL 07 — DevOps, Tests e Infraestructura
## OmniPresence Suite · SaaS Multi-tenant

> **Propósito de este skill:** Define la estructura del monorepo, la configuración de Docker, el pipeline de CI/CD, la estrategia completa de testing, la gestión de ambientes y la observabilidad del sistema. Es la guía para que OmniPresence pueda construirse, testearse y desplegarse de forma confiable y repetible.

---

## 1. Estructura del monorepo

OmniPresence usa un monorepo gestionado con **pnpm workspaces + Turborepo**.

```
omnipresence/                          ← raíz del monorepo
├── apps/
│   ├── api/                           ← Backend NestJS
│   │   ├── src/
│   │   │   ├── modules/
│   │   │   │   ├── auth/              ← Auth, JWT, MFA, sesiones
│   │   │   │   ├── org/               ← Organizaciones, memberships
│   │   │   │   ├── channels/          ← Social connections, OAuth
│   │   │   │   ├── analytics/         ← M1: métricas, reportes
│   │   │   │   ├── content/           ← M2: posts, assets, scheduler
│   │   │   │   ├── bot/               ← M3: bot, RAG, knowledge
│   │   │   │   ├── inbox/             ← M3: conversaciones, mensajes
│   │   │   │   ├── leads/             ← M3: leads, pipeline
│   │   │   │   ├── billing/           ← Stripe, suscripciones
│   │   │   │   ├── alerts/            ← Sistema de alertas
│   │   │   │   └── webhooks/          ← Meta, Stripe webhooks
│   │   │   ├── jobs/                  ← Workers BullMQ
│   │   │   │   ├── sync-metrics.job.ts
│   │   │   │   ├── publish-post.job.ts
│   │   │   │   ├── process-asset.job.ts
│   │   │   │   ├── process-inbound-message.job.ts
│   │   │   │   └── embed-knowledge.job.ts
│   │   │   ├── common/                ← Guards, decorators, pipes
│   │   │   ├── config/                ← Config por ambiente
│   │   │   └── main.ts
│   │   ├── test/
│   │   │   ├── unit/
│   │   │   ├── integration/
│   │   │   └── fixtures/
│   │   ├── Dockerfile
│   │   ├── Dockerfile.worker          ← Proceso separado para jobs BullMQ
│   │   └── package.json
│   │
│   └── web/                           ← Frontend Next.js (ver SKILL_06)
│       ├── Dockerfile
│       └── package.json
│
├── packages/
│   ├── db/                            ← Drizzle ORM: schema + client
│   │   ├── src/
│   │   │   ├── schema/                ← Una archivo por grupo de tablas
│   │   │   │   ├── core.ts            ← organizations, users, memberships, sessions
│   │   │   │   ├── social.ts          ← social_connections, account_metrics
│   │   │   │   ├── content.ts         ← assets, posts, post_assets, post_accounts, post_metrics
│   │   │   │   ├── bot.ts             ← knowledge_chunks, bot_configs, leads, conversations, messages
│   │   │   │   └── billing.ts         ← subscriptions, billing_events, usage_counters
│   │   │   ├── index.ts               ← Exporta el client de DB configurado
│   │   │   └── migrate.ts             ← Script de migraciones
│   │   └── package.json
│   │
│   ├── types/                         ← Tipos TypeScript compartidos API ↔ Frontend
│   │   ├── src/
│   │   │   ├── api.ts                 ← Request/Response types (fuente de verdad)
│   │   │   ├── entities.ts            ← Tipos de entidades del dominio
│   │   │   └── enums.ts               ← Enumeraciones compartidas (plan, status, etc.)
│   │   └── package.json
│   │
│   └── utils/                         ← Funciones utilitarias compartidas
│       ├── src/
│       │   ├── crypto.ts              ← encryptAES256GCM, decryptAES256GCM
│       │   ├── slug.ts                ← generateSlug
│       │   ├── tokens.ts              ← estimateTokens, chunkText
│       │   └── validation.ts          ← schemas Zod compartidos
│       └── package.json
│
├── docker/
│   ├── docker-compose.yml             ← Desarrollo local completo
│   ├── docker-compose.staging.yml     ← Overrides para staging
│   └── nginx/
│       └── nginx.conf                 ← Reverse proxy para staging/producción
│
├── .github/
│   └── workflows/
│       ├── ci.yml                     ← PR: lint + typecheck + tests unitarios
│       ├── staging.yml                ← Push a main: tests integración + deploy staging
│       └── release.yml                ← Tag v*: deploy producción con migrations
│
├── turbo.json
├── pnpm-workspace.yaml
└── package.json
```

---

## 2. Docker — configuración completa

### 2.1 docker-compose.yml (desarrollo local)
```yaml
# docker/docker-compose.yml
version: '3.9'

services:
  postgres:
    image: pgvector/pgvector:pg16
    environment:
      POSTGRES_DB: omnipresence_dev
      POSTGRES_USER: omni
      POSTGRES_PASSWORD: omni_dev_password
    ports:
      - "5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U omni -d omnipresence_dev"]
      interval: 5s
      timeout: 5s
      retries: 5

  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"
    command: redis-server --appendonly yes
    volumes:
      - redis_data:/data
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 5s
      timeout: 3s
      retries: 5

  minio:
    image: minio/minio:latest
    environment:
      MINIO_ROOT_USER: minio_user
      MINIO_ROOT_PASSWORD: minio_password
    ports:
      - "9000:9000"  # API
      - "9001:9001"  # Console web
    command: server /data --console-address ":9001"
    volumes:
      - minio_data:/data

  api:
    build:
      context: ../apps/api
      dockerfile: Dockerfile
      target: development          # Stage de desarrollo con hot reload
    env_file:
      - ../apps/api/.env.local
    ports:
      - "3001:3001"
    volumes:
      - ../apps/api/src:/app/src  # Hot reload
    depends_on:
      postgres:
        condition: service_healthy
      redis:
        condition: service_healthy

  worker:
    build:
      context: ../apps/api
      dockerfile: Dockerfile.worker
      target: development
    env_file:
      - ../apps/api/.env.local
    volumes:
      - ../apps/api/src:/app/src
    depends_on:
      - api

  web:
    build:
      context: ../apps/web
      dockerfile: Dockerfile
      target: development
    env_file:
      - ../apps/web/.env.local
    ports:
      - "3000:3000"
    volumes:
      - ../apps/web:/app
      - /app/node_modules
      - /app/.next

volumes:
  postgres_data:
  redis_data:
  minio_data:
```

### 2.2 Dockerfile del API (multi-stage)
```dockerfile
# apps/api/Dockerfile
FROM node:20-alpine AS base
RUN corepack enable pnpm
WORKDIR /app

# ── Development ──────────────────────────────────────────────────────────────
FROM base AS development
COPY package.json pnpm-lock.yaml ./
RUN pnpm install
COPY . .
CMD ["pnpm", "run", "start:dev"]

# ── Build ─────────────────────────────────────────────────────────────────────
FROM base AS builder
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile
COPY . .
RUN pnpm build

# ── Production ────────────────────────────────────────────────────────────────
FROM base AS production
ENV NODE_ENV=production
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile --prod
COPY --from=builder /app/dist ./dist
# Usuario no-root para producción
RUN addgroup -g 1001 -S nodejs && adduser -S nestjs -u 1001
USER nestjs
EXPOSE 3001
CMD ["node", "dist/main.js"]
```

---

## 3. Gestión de ambientes

### 3.1 Variables de entorno por ambiente

| Variable | Local | Staging | Producción |
|----------|-------|---------|-----------|
| `DATABASE_URL` | Docker postgres local | Railway/Render postgres | Producción postgres |
| `STRIPE_SECRET_KEY` | `sk_test_...` | `sk_test_...` | `sk_live_...` |
| `META_APP_ID` | App de test | App de test | App verificada |
| `ANTHROPIC_API_KEY` | Key personal | Key de proyecto | Key de producción |
| `NODE_ENV` | `development` | `staging` | `production` |
| `LOG_LEVEL` | `debug` | `info` | `warn` |

### 3.2 Archivos .env por ambiente
```bash
# apps/api/.env.local (desarrollo) — en .gitignore
# apps/api/.env.staging  — en .gitignore, cargado por CI/CD
# apps/api/.env.production — NUNCA en el repo, cargado desde el gestor de secretos

# .env.example — en el repo (sin valores reales)
DATABASE_URL=postgresql://user:password@localhost:5432/omnipresence_dev
REDIS_URL=redis://localhost:6379
STORAGE_ENDPOINT=http://localhost:9000
STORAGE_ACCESS_KEY=minio_user
STORAGE_SECRET_KEY=minio_password
STORAGE_BUCKET=omnipresence
JWT_PRIVATE_KEY=<RS256 private key>
JWT_PUBLIC_KEY=<RS256 public key>
TOKEN_ENCRYPTION_KEY=<32 bytes random hex>
META_APP_ID=
META_APP_SECRET=
STRIPE_SECRET_KEY=sk_test_
STRIPE_WEBHOOK_SECRET=whsec_
ANTHROPIC_API_KEY=sk-ant-
OPENAI_API_KEY=sk-
RESEND_API_KEY=re_
FRONTEND_URL=http://localhost:3000
```

---

## 4. Pipeline de CI/CD con GitHub Actions

### 4.1 ci.yml — ejecuta en cada PR
```yaml
# .github/workflows/ci.yml
name: CI

on:
  pull_request:
    branches: [main, develop]

jobs:
  lint-and-typecheck:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v3
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'pnpm'
      - run: pnpm install --frozen-lockfile
      - run: pnpm turbo lint
      - run: pnpm turbo typecheck

  unit-tests:
    runs-on: ubuntu-latest
    needs: lint-and-typecheck
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v3
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'pnpm'
      - run: pnpm install --frozen-lockfile
      - run: pnpm turbo test:unit
      - uses: actions/upload-artifact@v4
        with:
          name: coverage-report
          path: apps/api/coverage/
```

### 4.2 staging.yml — ejecuta en push a main
```yaml
# .github/workflows/staging.yml
name: Deploy Staging

on:
  push:
    branches: [main]

jobs:
  integration-tests:
    runs-on: ubuntu-latest
    services:
      postgres:
        image: pgvector/pgvector:pg16
        env:
          POSTGRES_DB: omnipresence_test
          POSTGRES_USER: omni
          POSTGRES_PASSWORD: test_password
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
      redis:
        image: redis:7-alpine
        options: >-
          --health-cmd "redis-cli ping"
          --health-interval 10s
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v3
      - run: pnpm install --frozen-lockfile
      - name: Run migrations on test DB
        run: pnpm --filter @omnipresence/db migrate
        env:
          DATABASE_URL: postgresql://omni:test_password@localhost:5432/omnipresence_test
      - name: Run integration tests
        run: pnpm turbo test:integration
        env:
          DATABASE_URL: postgresql://omni:test_password@localhost:5432/omnipresence_test
          REDIS_URL: redis://localhost:6379
          # Usar secrets del repo para el resto de variables
          ANTHROPIC_API_KEY: ${{ secrets.ANTHROPIC_API_KEY_TEST }}
          STRIPE_SECRET_KEY: ${{ secrets.STRIPE_SECRET_KEY_TEST }}

  deploy-staging:
    needs: integration-tests
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Run migrations on staging DB
        run: pnpm --filter @omnipresence/db migrate
        env:
          DATABASE_URL: ${{ secrets.STAGING_DATABASE_URL }}
      - name: Deploy API to staging
        # Usar Railway CLI, Render deploy hook, o Docker push a registry
        run: |
          curl -X POST "${{ secrets.STAGING_DEPLOY_HOOK_API }}"
      - name: Deploy Web to staging
        run: |
          curl -X POST "${{ secrets.STAGING_DEPLOY_HOOK_WEB }}"
```

### 4.3 release.yml — deploy a producción
```yaml
# .github/workflows/release.yml
name: Deploy Production

on:
  push:
    tags:
      - 'v*'   # Solo en tags de versión: v1.0.0, v1.1.0, etc.

jobs:
  deploy-production:
    runs-on: ubuntu-latest
    environment: production   # requiere aprobación manual en GitHub
    steps:
      - uses: actions/checkout@v4
      - name: Backup DB before migration
        run: |
          # pg_dump a bucket R2 antes de migrations en producción
          pg_dump ${{ secrets.PROD_DATABASE_URL }} | \
          gzip | \
          aws s3 cp - s3://omnipresence-backups/pre-deploy-$(date +%Y%m%d%H%M%S).sql.gz \
          --endpoint-url ${{ secrets.R2_ENDPOINT }}
      - name: Run migrations on production DB
        run: pnpm --filter @omnipresence/db migrate
        env:
          DATABASE_URL: ${{ secrets.PROD_DATABASE_URL }}
      - name: Deploy to production
        run: |
          curl -X POST "${{ secrets.PROD_DEPLOY_HOOK_API }}"
          curl -X POST "${{ secrets.PROD_DEPLOY_HOOK_WEB }}"
```

---

## 5. Estrategia de testing

### 5.1 Pirámide de tests

```
         ┌──────────┐
         │   E2E    │  3 flujos críticos (Playwright)
         │  (3-5)   │  Solo en pre-release
         ├──────────┤
         │Integración│  Endpoints críticos de auth, billing, bot
         │  (20-30) │  Se ejecutan en staging
         ├──────────┤
         │  Unitarios│  Lógica de negocio, utilidades, validaciones
         │  (50-80)  │  Se ejecutan en cada PR
         └──────────┘
```

### 5.2 Tests unitarios (Vitest)

```typescript
// Qué testar con tests unitarios:
// - Lógica de intent scoring (reglas de clasificación)
// - Enforcement de límites de plan
// - Cálculo de métricas (engagement rate, ROAS, CPL)
// - Sanitización de mensajes del bot
// - Generación de slugs
// - Lógica de billing (getEffectivePlan, trial activo)

// apps/api/test/unit/lead-scoring.spec.ts
import { describe, it, expect } from 'vitest';
import { calculateIntentStatus } from '@/modules/bot/intent-scoring';

describe('Lead intent scoring', () => {
  it('should classify score 0-20 as cold', () => {
    expect(calculateIntentStatus(15)).toBe('cold');
    expect(calculateIntentStatus(0)).toBe('cold');
    expect(calculateIntentStatus(20)).toBe('cold');
  });

  it('should classify score 21-50 as warm', () => {
    expect(calculateIntentStatus(21)).toBe('warm');
    expect(calculateIntentStatus(50)).toBe('warm');
  });

  it('should classify score 51-80 as hot', () => {
    expect(calculateIntentStatus(75)).toBe('hot');
  });

  it('should classify score 81-100 as converted', () => {
    expect(calculateIntentStatus(85)).toBe('converted');
    expect(calculateIntentStatus(100)).toBe('converted');
  });

  it('should never reduce score below previous value', () => {
    const previousScore = 70;
    const newScore = 30;
    const effectiveScore = Math.max(previousScore, newScore);
    expect(effectiveScore).toBe(70);
  });
});

// apps/api/test/unit/plan-limits.spec.ts
describe('Plan limits enforcement', () => {
  it('should allow unlimited posts on Pro plan', () => {
    const limit = PLAN_LIMITS.pro.posts_month;
    expect(limit).toBe(-1); // -1 = ilimitado
  });

  it('should allow 2 channels on free plan', () => {
    expect(PLAN_LIMITS.free.channels).toBe(2);
  });

  it('should use pro plan features during active trial', () => {
    const org = { plan: 'free', trial_ends_at: addDays(new Date(), 5).toISOString() };
    expect(getEffectivePlan(org)).toBe('pro');
  });

  it('should use free plan after trial expires', () => {
    const org = { plan: 'free', trial_ends_at: subDays(new Date(), 1).toISOString() };
    expect(getEffectivePlan(org)).toBe('free');
  });
});
```

### 5.3 Tests de integración (Supertest + base de datos real)

```typescript
// Qué testar con integración:
// - Flujo completo de auth (register → login → refresh → logout)
// - Aislamiento de tenant (org A no puede ver datos de org B)
// - Límites de plan en endpoints reales
// - Webhook de Stripe: subscription.updated actualiza el plan en DB
// - Webhook de Meta: mensaje entrante crea lead y conversación

// apps/api/test/integration/auth.spec.ts
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { createTestApp, cleanupTestDB, seedTestOrg } from '../fixtures';

describe('Auth endpoints', () => {
  let app: Express.Application;
  let orgA: TestOrg;
  let orgB: TestOrg;

  beforeAll(async () => {
    app = await createTestApp();
    orgA = await seedTestOrg('org-a');
    orgB = await seedTestOrg('org-b');
  });

  afterAll(() => cleanupTestDB());

  it('should register and return access token', async () => {
    const res = await request(app)
      .post('/auth/register')
      .send({ name: 'Test User', email: 'test@test.com', password: 'SecurePass123!', orgName: 'Test Org' });

    expect(res.status).toBe(201);
    expect(res.body.accessToken).toBeDefined();
    expect(res.headers['set-cookie']).toBeDefined(); // refresh token cookie
  });

  it('should enforce tenant isolation — org A cannot see org B leads', async () => {
    const res = await request(app)
      .get('/leads')
      .set('Authorization', `Bearer ${orgA.accessToken}`);

    expect(res.status).toBe(200);
    // Verificar que ningún lead de orgB aparece en la respuesta
    const leadOrgIds = res.body.data.map((l: any) => l.organization_id);
    expect(leadOrgIds.every((id: string) => id === orgA.id)).toBe(true);
  });

  it('should block post creation when free plan limit exceeded', async () => {
    // Crear 30 posts (límite del plan free)
    for (let i = 0; i < 30; i++) {
      await createTestPost(orgA.id);
    }
    // El 31 debe fallar
    const res = await request(app)
      .post('/posts')
      .set('Authorization', `Bearer ${orgA.accessToken}`)
      .send({ captionTemplate: 'Test post', channelIds: [orgA.channelId] });

    expect(res.status).toBe(402);
    expect(res.body.error.code).toBe('PLAN_LIMIT_EXCEEDED');
  });
});
```

### 5.4 Tests E2E (Playwright)

```typescript
// Solo 3 flujos críticos — los más costosos para corregir si fallan en producción

// tests/e2e/onboarding.spec.ts
import { test, expect } from '@playwright/test';

test('Onboarding completo: registro → conectar canal → ver métricas', async ({ page }) => {
  // 1. Registro
  await page.goto('/register');
  await page.fill('[name=name]', 'Tienda Test');
  await page.fill('[name=email]', `test-${Date.now()}@test.com`);
  await page.fill('[name=password]', 'SecurePass123!');
  await page.fill('[name=orgName]', 'Tienda Test SCZ');
  await page.click('button[type=submit]');

  // 2. Onboarding
  await expect(page).toHaveURL('/onboarding');
  await expect(page.getByText('Paso 1 completado')).toBeVisible();

  // 3. Conectar canal (mock del OAuth en testing)
  await page.click('text=Conectar Facebook');
  // ... flujo de OAuth mockeado

  // 4. Redirigir al dashboard
  await expect(page).toHaveURL('/analytics');
  await expect(page.getByText('Alcance total')).toBeVisible();
});

// tests/e2e/publish-post.spec.ts
test('Publicar un post en Instagram y Facebook', async ({ page }) => { /* ... */ });

// tests/e2e/lead-conversion.spec.ts
test('Bot responde a un lead y se convierte en venta', async ({ page }) => { /* ... */ });
```

---

## 6. Observabilidad y logging

### 6.1 Logging estructurado con Pino
```typescript
// apps/api/src/common/logger.ts
import pino from 'pino';

export const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  // En producción: JSON estructurado para ingestión por Logtail/Grafana
  // En desarrollo: formato legible
  transport: process.env.NODE_ENV === 'development'
    ? { target: 'pino-pretty' }
    : undefined,
  // REGLA: nunca loguear estos campos — los redact los elimina automáticamente
  redact: [
    'encrypted_token',
    'password_hash',
    'mfa_secret',
    '*.authorization',
    'headers.cookie',
    'body.password',
    'DATABASE_URL',
  ],
});

// CORRECTO: log estructurado con contexto
logger.info({ orgId, postId, platform }, 'Post published successfully');
logger.error({ orgId, error: error.message, stack: error.stack }, 'Post publication failed');

// INCORRECTO: nunca loguear objetos completos que puedan contener PII o secretos
logger.info(user);       // ❌ puede contener password_hash
logger.info(connection); // ❌ contiene encrypted_token
```

### 6.2 Monitoreo de jobs BullMQ
```typescript
// apps/api/src/jobs/monitoring.ts
import { QueueEvents } from 'bullmq';

// Registrar métricas de los jobs para detectar cuellos de botella
const queueEvents = new QueueEvents('sync-metrics', { connection: redis });

queueEvents.on('failed', ({ jobId, failedReason }) => {
  logger.error({ jobId, failedReason }, 'Job sync-metrics failed');
  // Alertar si hay muchos fallos seguidos del mismo job
});

queueEvents.on('stalled', ({ jobId }) => {
  logger.warn({ jobId }, 'Job stalled — possible worker crash');
});
```

### 6.3 Health check endpoint
```typescript
// GET /health — usado por el load balancer para detectar instancias caídas
app.get('/health', async (req, res) => {
  const checks = {
    database: await checkDatabase(),
    redis: await checkRedis(),
    storage: await checkStorage(),
  };
  const allHealthy = Object.values(checks).every(c => c.status === 'ok');
  res.status(allHealthy ? 200 : 503).json({
    status: allHealthy ? 'ok' : 'degraded',
    checks,
    timestamp: new Date().toISOString(),
  });
});
```

---

## 7. Backup y recuperación de datos

```bash
# Script: scripts/backup-db.sh
# Ejecutar diariamente vía cron o como job programado en Railway/Render

#!/bin/bash
set -e

TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="omnipresence_backup_${TIMESTAMP}.sql.gz"

echo "Starting backup: ${BACKUP_FILE}"

# Hacer dump comprimido
pg_dump "${DATABASE_URL}" | gzip > "/tmp/${BACKUP_FILE}"

# Subir a Cloudflare R2 (compatible con AWS S3 CLI)
aws s3 cp "/tmp/${BACKUP_FILE}" \
  "s3://omnipresence-backups/${BACKUP_FILE}" \
  --endpoint-url "${R2_ENDPOINT}"

# Limpiar backup local
rm "/tmp/${BACKUP_FILE}"

# Eliminar backups de más de 30 días
aws s3 ls s3://omnipresence-backups/ --endpoint-url "${R2_ENDPOINT}" | \
  awk '{print $4}' | \
  while read file; do
    date=$(echo $file | grep -oP '\d{8}')
    if [[ $(date -d "$date" +%s) -lt $(date -d "30 days ago" +%s) ]]; then
      aws s3 rm "s3://omnipresence-backups/$file" --endpoint-url "${R2_ENDPOINT}"
    fi
  done

echo "Backup completed: ${BACKUP_FILE}"
```

### Procedimiento de restore
```bash
# En caso de necesitar restore (incidente en producción):
# 1. Detener el servicio API para evitar escrituras durante el restore
# 2. Descargar el backup apropiado de R2
aws s3 cp s3://omnipresence-backups/omnipresence_backup_TIMESTAMP.sql.gz /tmp/restore.sql.gz

# 3. Restaurar la DB
gunzip -c /tmp/restore.sql.gz | psql "${DATABASE_URL}"

# 4. Verificar integridad básica
psql "${DATABASE_URL}" -c "SELECT COUNT(*) FROM organizations;"
psql "${DATABASE_URL}" -c "SELECT COUNT(*) FROM leads;"

# 5. Reiniciar el servicio
```

---

## 8. Configuración de Turborepo

```json
// turbo.json
{
  "$schema": "https://turbo.build/schema.json",
  "globalDependencies": [".env.local"],
  "pipeline": {
    "build": {
      "dependsOn": ["^build"],
      "outputs": ["dist/**", ".next/**"]
    },
    "dev": {
      "cache": false,
      "persistent": true
    },
    "lint": {
      "outputs": []
    },
    "typecheck": {
      "dependsOn": ["^build"],
      "outputs": []
    },
    "test:unit": {
      "outputs": ["coverage/**"]
    },
    "test:integration": {
      "dependsOn": ["build"],
      "outputs": []
    },
    "db:migrate": {
      "cache": false
    }
  }
}
```

---

## 9. Comandos del día a día del desarrollador

```bash
# ── Setup inicial ─────────────────────────────────────────────────────────────
git clone https://github.com/omnipresence/omnipresence.git
cd omnipresence
pnpm install
cp apps/api/.env.example apps/api/.env.local
cp apps/web/.env.example apps/web/.env.local
# Editar .env.local con las claves necesarias

# ── Desarrollo local ──────────────────────────────────────────────────────────
docker compose -f docker/docker-compose.yml up -d    # Levantar postgres + redis + minio
pnpm --filter @omnipresence/db migrate               # Aplicar migrations
pnpm --filter @omnipresence/db seed                  # Cargar datos de prueba
pnpm dev                                              # Levantar api + web con hot reload

# ── Testing ───────────────────────────────────────────────────────────────────
pnpm test:unit                                        # Tests unitarios (rápido, sin DB)
pnpm test:integration                                 # Tests de integración (requiere docker)
pnpm test:e2e                                         # Tests E2E con Playwright

# ── Base de datos ─────────────────────────────────────────────────────────────
pnpm --filter @omnipresence/db generate              # Generar migration desde schema Drizzle
pnpm --filter @omnipresence/db migrate               # Aplicar migrations pendientes
pnpm --filter @omnipresence/db studio                # Drizzle Studio (UI de la DB)

# ── Build y deploy ────────────────────────────────────────────────────────────
pnpm build                                            # Build de todos los packages
git tag v1.0.0 && git push origin v1.0.0             # Trigger deploy a producción
```

---

## Checklist de DevOps — antes de cada deploy a producción

- [ ] Tag de versión creado con formato `v{major}.{minor}.{patch}`
- [ ] Todos los tests unitarios y de integración pasan en CI
- [ ] Backup de la DB de producción ejecutado ANTES de las migrations
- [ ] Migrations nuevas testeadas en staging antes de aplicar en producción
- [ ] Variables de entorno nuevas documentadas en `.env.example` y añadidas al gestor de secretos
- [ ] Endpoint `/health` retorna 200 en staging después del deploy
- [ ] Si hay cambio de schema: verificar que el ORM manejó el particionado correctamente
- [ ] Si hay nueva variable de entorno: añadida en todos los ambientes (staging y producción)
- [ ] Rollback plan definido: si el deploy falla, cómo volver a la versión anterior
- [ ] Logs de la primera hora de producción revisados después del deploy
