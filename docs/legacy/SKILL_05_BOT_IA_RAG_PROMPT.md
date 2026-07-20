# SKILL 05 — Bot IA, RAG y Prompt Engineering
## OmniPresence Suite · SaaS Multi-tenant

> **Propósito de este skill:** Define la arquitectura completa del módulo de IA conversacional: procesamiento de la knowledge base, estrategia de RAG, construcción del system prompt, intent scoring, extracción de datos del lead, gestión del contexto de conversación, defensa contra prompt injection y optimización de costos. Es la guía canónica para construir el módulo más diferenciador de OmniPresence.

---

## 1. Arquitectura general del pipeline del bot

```
INBOUND MESSAGE (Meta Webhook)
         │
         ▼
[1] RECEPCIÓN Y VALIDACIÓN
    - Verificar firma HMAC (ver SKILL_01 §4)
    - Check de idempotencia en webhook_events
    - Responder 200 inmediatamente — procesar en background (BullMQ)
         │
         ▼
[2] CONTEXTO Y ESTADO
    - Identificar social_connection por recipient_id
    - Verificar bot_config.is_active = true para la org
    - Buscar o crear lead por platform_user_id
    - Buscar o crear conversation por platform_thread_id
    - Guardar message inbound en DB
         │
         ▼
[3] SANITIZACIÓN DEL INPUT (ver §7)
    - Detectar y bloquear intentos de prompt injection
    - Limpiar caracteres de control y HTML
         │
         ▼
[4] RAG — RECUPERACIÓN DE CONTEXTO (ver §3)
    - Generar embedding del mensaje del usuario
    - Búsqueda por similitud coseno en knowledge_chunks (solo del tenant)
    - Top 5 chunks más relevantes con score > 0.72
         │
         ▼
[5] CONSTRUCCIÓN DEL PROMPT (ver §4)
    - System prompt con contexto del negocio + chunks recuperados
    - Historial de conversación: últimos 10 mensajes
    - Instrucciones de tono, formato y handoff
         │
         ▼
[6] LLM — GENERACIÓN DE RESPUESTA
    - Modelo: claude-haiku-4-5 (respuestas, velocidad, costo)
    - structured output: { response, confidence, intent_score, signals, captured_data }
         │
         ▼
[7] DECISIÓN DE ENVÍO O ESCALADO
    - confidence >= threshold (0.60): enviar respuesta
    - confidence < threshold: escalado a humano
    - intent_score >= hot_lead_threshold (70): alerta inmediata
         │
         ▼
[8] PERSISTENCIA Y ACTUALIZACIÓN
    - Guardar message outbound (con confidence y rag_chunks_used)
    - Actualizar lead.intent_score y lead.last_activity_at
    - Trigger sync_lead_status actualiza lead.status
    - Crear alerta si es hot_lead no asignado
         │
         ▼
[9] ENVÍO DE RESPUESTA
    - Llamar a la API de la plataforma (Meta Graph API)
    - Delay simulado: bot_config.auto_response_delay_sec (default 3s)
```

---

## 2. Procesamiento de la knowledge base

### 2.1 Estrategia de chunking por tipo de fuente

```typescript
// Tamaño máximo de chunk: 400 tokens (~300 palabras)
// Overlap entre chunks: 50 tokens (~40 palabras)
// Razón: chunks pequeños = mayor precisión en retrieval
//        overlap = no perder contexto en los cortes

const CHUNK_CONFIG = {
  maxTokens: 400,
  overlapTokens: 50,
  minChunkTokens: 50,   // descartar chunks muy pequeños (ej: solo un encabezado)
} as const;

// ── TIPO 1: CSV de catálogo de productos ──────────────────────────────────────
// Una fila = un chunk. Concatenar campos en formato legible por el LLM.
// NUNCA usar JSON crudo — el LLM lo lee peor.
async function chunkCSV(csvBuffer: Buffer, orgId: string): Promise<ChunkInput[]> {
  const records = await parseCSV(csvBuffer, { headers: true, skipEmpty: true });

  return records
    .filter(row => Object.values(row).some(v => v?.trim()))  // descartar filas vacías
    .map((row, index) => {
      // Construir texto descriptivo del producto
      const lines = [];
      if (row.nombre || row.name || row.producto)
        lines.push(`Producto: ${row.nombre || row.name || row.producto}`);
      if (row.precio || row.price)
        lines.push(`Precio: ${row.precio || row.price}`);
      if (row.descripcion || row.description)
        lines.push(`Descripción: ${row.descripcion || row.description}`);
      if (row.stock !== undefined)
        lines.push(`Disponibilidad: ${Number(row.stock) > 0 ? 'En stock' : 'Sin stock'}`);
      if (row.categoria || row.category)
        lines.push(`Categoría: ${row.categoria || row.category}`);
      if (row.tallas || row.sizes)
        lines.push(`Tallas disponibles: ${row.tallas || row.sizes}`);
      if (row.colores || row.colors)
        lines.push(`Colores: ${row.colores || row.colors}`);

      return {
        content: lines.join('\n'),
        metadata: { source_type: 'csv', row_index: index, ...row },
      };
    })
    .filter(chunk => chunk.content.length > 20); // filtrar chunks sin contenido útil
}

// ── TIPO 2: PDF (catálogo, manual, FAQ) ──────────────────────────────────────
// Extraer texto por página → dividir en párrafos → chunking con overlap
async function chunkPDF(pdfBuffer: Buffer): Promise<ChunkInput[]> {
  const pages = await extractPDFPages(pdfBuffer); // una entrada por página
  const allText = pages
    .map((page, i) => `[Página ${i + 1}]\n${page.text}`)
    .join('\n\n');

  return splitTextIntoChunks(allText, CHUNK_CONFIG);
}

// ── TIPO 3: Texto libre (FAQ manual, políticas, instrucciones especiales) ─────
// Dividir por doble salto de línea → chunking con overlap si son muy largos
async function chunkText(text: string): Promise<ChunkInput[]> {
  const paragraphs = text.split(/\n\n+/).filter(p => p.trim().length > 20);

  const chunks: ChunkInput[] = [];
  let buffer = '';

  for (const para of paragraphs) {
    const combined = buffer ? `${buffer}\n\n${para}` : para;
    if (estimateTokens(combined) > CHUNK_CONFIG.maxTokens) {
      if (buffer) chunks.push({ content: buffer.trim(), metadata: {} });
      buffer = para;
    } else {
      buffer = combined;
    }
  }
  if (buffer.trim()) chunks.push({ content: buffer.trim(), metadata: {} });

  return chunks;
}

// ── Función de estimación de tokens (aproximada) ─────────────────────────────
function estimateTokens(text: string): number {
  // Aproximación: 1 token ≈ 4 caracteres en español
  return Math.ceil(text.length / 4);
}
```

### 2.2 Generación de embeddings y almacenamiento

```typescript
interface ChunkInput {
  content: string;
  metadata: Record<string, unknown>;
}

async function embedAndStoreChunks(
  chunks: ChunkInput[],
  orgId: string,
  sourceName: string,
  sourceType: 'csv' | 'pdf' | 'text'
): Promise<void> {

  // Procesar en lotes de 100 para no exceder límites de la API de embeddings
  const BATCH_SIZE = 100;

  for (let i = 0; i < chunks.length; i += BATCH_SIZE) {
    const batch = chunks.slice(i, i + BATCH_SIZE);
    const texts = batch.map(c => c.content);

    // Usar OpenAI text-embedding-3-small (1536 dims, $0.02/1M tokens)
    // Compatible con el campo vector(1536) del schema
    const response = await openai.embeddings.create({
      model: 'text-embedding-3-small',
      input: texts,
    });

    const rows = batch.map((chunk, j) => ({
      organization_id: orgId,
      source_type: sourceType,
      source_name: sourceName,
      content: chunk.content,
      embedding: response.data[j].embedding,
      metadata: chunk.metadata,
      is_active: true,
    }));

    await db.insert(knowledge_chunks).values(rows);
  }
}

// Cuando se sube un nuevo catálogo: desactivar el anterior del mismo nombre
async function replaceKnowledgeSource(
  orgId: string,
  sourceName: string,
  newChunks: ChunkInput[],
  sourceType: 'csv' | 'pdf' | 'text'
): Promise<void> {

  // 1. Desactivar chunks del source anterior (soft delete)
  await db.update(knowledge_chunks)
    .set({ is_active: false, deleted_at: new Date() })
    .where(and(
      eq(knowledge_chunks.organization_id, orgId),
      eq(knowledge_chunks.source_name, sourceName),
      eq(knowledge_chunks.is_active, true)
    ));

  // 2. Insertar nuevos chunks
  await embedAndStoreChunks(newChunks, orgId, sourceName, sourceType);

  await logAuditEvent('knowledge.replaced', { orgId, sourceName, chunkCount: newChunks.length });
}
```

---

## 3. Retrieval — búsqueda semántica

```typescript
interface RetrievedChunk {
  id: string;
  content: string;
  similarity: number;
  metadata: Record<string, unknown>;
}

// CRÍTICO: filtrar por org ANTES del cálculo vectorial (ver SKILL_01 §6)
async function retrieveRelevantChunks(
  query: string,
  orgId: string,
  topK = 5,
  similarityThreshold = 0.72
): Promise<RetrievedChunk[]> {

  // 1. Generar embedding del mensaje del usuario
  const queryEmbedding = await openai.embeddings.create({
    model: 'text-embedding-3-small',
    input: query,
  });

  const embedding = queryEmbedding.data[0].embedding;

  // 2. Búsqueda vectorial con filtro de tenant PRIMERO
  // La cláusula WHERE org_id = ? hace que PostgreSQL use el índice parcial
  // antes de calcular las distancias — crucial para performance y seguridad
  const results = await db.execute<RetrievedChunk>(sql`
    SELECT
      id,
      content,
      metadata,
      1 - (embedding <=> ${JSON.stringify(embedding)}::vector) AS similarity
    FROM knowledge_chunks
    WHERE
      organization_id = ${orgId}
      AND is_active = true
      AND deleted_at IS NULL
      AND 1 - (embedding <=> ${JSON.stringify(embedding)}::vector) > ${similarityThreshold}
    ORDER BY embedding <=> ${JSON.stringify(embedding)}::vector
    LIMIT ${topK}
  `);

  return results.rows;
}
```

---

## 4. System prompt y construcción del contexto

### 4.1 System prompt completo
```typescript
function buildSystemPrompt(
  botConfig: BotConfig,
  chunks: RetrievedChunk[],
  conversationHistory: Message[]
): string {

  const contextSection = chunks.length > 0
    ? `## Información disponible del negocio\n\n${chunks.map((c, i) => `[${i + 1}] ${c.content}`).join('\n\n---\n\n')}`
    : '## Información disponible del negocio\n\nNo se encontró información específica para esta consulta.';

  const toneInstructions: Record<string, string> = {
    formal:       'Usa un tono formal y profesional. Trata al cliente de "usted".',
    amigable:     'Usa un tono amigable y cercano. Trata al cliente de "tú". Puedes usar emojis con moderación.',
    casual:       'Usa un tono muy informal y desenfadado. Usa "tú", emojis frecuentes y lenguaje coloquial.',
    profesional:  'Usa un tono profesional pero accesible. Trata al cliente de "usted" en el primer mensaje y adapta después.',
  };

  const customInstructions = botConfig.custom_instructions
    ? `\n## Instrucciones adicionales del negocio\n${botConfig.custom_instructions}`
    : '';

  return `Eres el asistente de atención al cliente de "${botConfig.business_name}".
Tu función es responder consultas de clientes potenciales sobre los productos y servicios del negocio.

## Reglas absolutas
- Solo respondes con base en la información del negocio proporcionada más abajo
- Si no tienes información suficiente para responder, di: "${botConfig.escalation_message}"
- Nunca inventes precios, disponibilidad, características ni políticas que no estén en el contexto
- Nunca menciones competidores, otras empresas ni información externa
- Si el usuario pregunta directamente si eres un bot o IA, puedes confirmarlo con naturalidad
- No respondas preguntas que no sean sobre el negocio (política, religión, temas personales, etc.)
- Cada respuesta debe ser concisa: máximo 3-4 oraciones o una lista corta si aplica

## Tono y estilo
${toneInstructions[botConfig.tone] || toneInstructions.amigable}
Responde siempre en el mismo idioma en que te escribe el cliente.
${customInstructions}

${contextSection}

## Extracción de datos del lead
Durante la conversación, si el cliente menciona su nombre, correo electrónico o número de teléfono, captúralo en tu respuesta estructurada. NO pidas estos datos explícitamente — solo captura lo que el cliente mencione voluntariamente.

## Escalado a humano
Si detectas que el cliente está muy interesado en comprar o tiene preguntas muy específicas que no puedes responder, finaliza con: "${botConfig.escalation_message}"`;
}
```

### 4.2 Gestión del historial de conversación

```typescript
// Ventana de conversación: últimos 10 mensajes para no exceder el contexto
// Si la conversación es más larga, resumir los anteriores

const MAX_HISTORY_MESSAGES = 10;
const MAX_HISTORY_TOKENS = 2000;

function buildConversationMessages(
  messages: Message[],
  newUserMessage: string
): Array<{ role: 'user' | 'assistant'; content: string }> {

  // Tomar los últimos N mensajes para mantener contexto reciente
  const recentMessages = messages
    .slice(-MAX_HISTORY_MESSAGES)
    .filter(m => m.content.trim().length > 0);

  const historyMessages = recentMessages.map(m => ({
    role: m.sender_type === 'user' ? 'user' as const : 'assistant' as const,
    content: m.content,
  }));

  // Añadir el mensaje actual del usuario
  historyMessages.push({ role: 'user', content: newUserMessage });

  return historyMessages;
}
```

---

## 5. Respuesta estructurada del LLM

### 5.1 Schema de respuesta (structured output)

```typescript
interface BotResponse {
  response_text: string;          // texto que se envía al usuario
  confidence: number;             // 0.0 - 1.0: qué tan seguro está el bot de la respuesta
  intent_score: number;           // 0-100: intención de compra detectada
  intent_reasoning: string;       // explicación breve del score
  signals: string[];              // señales detectadas ("preguntó por precio", "confirmó dirección")
  recommended_action: 'follow_up' | 'close_sale' | 'provide_info' | 'escalate';
  captured_data: {                // datos del lead capturados en el mensaje
    name?: string;
    email?: string;
    phone?: string;
    product_interest?: string;    // qué producto le interesa
    delivery_address?: string;    // dirección si la mencionó
  };
  should_escalate: boolean;       // true si se debe transferir a humano
  escalation_reason?: string;     // razón del escalado si should_escalate = true
}

// Llamada al LLM con structured output
async function callLLMForResponse(
  systemPrompt: string,
  conversationMessages: Array<{ role: 'user' | 'assistant'; content: string }>,
  botConfig: BotConfig
): Promise<BotResponse> {

  const response = await anthropic.messages.create({
    model: 'claude-haiku-4-5',
    max_tokens: 500,
    system: systemPrompt + `\n\n## Formato de respuesta
Responde ÚNICAMENTE con un objeto JSON válido con esta estructura exacta:
{
  "response_text": "<respuesta para el cliente>",
  "confidence": <número 0.0-1.0>,
  "intent_score": <número 0-100>,
  "intent_reasoning": "<explicación breve>",
  "signals": ["<señal1>", "<señal2>"],
  "recommended_action": "<follow_up|close_sale|provide_info|escalate>",
  "captured_data": { "name": null, "email": null, "phone": null, "product_interest": null },
  "should_escalate": <true|false>,
  "escalation_reason": null
}
No incluyas texto fuera del JSON.`,
    messages: conversationMessages,
  });

  const rawText = response.content[0].type === 'text' ? response.content[0].text : '';

  // Parsear con manejo de error robusto
  try {
    const clean = rawText.replace(/```json|```/g, '').trim();
    const parsed = JSON.parse(clean) as BotResponse;

    // Validar que los campos críticos existen y tienen tipos correctos
    return {
      response_text: String(parsed.response_text || botConfig.escalation_message),
      confidence: Math.max(0, Math.min(1, Number(parsed.confidence) || 0.5)),
      intent_score: Math.max(0, Math.min(100, Number(parsed.intent_score) || 0)),
      intent_reasoning: String(parsed.intent_reasoning || ''),
      signals: Array.isArray(parsed.signals) ? parsed.signals : [],
      recommended_action: parsed.recommended_action || 'provide_info',
      captured_data: parsed.captured_data || {},
      should_escalate: Boolean(parsed.should_escalate),
      escalation_reason: parsed.escalation_reason || undefined,
    };
  } catch {
    // Fallback si el LLM no devolvió JSON válido
    return {
      response_text: botConfig.escalation_message,
      confidence: 0,
      intent_score: 0,
      intent_reasoning: 'Parse error',
      signals: [],
      recommended_action: 'escalate',
      captured_data: {},
      should_escalate: true,
      escalation_reason: 'llm_parse_error',
    };
  }
}
```

---

## 6. Lógica de intent scoring

### Escala de intención de compra
| Rango | Estado | Señales típicas | Acción del sistema |
|-------|--------|-----------------|-------------------|
| 0–20 | cold | Solo saluda, curioso sin consulta específica | Tag frío, sin alerta |
| 21–50 | warm | Pregunta por precio, disponibilidad, descripción | Tag tibio, sin alerta |
| 51–80 | hot | Pregunta por formas de pago, envío, plazos, tallas específicas | Alerta al equipo |
| 81–100 | converted | Pide confirmar pedido, da dirección de entrega, confirma pago | Alerta urgente + escalado |

### Actualización del score

```typescript
async function updateLeadScore(
  leadId: string,
  orgId: string,
  newScore: number,
  signals: string[],
  capturedData: BotResponse['captured_data'],
  botConfig: BotConfig
): Promise<void> {

  const lead = await getLead(leadId, orgId);

  // REGLA: el score solo puede subir automáticamente, nunca bajar
  // (excepto actualización manual por el equipo)
  // Razón: evitar que un mensaje neutro al final deshaga el interés previo
  const effectiveScore = Math.max(lead.intent_score, newScore);

  const updateData: Partial<Lead> = {
    intent_score: effectiveScore,
    last_activity_at: new Date(),
  };

  // Actualizar datos del lead si el bot capturó información nueva
  if (capturedData.name && !lead.display_name?.startsWith('@')) {
    updateData.display_name = capturedData.name;
  }
  if (capturedData.phone || capturedData.email) {
    // Cifrar antes de guardar (ver SKILL_01)
    updateData.contact_identifier = encryptContactInfo(
      capturedData.phone || capturedData.email!
    );
  }

  await db.update(leads)
    .set(updateData)
    .where(and(eq(leads.id, leadId), eq(leads.organization_id, orgId)));

  // El trigger sync_lead_status en PostgreSQL actualiza lead.status automáticamente

  // Crear alerta de lead caliente si supera el threshold y no tiene asignación
  if (effectiveScore >= botConfig.hot_lead_threshold && !lead.assigned_to_user_id) {
    await createAlert(orgId, 'hot_lead', {
      title: 'Lead caliente detectado',
      message: `${lead.display_name || 'Un lead'} muestra alta intención de compra (score: ${effectiveScore})`,
      context_data: { lead_id: leadId, signals },
    });
  }
}
```

---

## 7. Defensa contra prompt injection

```typescript
// Lista de patrones que indican intento de manipulación del bot
// El usuario puede escribir cualquier cosa — el bot no debe obedecer instrucciones disfrazadas
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
];

function sanitizeUserMessage(message: string): {
  sanitized: string;
  isInjectionAttempt: boolean;
} {
  // 1. Detectar intentos de inyección
  const isInjectionAttempt = INJECTION_PATTERNS.some(pattern => pattern.test(message));

  // 2. Eliminar caracteres de control que podrían romper el JSON de respuesta
  const sanitized = message
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '') // caracteres de control
    .replace(/<script[^>]*>.*?<\/script>/gi, '')         // scripts HTML
    .replace(/javascript:/gi, '')                         // javascript: URIs
    .trim()
    .slice(0, 2000); // limitar longitud máxima del mensaje de entrada

  return { sanitized, isInjectionAttempt };
}

// Si se detecta inyección: responder normalmente sin revelar que se detectó
// NO decir "detecté un intento de hacking" — simplemente redirigir al propósito del bot
const INJECTION_REDIRECT_RESPONSE =
  'Estoy aquí para ayudarte con información sobre nuestros productos y servicios. ¿En qué puedo ayudarte?';
```

---

## 8. Gestión de handoff a humano

```typescript
async function handleHandoff(
  conversationId: string,
  orgId: string,
  reason: 'low_confidence' | 'user_request' | 'hot_lead' | 'fallback' | 'manual',
  botConfig: BotConfig
): Promise<void> {

  // 1. Desactivar el bot para esta conversación
  await db.update(conversations)
    .set({
      bot_active: false,
      handoff_reason: reason,
    })
    .where(eq(conversations.id, conversationId));

  // 2. Enviar el mensaje de escalado configurado al usuario
  await sendMessageToPlatform(conversationId, botConfig.escalation_message);

  // 3. Guardar el mensaje de escalado en DB
  await db.insert(messages).values({
    conversation_id: conversationId,
    direction: 'outbound',
    content: botConfig.escalation_message,
    sender_type: 'bot',
    confidence_score: 1.0, // mensaje de escalado — siempre correcto
    metadata: { is_escalation_message: true, reason },
  });

  // 4. Crear alerta para el equipo
  await createAlert(orgId, 'hot_lead', {
    title: 'Conversación esperando respuesta',
    message: `Un cliente está esperando atención. Razón: ${reason}`,
    context_data: { conversation_id: conversationId, reason },
  });
}

// Condiciones que disparan handoff automático
const ESCALATION_TRIGGERS = [
  // Por confianza baja del bot
  (response: BotResponse) => response.confidence < 0.60,
  // El bot mismo determinó que debe escalar
  (response: BotResponse) => response.should_escalate,
  // El usuario pide hablar con humano explícitamente
  (response: BotResponse, msg: string) =>
    /hablar con (una persona|un humano|un asesor|el dueño)|quiero un humano/i.test(msg),
] as const;
```

---

## 9. Optimización de costos del LLM

### Estimación de costos por conversación

| Componente | Tokens aprox. | Costo (Haiku) | Notas |
|-----------|--------------|--------------|-------|
| System prompt | ~600 | $0.0006 | Se envía en cada mensaje |
| Contexto RAG (5 chunks) | ~400 | $0.0004 | Solo los relevantes |
| Historial (10 mensajes) | ~500 | $0.0005 | Ventana deslizante |
| Mensaje del usuario | ~50 | $0.00005 | Variable |
| Respuesta del bot | ~150 | $0.0009 | Output es más caro |
| **Total por mensaje** | ~1,700 | **~$0.0025** | |
| **Total por conversación (10 mensajes)** | ~17,000 | **~$0.025** | |

Con 1,000 conversaciones/mes en plan Business: ~$25/mes en costos de LLM.

### Estrategias de optimización

```typescript
// 1. CACHÉ DE RESPUESTAS FRECUENTES
// Para preguntas exactamente iguales (o muy similares), usar respuesta cacheada
// Útil para: horarios, dirección, preguntas genéricas de catálogo
async function getCachedResponse(
  orgId: string,
  messageHash: string
): Promise<string | null> {
  const cached = await redis.get(`bot:cache:${orgId}:${messageHash}`);
  return cached;
}

async function setCachedResponse(
  orgId: string,
  messageHash: string,
  response: string,
  ttlSeconds = 3600 // 1 hora
): Promise<void> {
  await redis.setex(`bot:cache:${orgId}:${messageHash}`, ttlSeconds, response);
}

function hashMessage(message: string): string {
  return crypto.createHash('sha256')
    .update(message.toLowerCase().trim())
    .digest('hex')
    .slice(0, 16);
}

// 2. MODELO ADAPTATIVO
// Usar Haiku para mensajes simples, Sonnet solo para leads calientes
function selectModel(intentScore: number, conversationLength: number): string {
  if (intentScore >= 70 || conversationLength > 8) {
    return 'claude-sonnet-4-6'; // más capaz para cierres de venta importantes
  }
  return 'claude-haiku-4-5'; // default: velocidad y costo
}

// 3. REDUCIR TOKENS DEL SYSTEM PROMPT EN CONVERSACIONES LARGAS
// Para conversaciones > 5 mensajes, omitir instrucciones básicas (ya aprendidas)
function buildCompactSystemPrompt(
  botConfig: BotConfig,
  chunks: RetrievedChunk[],
  isLongConversation: boolean
): string {
  if (isLongConversation) {
    // Solo el contexto relevante y el formato de respuesta
    return `Asistente de ${botConfig.business_name}. Responde sobre el negocio.
Tono: ${botConfig.tone}. Responde en JSON con el schema definido.
Contexto: ${chunks.map(c => c.content).join(' | ')}`;
  }
  return buildSystemPrompt(botConfig, chunks, []); // prompt completo
}
```

---

## 10. Jobs asíncronos del bot

```typescript
// Job: process_inbound_message
// Cola: high priority (mensajes de clientes deben responderse rápido)
// Timeout: 30 segundos
// Reintentos: 2 (con delay 5s)

interface InboundMessageJob {
  webhookEventId: string;
  platform: 'instagram' | 'facebook' | 'whatsapp';
  orgId: string;
  socialConnectionId: string;
  platformThreadId: string;
  platformUserId: string;
  platformDisplayName: string;
  messageContent: string;
  platformMessageId: string;
  receivedAt: string;
}

// Job: embed_knowledge_chunks
// Cola: low priority (puede esperar)
// Timeout: 5 minutos
// Reintentos: 3

interface EmbedKnowledgeJob {
  orgId: string;
  sourceName: string;
  sourceType: 'csv' | 'pdf' | 'text';
  storageKey: string;   // dónde está el archivo en MinIO/R2
}
```

---

## 11. Variables de entorno del bot

```bash
# .env.example — bot IA y RAG
ANTHROPIC_API_KEY=sk-ant-...              # para llamadas al LLM
OPENAI_API_KEY=sk-...                      # para embeddings (text-embedding-3-small)
# Alternativamente: usar voyage-2 de Voyage AI para embeddings en español
# VOYAGE_API_KEY=pa-...

BOT_DEFAULT_CONFIDENCE_THRESHOLD=0.60    # umbral de escalado
BOT_DEFAULT_HOT_LEAD_THRESHOLD=70        # umbral de alerta
BOT_MAX_HISTORY_MESSAGES=10              # mensajes de historial en el contexto
BOT_RESPONSE_CACHE_TTL=3600             # segundos de caché de respuestas
BOT_EMBEDDING_MODEL=text-embedding-3-small
BOT_RESPONSE_MODEL_DEFAULT=claude-haiku-4-5
BOT_RESPONSE_MODEL_HOT=claude-sonnet-4-6  # para leads de alta intención
```

---

## Checklist del bot — antes de activar en producción

- [ ] `bot_config.is_active = true` solo después de que el cliente subió al menos 1 fuente de knowledge
- [ ] Knowledge base tiene al menos 10 chunks activos para la org
- [ ] Webhook de Meta configurado y verificado (HMAC funcionando)
- [ ] RAG filtra por `organization_id` ANTES del cálculo vectorial
- [ ] Sanitización de input activa (`sanitizeUserMessage()` antes del LLM)
- [ ] Fallback robusto si el LLM no devuelve JSON válido
- [ ] Handoff a humano funciona correctamente (conversación notificada en inbox)
- [ ] `intent_score` solo sube automáticamente, nunca baja (proteger historial de ventas)
- [ ] Caché de respuestas configurado para reducir costos
- [ ] Monitoreo de latencia total (objetivo: < 8s desde webhook hasta respuesta enviada)
