# SKILL 03 — Funcionalidad y Objetivos
## OmniPresence Suite · SaaS Multi-tenant

> **Propósito de este skill:** Define qué hace el sistema, cómo lo hace, qué métricas mide, qué reglas de negocio implementa y cuáles son los objetivos cuantitativos de cada módulo. Es la guía de producto para cualquier desarrollador o IA que construya features de OmniPresence.

---

## 0. Visión del producto

**OmniPresence Suite** es una plataforma SaaS web que centraliza la presencia digital de PYMEs hispanohablantes en un único panel. Reemplaza 4–7 herramientas dispersas (Meta Business Suite, TikTok Analytics, Canva, chatbot, Excel de leads) con tres módulos integrados:

| Módulo | Función principal | Valor para el cliente |
|--------|-------------------|-----------------------|
| **M1 · Analytics Hub** | Métricas unificadas de todas las redes sociales | Ver el rendimiento real sin abrir 4 pestañas |
| **M2 · Content Hub** | Adaptación y publicación centralizada de contenido | Publicar en 5 canales con un solo upload |
| **M3 · AI Bot & Lead Engine** | Bot entrenado con el negocio + clasificación de leads | Vender mientras se duerme |

**Target primario:** PYMEs de 1–50 empleados en Bolivia, Perú, Colombia, Argentina, México.
**Target secundario:** Agencias de marketing digital y community managers freelance.
**Precio:** $0 (free) / $29 (Pro) / $59 (Business) / $89 (Agency).

---

## 1. Onboarding — flujo de activación

El onboarding está diseñado para que el cliente vea valor en menos de 10 minutos.

### 4 pasos secuenciales

**Paso 1: Crear organización**
- Campos: nombre del negocio, industria (select), zona horaria
- Al completar: crea registro en `organizations`, crea `membership` con role `owner`, inicia trial de 14 días
- Slug generado automáticamente: `tienda-moda-scz` → verificar unicidad → auto-incrementar si colisión

**Paso 2: Conectar al menos una red social**
- OAuth flow por plataforma — ventana popup, no redirect completo
- Permisos mínimos requeridos por plataforma:
  - Facebook: `pages_show_list`, `pages_read_engagement`, `instagram_basic`, `instagram_manage_insights`, `leads_retrieval`
  - LinkedIn: `r_organization_social`, `rw_organization_admin`, `w_member_social`
  - TikTok: `user.info.basic`, `video.list`, `data.insights`
- Al conectar: guardar token cifrado en `social_connections`, disparar primer sync de métricas en background
- Este paso es obligatorio — sin él no hay métricas ni bot

**Paso 3: Subir knowledge base** (opcional en onboarding, requerido para activar bot)
- Formatos aceptados: CSV (catálogo de productos), PDF (manual, catálogo), texto libre
- Procesamiento: chunking automático → embeddings → `knowledge_chunks`
- Tiempo estimado de entrenamiento: < 2 minutos para hasta 500 productos

**Paso 4: Activar bot**
- Seleccionar en qué canales responde el bot
- Configurar tono: formal / amigable / casual / profesional
- Definir mensaje de escalado a humano
- El bot queda activo en menos de 1 hora desde la carga del catálogo

### Indicador de progreso del onboarding
```typescript
interface OnboardingProgress {
  org_created: boolean;       // siempre true al llegar aquí
  channel_connected: boolean; // al menos 1 social_connection activa
  knowledge_uploaded: boolean;// al menos 1 knowledge_chunk activo
  bot_activated: boolean;     // bot_config.is_active = true
  completion_pct: number;     // 25 / 50 / 75 / 100
}
```

---

## 2. Módulo 1 — Analytics Hub

### Objetivo funcional
Dashboard unificado que muestra el rendimiento de todas las redes sociales conectadas, con filtros por canal y período, gráficas comparativas y exportación de reportes.

### Pantallas y componentes

#### Dashboard principal
```
KPIs en tarjetas (período seleccionado):
├── Alcance total (suma de reach de todos los canales)
├── Engagement rate promedio (ponderado por alcance)
├── Leads generados (total de leads.first_contact_at en el período)
└── Costo por lead = total_spend / total_leads

Gráfica de evolución temporal:
├── Selector: Engagement / Alcance / Conversiones / Inversión
├── Series por canal (líneas de color)
└── Granularidad: diario / semanal / mensual

Tabla: top 3 posts del período (por engagement_rate DESC)

Panel de alertas recientes (últimas 5 de alerts)
```

#### Vista por canal (drill-down)
```
Métricas específicas del canal seleccionado:
├── Impresiones, alcance, engagement detallado
├── Inversión publicitaria y ROAS
├── Crecimiento de seguidores (gráfica de línea, delta diario)
└── Mejores horas de publicación (futuro post-MVP)

Tabla de posts del canal ordenados por engagement_rate
```

### Métricas — catálogo completo

#### Por publicación (post_metrics)
| Métrica | Fuente | Fórmula | Frecuencia sync |
|---------|--------|---------|----------------|
| Impresiones | Meta/TikTok/LinkedIn API | Directo | Cada 4h |
| Alcance (reach) | API | Directo | Cada 4h |
| Engagement rate | Calculado | `(likes + cmts + shares + saves) / reach × 100` | En sync |
| CTR | Calculado | `clicks / impressions × 100` | En sync |
| Video completion rate | API | Directo | Cada 4h |
| Conversiones | Pixel/API | Directo | Diario |
| CPM | Calculado | `spend / impressions × 1000` | Diario |
| CPA | Calculado | `spend / conversions` | Diario |
| ROAS | Calculado | `ingresos_atribuidos / spend` | Diario |
| Leads generados | Módulo 3 | Conteo de leads.first_contact_source | Real-time |
| CPL | Calculado | `spend / leads_totales` | Diario |

#### Por cuenta/canal (account_metrics)
| Métrica | Fuente | Frecuencia |
|---------|--------|-----------|
| Crecimiento de seguidores | API | Diario |
| Tasa de crecimiento | Calculado | Diario |
| Frecuencia de publicación | Interno | Diario |
| Inversión total del período | Ads API | Diario |
| Top 3 posts del período | Calculado | En sync |

### Lógica de ingesta (job de sync)
```typescript
// Job: sync_social_metrics
// Se dispara: cada 4h por org activa con canales conectados
// Prioridad de cola: baja (no bloquea UI)

async function syncOrgMetrics(orgId: string): Promise<void> {
  const connections = await getActiveConnections(orgId);
  
  for (const conn of connections) {
    try {
      // 1. Verificar que el token no está expirado
      if (conn.token_expires_at && conn.token_expires_at < addHours(new Date(), 24)) {
        await refreshTokenIfPossible(conn);
      }
      
      // 2. Fetch métricas de la API de la plataforma
      const metrics = await fetchPlatformMetrics(conn, { days: 2 }); // últimos 2 días siempre
      
      // 3. Upsert en account_metrics y post_metrics
      await upsertAccountMetrics(conn.id, orgId, metrics.account);
      await upsertPostMetrics(conn.id, metrics.posts);
      
      // 4. Invalidar caché de Redis para este org
      await redis.del(`analytics:${orgId}:*`);
      
      // 5. Actualizar last_synced_at
      await updateConnectionSyncTime(conn.id);
      
    } catch (error) {
      // No falla todo el job por un canal — registra el error y continúa
      await createAlert(orgId, 'sync_error', { platform: conn.platform, error: error.message });
    }
  }
}
```

### Exportación de reportes
- **PDF:** generado server-side con Puppeteer headless — renderiza el dashboard con los datos del período y hace screenshot
- **Excel:** `ExcelJS` genera el archivo con una sheet por canal + sheet de resumen
- Endpoint: `GET /api/analytics/export?format=pdf|xlsx&from=YYYY-MM-DD&to=YYYY-MM-DD`
- Archivo entregado como stream con `Content-Disposition: attachment`

### Objetivos de performance M1
| Métrica | Objetivo | Alerta si |
|---------|----------|-----------|
| Tiempo de carga del dashboard | < 1.5s | > 3s |
| Latencia de query de métricas | < 200ms | > 500ms |
| Frecuencia de sync exitosa | > 95% | < 90% |
| Cobertura de datos (días sin gap) | > 99% | < 95% |

---

## 3. Módulo 2 — Content Hub

### Objetivo funcional
Permitir que el usuario suba un asset una sola vez y el sistema genere variantes optimizadas para cada plataforma, con editor de crop, scheduler visual y publicación directa vía API.

### Pantallas y componentes

#### Nueva publicación
```
1. Upload zone (drag & drop o selector de archivo)
   └── Validaciones: mime type, tamaño (max 100MB), dimensiones mínimas

2. Grid de variantes generadas automáticamente:
   ├── IG Feed 1:1 (1080×1080)
   ├── IG Stories 9:16 (1080×1920)
   ├── FB Feed 1.91:1 (1200×630)
   └── LI Feed 1.91:1 (1200×627)
   Cada variante: preview + botón de ajuste del crop focal point

3. Panel de captions:
   ├── Caption base (se copia a todos los canales)
   └── Captions individuales por canal (con contador de caracteres)

4. Selección de canales destino (checkboxes con las cuentas conectadas)

5. Scheduling:
   ├── "Publicar ahora"
   ├── "Programar para" (date-time picker)
   └── "Guardar borrador"
```

#### Calendario de contenido
- Vista mensual con dots de color por canal en cada día con publicaciones
- Click en día: muestra los posts del día con estado (programado/publicado/fallido)
- Drag & drop para reprogramar (cambia `posts.scheduled_at`)

#### Biblioteca de assets
- Grid de todos los assets subidos por la org
- Filtros: tipo (imagen/video), canal óptimo, tags
- Búsqueda por nombre de archivo o alt text
- Click en asset: muestra variantes generadas y posts donde fue usado

### Procesamiento de assets (pipeline de jobs)
```typescript
// Job: process_asset
// Se dispara: inmediatamente al upload

interface AssetProcessingJob {
  assetId: string;
  orgId: string;
  originalStorageKey: string;
  mimeType: string;
  focalPoint?: { x: number; y: number }; // default: {x: 0.5, y: 0.5} (centro)
}

const VARIANTS: Record<string, { w: number; h: number; platform: string; format: string }[]> = {
  image: [
    { w: 1080, h: 1080, platform: 'instagram', format: 'feed_square' },
    { w: 1080, h: 1350, platform: 'instagram', format: 'feed_portrait' },
    { w: 1080, h: 1920, platform: 'instagram', format: 'stories' },
    { w: 1200, h: 630,  platform: 'facebook',  format: 'feed' },
    { w: 1080, h: 1920, platform: 'facebook',  format: 'stories' },
    { w: 1200, h: 627,  platform: 'linkedin',  format: 'feed' },
    { w: 1080, h: 1080, platform: 'tiktok',    format: 'thumbnail' },
  ],
};

async function processAsset(job: AssetProcessingJob): Promise<void> {
  const buffer = await storage.download(job.originalStorageKey);
  const variants = [];
  
  for (const variant of VARIANTS[job.mimeType.startsWith('image') ? 'image' : 'video']) {
    const processed = await sharp(buffer)
      .resize(variant.w, variant.h, {
        fit: 'cover',
        position: sharp.strategy.attention, // detección automática del área focal
      })
      .jpeg({ quality: 85 })
      .toBuffer();
    
    const variantKey = `${job.orgId}/variants/${job.assetId}/${variant.platform}_${variant.format}.jpg`;
    await storage.upload(variantKey, processed, 'image/jpeg');
    
    variants.push({ ...variant, storage_key: variantKey, file_size_kb: processed.length / 1024 });
  }
  
  await db.update(assets)
    .set({ /* variants guardadas en post_assets al crear el post */ })
    .where(eq(assets.id, job.assetId));
    
  // Notificar al frontend via WebSocket/SSE que el procesamiento terminó
  await notifyProcessingComplete(job.orgId, job.assetId, variants);
}
```

### Publicación directa (job scheduler)
```typescript
// Job: publish_post — corre en el scheduled_at del post
async function publishPost(postId: string): Promise<void> {
  const post = await getPostWithAccounts(postId);
  await db.update(posts).set({ status: 'publishing' }).where(eq(posts.id, postId));
  
  for (const account of post.post_accounts) {
    try {
      // Llamada a la API de la plataforma correspondiente
      const platformPostId = await publishToplatform(account, post);
      
      await db.update(post_accounts).set({
        status: 'published',
        platform_post_id: platformPostId,
        published_at: new Date(),
      }).where(eq(post_accounts.id, account.id));
      
    } catch (error) {
      await db.update(post_accounts).set({
        status: 'failed',
        error_message: error.message,
        retry_count: sql`retry_count + 1`,
      }).where(eq(post_accounts.id, account.id));
      
      // Reintentar hasta 3 veces con backoff exponencial
      if (account.retry_count < 3) {
        await queue.add('publish_account', { postAccountId: account.id }, {
          delay: Math.pow(2, account.retry_count) * 60 * 1000 // 1min, 2min, 4min
        });
      }
    }
  }
  
  // Actualizar estado del post según resultados
  const allAccounts = await getPostAccounts(postId);
  const finalStatus = allAccounts.every(a => a.status === 'published') ? 'published'
    : allAccounts.some(a => a.status === 'published') ? 'published' // al menos uno
    : 'failed';
  
  await db.update(posts).set({ status: finalStatus, published_at: new Date() }).where(eq(posts.id, postId));
  await logAuditEvent('post.published', { postId, status: finalStatus });
}
```

### Objetivos de performance M2
| Métrica | Objetivo | Alerta si |
|---------|----------|-----------|
| Tiempo de procesado de imagen (crop + variantes) | < 3s | > 10s |
| Tasa de publicación exitosa | > 95% | < 90% |
| Tokens de canales expirados | 0 activos | > 0 |
| Assets en proceso (cola pendiente) | < 10 | > 50 |

---

## 4. Módulo 3 — AI Bot & Lead Engine

### Objetivo funcional
Desplegar bots de IA entrenados con el catálogo y lógica del negocio del cliente, respondiendo en Instagram DMs y Facebook Messenger. Clasificar automáticamente la intención del lead y notificar al equipo cuando hay oportunidades de venta calientes.

### Pipeline completo del bot

```
1. INBOUND: mensaje entrante del usuario en Instagram DM o Facebook Messenger
   ↓
2. WEBHOOK: verificación HMAC + idempotency check
   ↓
3. CONTEXTO: identificar org, social_connection, lead (crear si es nuevo)
   ↓
4. RAG: búsqueda semántica en knowledge_chunks del tenant
   - Query: embedding del mensaje del usuario
   - Filtro: organization_id = X, is_active = true
   - Top 5 chunks más relevantes (similarity > 0.75)
   ↓
5. LLM: generar respuesta con Anthropic API
   - System prompt: contexto del negocio + chunks relevantes
   - Historial de conversación: últimos 10 mensajes
   - Retorna: {response_text, confidence_score, intent_analysis}
   ↓
6. DECISIÓN:
   ├── confidence_score >= threshold (default 0.60):
   │   → enviar respuesta vía API de la plataforma
   │   → guardar message (outbound, sender_type='bot')
   │
   └── confidence_score < threshold:
       → enviar mensaje de escalado configurado
       → conversation.bot_active = false
       → conversation.handoff_reason = 'low_confidence'
       → crear alerta in-app para el equipo
   ↓
7. SCORING: actualizar intent_score del lead
   - LLM analiza el historial y asigna score 0-100
   - Trigger sync_lead_status actualiza lead.status automáticamente
   ↓
8. ALERTA: si intent_score >= hot_lead_threshold (default 70)
   → crear alerta tipo 'hot_lead' para la org
   → (futuro) notificación push / email
```

### Procesamiento de la knowledge base

#### Upload y chunking
```typescript
// Estrategia de chunking según tipo de fuente

// CSV de productos (catálogo)
// → Una fila = un chunk, con todos los campos relevantes
async function chunkCSV(csvBuffer: Buffer, orgId: string): Promise<string[]> {
  const records = await parseCSV(csvBuffer);
  return records.map(row => 
    `Producto: ${row.nombre}
Precio: ${row.precio}
Descripción: ${row.descripcion}
Disponibilidad: ${row.stock > 0 ? 'Disponible' : 'Sin stock'}
Categoría: ${row.categoria}`
  );
}

// PDF (catálogo, manual, FAQ)
// → Chunking por párrafos con overlap de 1 oración
// → Max 500 tokens por chunk
async function chunkPDF(pdfBuffer: Buffer): Promise<string[]> {
  const text = await extractTextFromPDF(pdfBuffer);
  return splitIntoChunks(text, { maxTokens: 500, overlap: 50 });
}

// Generar embeddings para cada chunk
async function embedAndStore(chunks: string[], orgId: string, sourceName: string): Promise<void> {
  const embeddings = await anthropic.embeddings.create({
    model: 'voyage-large-2', // o OpenAI text-embedding-3-small
    input: chunks,
  });
  
  const rows = chunks.map((content, i) => ({
    organization_id: orgId,
    source_type: 'csv',
    source_name: sourceName,
    content,
    embedding: embeddings.embeddings[i],
    is_active: true,
  }));
  
  await db.insert(knowledge_chunks).values(rows);
}
```

### Intent scoring — lógica de clasificación
```typescript
// El LLM evalúa el historial y devuelve un score estructurado
const intentPrompt = `
Analiza esta conversación de venta y asigna un puntaje de intención de compra.

Conversación:
${conversationHistory}

Responde SOLO con JSON:
{
  "intent_score": <número 0-100>,
  "reasoning": "<explicación breve>",
  "signals": ["<señal1>", "<señal2>"],
  "recommended_action": "follow_up|close_sale|provide_info|escalate"
}

Escala:
0-20: Sin interés (solo curiosidad, no pregunta por precio/stock)
21-50: Tibio (pregunta por precio o disponibilidad)
51-80: Caliente (pregunta por formas de pago, envío, confirma interés)
81-100: Comprador (pide confirmar pedido, proporciona datos de entrega)
`;
```

### Inbox unificado — funcionalidades
```
Vista de conversaciones:
├── Lista izquierda: leads ordenados por last_activity_at DESC
│   ├── Filtros: todos / sin leer / calientes / asignados a mí
│   └── Badge de intent_score (frío/tibio/caliente/convertido)
│
└── Panel derecho: conversación activa
    ├── Header: nombre del lead, canal, score, botón "Tomar control"
    ├── Historial de mensajes (burbujas diferenciadas: usuario / bot / agente)
    ├── Indicador de si el bot está activo o un humano está respondiendo
    └── Input de respuesta manual (visible cuando bot_active = false)

Kanban de leads:
├── Columnas: Frío / Tibio / Caliente / Convertido / Perdido
├── Cards con: nombre, canal, score, último mensaje, tiempo desde último contacto
└── Drag & drop para cambio manual de estado
```

### Escalado a humano — reglas
```typescript
const ESCALATION_TRIGGERS = [
  // Automático por confidence
  (msg: Message) => msg.confidence_score !== null && msg.confidence_score < 0.60,
  // Automático por intent alto
  (lead: Lead) => lead.intent_score >= 80 && !lead.assigned_to_user_id,
  // Palabras clave de escalado
  (msg: Message) => /hablar con una persona|quiero un humano|agente real/i.test(msg.content),
  // Conversación muy larga sin resolución
  (conv: Conversation) => conv.message_count > 15 && !conv.resolved_at,
];
```

### Objetivos de performance M3
| Métrica | Objetivo | Alerta si |
|---------|----------|-----------|
| Tiempo de primera respuesta del bot | < 60s | > 5min |
| Tasa de resolución sin humano | > 60% | < 40% |
| Tasa de calificación (warm+hot+converted) | > 20% | < 10% |
| Tasa de conversión (converted / total leads) | > 5% | < 2% |
| Latencia de búsqueda RAG (pgvector) | < 50ms | > 200ms |
| Latencia total de respuesta del bot (RAG + LLM + envío) | < 8s | > 15s |

---

## 5. KPIs del SaaS — métricas internas del negocio

Estas métricas son para el founder / equipo interno, NO para el cliente.

### Métricas de revenue
| KPI | Fórmula | Objetivo mes 6 | Frecuencia |
|-----|---------|----------------|-----------|
| MRR | `SUM(plan_price × orgs_activas_por_plan)` | $2,000 | Diario |
| ARR | `MRR × 12` | $24,000 | Diario |
| ARPU | `MRR / orgs_activas` | $45 | Mensual |
| LTV | `ARPU / churn_rate` | $1,500 | Mensual |

### Métricas de retención y churn
| KPI | Fórmula | Objetivo | Frecuencia |
|-----|---------|----------|-----------|
| Churn mensual | `orgs_canceladas / orgs_inicio_mes × 100` | < 3% | Mensual |
| Trial-to-paid | `orgs_que_pagaron / orgs_que_iniciaron_trial × 100` | > 15% | Mensual |
| LTV / CAC | `LTV / CAC` | > 3x | Mensual |

### Métricas de activación y producto
| KPI | Definición | Objetivo | Frecuencia |
|-----|-----------|----------|-----------|
| Activación D7 | % orgs que conectaron 2+ canales en los primeros 7 días | > 50% | Semanal |
| Módulos activos promedio | Promedio de módulos usados por org activa en el mes | > 2.5 | Mensual |
| DAU / MAU | Usuarios activos diarios vs mensuales (stickiness) | > 20% | Diario |
| Posts creados/org | Posts programados promedio por org activa | > 8/mes | Mensual |
| Conv. bot/org | Conversaciones procesadas promedio por org | > 50/mes | Mensual |
| NPS | Net Promoter Score (encuesta trimestral in-app) | > 45 | Trimestral |

---

## 6. Sistema de alertas — reglas de disparo

| Tipo de alerta | Trigger | Severidad | Acción sugerida |
|----------------|---------|-----------|-----------------|
| `token_expiring` | `token_expires_at < NOW() + 7 días` | warning | Botón "Reconectar" |
| `hot_lead` | `lead.intent_score >= bot_config.hot_lead_threshold` | info | Link al inbox |
| `post_failed` | `post_accounts.status = 'failed'` tras 3 reintentos | error | Botón "Reintentar" |
| `engagement_drop` | Engagement de los últimos 7 días < 50% del mes anterior | warning | Link a analytics |
| `plan_limit_near` | Uso actual > 80% del límite del plan | warning | Botón "Ver planes" |
| `sync_error` | Job de sync falla 2 veces consecutivas para un canal | error | Detalles del error |

---

## 7. Roles y permisos — matriz de acceso

| Acción | Viewer | Member | Admin | Owner |
|--------|--------|--------|-------|-------|
| Ver analytics | ✓ | ✓ | ✓ | ✓ |
| Exportar reportes | ✗ | ✓ | ✓ | ✓ |
| Crear/editar posts | ✗ | ✓ | ✓ | ✓ |
| Publicar posts | ✗ | ✓ | ✓ | ✓ |
| Ver inbox y leads | ✗ | ✓ | ✓ | ✓ |
| Responder como agente | ✗ | ✓ | ✓ | ✓ |
| Conectar/desconectar canales | ✗ | ✗ | ✓ | ✓ |
| Subir knowledge base | ✗ | ✗ | ✓ | ✓ |
| Configurar bot | ✗ | ✗ | ✓ | ✓ |
| Gestionar miembros del equipo | ✗ | ✗ | ✓ | ✓ |
| Cambiar plan de suscripción | ✗ | ✗ | ✗ | ✓ |
| Eliminar la organización | ✗ | ✗ | ✗ | ✓ |

---

## 8. Roadmap de desarrollo — fases y prioridades

### Fase 1 — Fundación (semanas 1–8)
**Objetivo:** tener un sistema funcional y seguro donde un negocio puede conectar canales y ver sus primeras métricas.

```
Auth & Core:
├── Sistema de auth completo (JWT + refresh token + MFA)
├── Onboarding de organización (pasos 1 y 2)
├── Middleware de tenant isolation con RLS
└── Panel de admin interno (ver orgs, usage, logs)

Módulo 1 MVP:
├── OAuth de Facebook + Instagram
├── Job de ingesta de métricas (cada 4h)
├── Dashboard básico: alcance, engagement, followers, top 3 posts
└── Gráfica de evolución 30 días

Infraestructura:
├── PostgreSQL + Redis + BullMQ
├── Docker Compose para desarrollo local
├── CI/CD básico (GitHub Actions → staging)
└── Environments: local / staging / producción
```

### Fase 2 — Contenido y más canales (semanas 9–16)
```
Módulo 2 MVP:
├── Upload de assets con validación de mime
├── Procesamiento Sharp: variantes por plataforma
├── Scheduler de publicaciones + calendario visual
├── Publicación directa FB/IG/LinkedIn
└── Biblioteca de assets y historial de publicaciones

Analytics ampliado:
├── LinkedIn + TikTok analytics
├── Gráficas comparativas multi-canal
└── Exportación PDF y Excel
```

### Fase 3 — Bot IA (semanas 17–24)
```
Módulo 3 MVP:
├── Onboarding de knowledge base (CSV + PDF)
├── Pipeline RAG: chunking → embeddings → pgvector
├── Bot activo en Instagram DMs + Facebook Messenger
├── Inbox unificado con historial de conversaciones
├── Clasificación de leads con intent scoring
├── Pipeline kanban de leads
└── Alertas de leads calientes + escalado a humano
```

### Fase 4 — Crecimiento (semanas 25–32)
```
Producto:
├── WhatsApp Business API (Módulo 3 ampliado)
├── Flujos automatizados de seguimiento de leads
├── White-label para agencias (reportes + dominio personalizado)
├── Multi-cliente dashboard (una org gestiona varias cuentas de clientes)
└── API pública v1 (documentada con OpenAPI)

Negocio:
├── Landing page + documentación
├── Onboarding gamificado
└── Primeros 100 clientes pagos
```

---

## 9. Integraciones externas — inventario técnico

| Servicio | Uso | Plan mínimo | Variables de entorno |
|----------|-----|------------|---------------------|
| **Meta Graph API** | Métricas + publicación FB/IG + webhooks DM | Business App aprobada | `META_APP_ID`, `META_APP_SECRET` |
| **LinkedIn Marketing API** | Métricas + publicación | App aprobada por LinkedIn | `LINKEDIN_CLIENT_ID`, `LINKEDIN_CLIENT_SECRET` |
| **TikTok Business API** | Métricas de cuenta y videos | Business App | `TIKTOK_APP_ID`, `TIKTOK_APP_SECRET` |
| **Anthropic API** | LLM para respuestas del bot + intent scoring | Pay-per-use | `ANTHROPIC_API_KEY` |
| **OpenAI / Voyage AI** | Embeddings de knowledge base | Pay-per-use | `OPENAI_API_KEY` o `VOYAGE_API_KEY` |
| **Stripe** | Billing, suscripciones, webhooks de pago | Standard | `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` |
| **Resend** | Emails transaccionales (verificación, alertas) | Free tier: 3k/mes | `RESEND_API_KEY` |
| **MinIO / Cloudflare R2** | Storage de assets y variantes | Self-hosted / Pay-per-use | `STORAGE_ENDPOINT`, `STORAGE_ACCESS_KEY`, `STORAGE_SECRET_KEY` |

---

## 10. Estructura de la API REST

### Convenciones
- Base URL: `https://api.omnipresence.io/v1`
- Autenticación: `Authorization: Bearer {access_token}`
- Tenant: extraído del JWT (nunca en la URL ni en el body)
- Paginación: `?page=1&limit=20` + respuesta `{data, total, page, limit, has_more}`
- Fechas: ISO 8601 en UTC siempre
- Errores: `{error: {code, message, details?}}`

### Endpoints por módulo

#### Auth
```
POST /auth/register          — crear cuenta + organización
POST /auth/login             — email + password → tokens
POST /auth/refresh           — refresh token → nuevo access token
POST /auth/logout            — revocar sesión
POST /auth/mfa/enable        — generar TOTP secret + QR
POST /auth/mfa/verify        — verificar código TOTP
POST /auth/forgot-password   — enviar email de recuperación
POST /auth/reset-password    — aplicar nueva contraseña
```

#### Organización y equipo
```
GET    /org                  — datos de la org del usuario autenticado
PATCH  /org                  — actualizar nombre, settings, timezone
GET    /org/members          — listar miembros
POST   /org/members/invite   — invitar por email
PATCH  /org/members/:id      — cambiar rol
DELETE /org/members/:id      — remover miembro
GET    /org/usage            — uso actual vs límites del plan
```

#### Canales (social connections)
```
GET    /channels             — listar canales conectados
POST   /channels/oauth/init  — iniciar OAuth flow → retorna auth_url
POST   /channels/oauth/callback — recibir code, guardar tokens
DELETE /channels/:id         — desconectar canal
GET    /channels/:id/sync    — forzar sync de métricas del canal
```

#### Analytics
```
GET /analytics/overview      — KPIs agregados del período
GET /analytics/channels      — métricas por canal
GET /analytics/posts         — métricas por publicación
GET /analytics/export        — exportar PDF o Excel (query params: format, from, to)
```

#### Content Hub
```
POST   /assets/upload        — subir archivo → iniciar procesamiento
GET    /assets               — listar biblioteca de assets
GET    /assets/:id           — detalle del asset con variantes
DELETE /assets/:id           — eliminar asset y variantes del storage

GET    /posts                — listar posts (con filtros de estado, canal, fecha)
POST   /posts                — crear post (draft o con scheduled_at)
GET    /posts/:id            — detalle del post
PATCH  /posts/:id            — editar draft o reprogramar
DELETE /posts/:id            — cancelar/archivar post
POST   /posts/:id/publish    — publicar inmediatamente
```

#### Bot y leads
```
GET    /bot/config           — configuración del bot de la org
PUT    /bot/config           — actualizar configuración
GET    /bot/knowledge        — listar chunks de la knowledge base
POST   /bot/knowledge/upload — subir CSV, PDF o texto para procesar
DELETE /bot/knowledge/:id    — desactivar chunk

GET    /inbox                — listar conversaciones (con filtros)
GET    /inbox/:id            — conversación con mensajes
POST   /inbox/:id/message    — enviar mensaje manual como agente
PATCH  /inbox/:id/handoff    — tomar control / devolver al bot

GET    /leads                — listar leads (con filtros de status, score, canal)
GET    /leads/:id            — detalle del lead + historial de conversación
PATCH  /leads/:id            — actualizar status, notas, conversion_value
DELETE /leads/:id/gdpr-erase — anonimizar datos personales del lead
```

#### Alertas
```
GET   /alerts               — listar alertas (no leídas primero)
PATCH /alerts/:id/read      — marcar como leída
POST  /alerts/read-all      — marcar todas como leídas
```

---

## 11. Arquitectura frontend — Next.js App Router

### Estructura de rutas
```
app/
├── (auth)/
│   ├── login/page.tsx
│   ├── register/page.tsx
│   └── onboarding/page.tsx        — flujo de 4 pasos
├── (dashboard)/
│   ├── layout.tsx                 — sidebar + topbar + auth guard
│   ├── page.tsx                   — redirect a /analytics
│   ├── analytics/
│   │   ├── page.tsx               — dashboard overview
│   │   └── [channel]/page.tsx     — drill-down por canal
│   ├── publish/
│   │   ├── page.tsx               — calendario de contenido
│   │   ├── new/page.tsx           — nueva publicación
│   │   └── library/page.tsx       — biblioteca de assets
│   ├── inbox/
│   │   ├── page.tsx               — lista de conversaciones
│   │   └── [id]/page.tsx          — conversación individual
│   ├── leads/page.tsx             — kanban + lista de leads
│   ├── bot/page.tsx               — configuración del bot + knowledge base
│   └── settings/
│       ├── page.tsx               — ajustes de la org
│       ├── channels/page.tsx      — gestión de canales conectados
│       ├── team/page.tsx          — gestión de miembros
│       └── billing/page.tsx       — plan y facturación
└── api/
    └── webhooks/
        ├── meta/route.ts          — webhook de Meta
        └── stripe/route.ts        — webhook de Stripe
```

### Gestión de estado del cliente
- **Server Components** para datos que no necesitan interactividad (listas, dashboards)
- **TanStack Query** para fetching y caching de datos del cliente con invalidación inteligente
- **Zustand** solo para estado UI global: sidebar abierto/cerrado, notificaciones in-app
- **React Hook Form + Zod** para todos los formularios con validación tipo-safe

### Tiempo real
- **Server-Sent Events (SSE)** para notificaciones de alertas en tiempo real y progreso de procesamiento de assets
- **No WebSockets en v1** — SSE es suficiente para el caso de uso inicial y más simple de manejar

---

## 12. Reglas de negocio críticas — no omitir

1. **Un tenant nunca ve datos de otro** — verificación en DB (RLS) + en capa de servicio
2. **Los planes se hacen cumplir en el servidor**, no en el frontend
3. **Los tokens OAuth se cifran antes de tocar la DB** y se descifran solo en memoria al usarlos
4. **Un lead no puede tener intent_score reducido manualmente** si ya está en `converted` — protección del historial de ventas
5. **El bot nunca responde si `bot_config.is_active = false`** para esa org — aunque lleguen webhooks
6. **Los jobs de ingesta de métricas son idempotentes** — upsert por `connection_id + metric_date`
7. **Los webhooks de Meta se responden con 200 en menos de 5 segundos** — procesar de forma asíncrona en background, confirmar recepción de inmediato
8. **Las publicaciones fallidas se reintentan máximo 3 veces** con backoff exponencial — después se marcan como `failed` y se alerta al usuario
9. **El audit log es inmutable** — ningún endpoint permite UPDATE o DELETE en `audit_events`
10. **Soft delete en leads** — nunca `DELETE` físico, siempre `deleted_at = NOW()` para mantener historial de métricas

---

## 13. Response types de la API — TypeScript (fuente de verdad)

Estos tipos viven en `packages/types/src/api.ts` y son importados tanto por el backend (NestJS) como por el frontend (Next.js). Nunca definir los mismos tipos en dos lugares.

```typescript
// ── Auth ─────────────────────────────────────────────────────────────────────
export interface LoginResponse {
  accessToken: string;
  user: {
    id: string;
    name: string;
    email: string;
    role: 'owner' | 'admin' | 'member' | 'viewer';
    avatarUrl: string | null;
  };
  org: {
    id: string;
    name: string;
    plan: 'free' | 'pro' | 'business' | 'agency';
    trialEndsAt: string | null;
  };
}

// ── Analytics ────────────────────────────────────────────────────────────────
export interface GetAnalyticsOverviewResponse {
  period: { from: string; to: string };
  kpis: {
    totalReach: number;
    avgEngagementRate: number;   // porcentaje: 4.2 = 4.2%
    totalLeads: number;
    costPerLead: number | null;
    totalSpend: number;
    totalConversions: number;
    roas: number | null;
  };
  reachOverTime: Array<{ date: string; value: number }>;
  engagementOverTime: Array<{ date: string; value: number }>;
  topPosts: Array<{
    id: string;
    caption: string;
    platform: string;
    engagementRate: number;
    reach: number;
    publishedAt: string;
  }>;
  channels: ChannelSummary[];
}

export interface ChannelSummary {
  id: string;
  platform: 'facebook' | 'instagram' | 'tiktok' | 'linkedin';
  username: string;
  followers: number;
  followersDelta: number;
  totalReach: number;
  avgEngagementRate: number;
  totalSpend: number;
  totalLeads: number;
  roas: number | null;
  isActive: boolean;
  lastSyncedAt: string | null;
}

// ── Posts ────────────────────────────────────────────────────────────────────
export interface Post {
  id: string;
  status: 'draft' | 'scheduled' | 'publishing' | 'published' | 'failed' | 'cancelled';
  captionTemplate: string;
  platformCaptions: Record<string, string>;
  platformHashtags: Record<string, string[]>;
  scheduledAt: string | null;
  publishedAt: string | null;
  author: { id: string; name: string } | null;
  assets: PostAssetResponse[];
  accounts: PostAccountResponse[];
  createdAt: string;
  updatedAt: string;
}

export interface PostAssetResponse {
  id: string;
  assetType: 'image' | 'video' | 'carousel';
  variants: Array<{
    platform: string;
    format: string;
    width: number;
    height: number;
    url: string;          // URL firmada con expiración de 15 minutos
  }>;
}

export interface PostAccountResponse {
  id: string;
  platform: string;
  username: string;
  status: 'pending' | 'publishing' | 'published' | 'failed' | 'skipped';
  errorMessage: string | null;
  publishedAt: string | null;
  retryCount: number;
}

// ── Leads ────────────────────────────────────────────────────────────────────
export interface Lead {
  id: string;
  platform: string;
  displayName: string;
  status: 'cold' | 'warm' | 'hot' | 'converted' | 'lost';
  intentScore: number;         // 0-100
  firstContactSource: string;
  firstContactAt: string;
  lastActivityAt: string;
  convertedAt: string | null;
  conversionValue: number | null;
  notes: string | null;
  conversationCount: number;
}

export interface ConversationWithMessages {
  id: string;
  leadId: string;
  platform: string;
  botActive: boolean;
  handoffReason: string | null;
  messageCount: number;
  lastMessageAt: string;
  assignedTo: { id: string; name: string } | null;
  messages: MessageResponse[];
}

export interface MessageResponse {
  id: string;
  direction: 'inbound' | 'outbound';
  content: string;
  senderType: 'user' | 'bot' | 'agent';
  confidenceScore: number | null;
  createdAt: string;
}

// ── Error estándar — todos los endpoints devuelven esta forma en caso de error ──
export interface ApiError {
  error: {
    code:
      | 'UNAUTHORIZED'
      | 'FORBIDDEN'
      | 'NOT_FOUND'
      | 'VALIDATION_ERROR'
      | 'PLAN_LIMIT_EXCEEDED'
      | 'CAPTCHA_FAILED'
      | 'SLUG_TAKEN'
      | 'CHANNEL_ALREADY_CONNECTED'
      | 'BOT_NOT_CONFIGURED'
      | 'TOKEN_EXPIRED'
      | 'INTERNAL_ERROR'
      | 'SERVICE_UNAVAILABLE';
    message: string;       // Mensaje en español para mostrar al usuario
    details?: unknown;     // Solo en VALIDATION_ERROR: errores campo a campo
    upgrade_url?: string;  // Solo en PLAN_LIMIT_EXCEEDED
  };
}

// ── Paginación estándar ───────────────────────────────────────────────────────
export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  hasMore: boolean;
}
```

---

## 14. Emails transaccionales — catálogo completo

Todos los emails se envían vía **Resend** desde `hola@omnipresence.io`. La función `sendEmail()` (ver SKILL_03 §14.1) es el único punto de entrada para el envío.

| ID | Trigger | Asunto | Datos requeridos |
|----|---------|--------|-----------------|
| `verify_email` | POST /auth/register | "Verifica tu correo — OmniPresence" | `{ name, verification_url }` |
| `welcome` | Email verificado | "¡Bienvenido a OmniPresence!" | `{ name, org_name, dashboard_url }` |
| `forgot_password` | POST /auth/forgot-password | "Restablecer contraseña" | `{ name, reset_url, expires_in }` |
| `member_invited` | POST /org/members/invite | "Te invitaron a [org]" | `{ inviter_name, org_name, accept_url }` |
| `token_expiring` | Job diario de revisión de tokens | "Reconecta tu cuenta de [plataforma]" | `{ org_name, platform, reconnect_url, days_left }` |
| `hot_lead_alert` | Bot: intent_score >= hot_lead_threshold | "Lead caliente: [nombre]" | `{ lead_name, platform, score, inbox_url }` |
| `billing_welcome` | invoice.paid (primer pago) | "Bienvenido al plan [plan]" | `{ org_name, plan, amount, next_billing_date }` |
| `billing_upgrade` | subscription.updated (upgrade) | "Tu plan fue actualizado a [plan]" | `{ org_name, new_plan, effective_date }` |
| `payment_failed_first` | invoice.payment_failed (1er intento) | "Problema con tu pago" | `{ org_name, amount, update_url, deadline }` |
| `payment_failed_suspended` | invoice.payment_failed (3er intento) | "Cuenta suspendida temporalmente" | `{ org_name, update_url }` |
| `subscription_canceled` | subscription.deleted | "Tu suscripción fue cancelada" | `{ org_name, access_until, reactivate_url }` |
| `trial_ending_soon` | Job 3 días antes de trial_ends_at | "Tu trial vence en 3 días" | `{ org_name, trial_ends_at, plans_url }` |
| `trial_expired` | Job cuando trial_ends_at < NOW() | "Tu período de prueba terminó" | `{ org_name, plans_url }` |

### 14.1 Función helper de envío
```typescript
// Tipado estricto — no se puede enviar un email con datos incorrectos
async function sendEmail<T extends EmailTemplateId>(
  template: T,
  recipientOrgIdOrEmail: string,
  data: EmailTemplateData[T]
): Promise<void> {
  const to = recipientOrgIdOrEmail.includes('@')
    ? recipientOrgIdOrEmail
    : await getOrgOwnerEmail(recipientOrgIdOrEmail);

  await resend.emails.send({
    from: 'OmniPresence <hola@omnipresence.io>',
    to,
    subject: EMAIL_SUBJECTS[template](data),
    html: renderEmailTemplate(template, data),
  });

  // Loguear sin datos PII (solo tipo y destinatario ofuscado)
  logger.info({
    template,
    recipient: to.replace(/(.{2}).*(@.*)/, '$1***$2'),
  }, 'Email sent');
}
```

---

## 15. Códigos de error del negocio

```typescript
// packages/types/src/enums.ts — catálogo canónico de error codes
export const ERROR_CODES = {
  // Autenticación y autorización
  UNAUTHORIZED:              'UNAUTHORIZED',              // 401: sin token o token inválido
  FORBIDDEN:                 'FORBIDDEN',                 // 403: sin permisos para la acción
  MFA_REQUIRED:              'MFA_REQUIRED',              // 403: la acción requiere MFA activo
  SESSION_EXPIRED:           'SESSION_EXPIRED',           // 401: hacer refresh del access token

  // Validación de datos
  VALIDATION_ERROR:          'VALIDATION_ERROR',          // 422: campos incorrectos o faltantes
  NOT_FOUND:                 'NOT_FOUND',                 // 404: recurso no encontrado

  // Límites y planes
  PLAN_LIMIT_EXCEEDED:       'PLAN_LIMIT_EXCEEDED',       // 402: límite del plan alcanzado
  CAPTCHA_FAILED:            'CAPTCHA_FAILED',            // 400: verificación CAPTCHA fallida

  // Negocio
  SLUG_TAKEN:                'SLUG_TAKEN',                // 409: slug de organización ya en uso
  CHANNEL_ALREADY_CONNECTED: 'CHANNEL_ALREADY_CONNECTED',// 409: canal ya conectado
  BOT_NOT_CONFIGURED:        'BOT_NOT_CONFIGURED',        // 400: bot sin knowledge base cargada
  TOKEN_EXPIRED:             'TOKEN_EXPIRED',             // 400: token OAuth del canal vencido

  // Sistema
  INTERNAL_ERROR:            'INTERNAL_ERROR',            // 500: error inesperado del servidor
  SERVICE_UNAVAILABLE:       'SERVICE_UNAVAILABLE',       // 503: dependencia externa caída (Meta API, Stripe, etc.)
} as const;

export type ErrorCode = typeof ERROR_CODES[keyof typeof ERROR_CODES];
```

---

## 16. Notificaciones en tiempo real (SSE)

```typescript
// GET /sse?token={accessToken}
// El cliente se conecta y recibe eventos del servidor sin polling

// Eventos que el servidor emite al cliente conectado:
// 'alert'           → nueva alerta creada para la org (invalida query de alertas)
// 'new_message'     → nuevo mensaje en el inbox (invalida lista de conversaciones)
// 'asset_processed' → variantes de un asset listas para usar (invalida detalle del asset)
// 'post_published'  → post publicado con éxito o fallido (invalida lista de posts)

// El servidor emite eventos vía Redis Pub/Sub:
// publish: `sse:${orgId}` → JSON con { type, data }
// El servicio SSE está suscrito por org y hace streaming al cliente

// Formato del evento emitido:
interface SSEEvent {
  type: 'alert' | 'new_message' | 'asset_processed' | 'post_published';
  data: {
    // Para 'new_message':
    conversationId?: string;
    // Para 'asset_processed':
    assetId?: string;
    // Para 'post_published':
    postId?: string;
    status?: 'published' | 'failed';
  };
}
```

