const IntentClassification = require('../../../domain/value-objects/IntentClassification');

/**
 * Use Case: Procesar Mensaje — Orquestador principal del chatbot
 * SRP: Orquesta el flujo completo: clasificar → RAG → generar → extraer → persistir → responder
 * DIP: Depende de interfaces (puertos), no de implementaciones
 *
 * FLUJO:
 *   1. Clasificar intención
 *   2. Recuperar contexto RAG (si aplica)
 *   3. Generar respuesta con IA
 *   4. Extraer datos estructurados
 *   5. Persistir mensajes
 *   6. Actualizar/crear lead
 *   7. Enviar respuesta a plataforma
 *   8. Emitir evento en tiempo real
 */
class ProcessMessageUseCase {
    constructor({ messageRepo, conversationRepo, botConfigRepo, leadRepo, knowledgeRepo,
                  aiProvider, embeddingProvider, intentClassifier, dataExtractor,
                  platformManager, eventEmitter, log }) {
        this.messageRepo = messageRepo;
        this.conversationRepo = conversationRepo;
        this.botConfigRepo = botConfigRepo;
        this.leadRepo = leadRepo;
        this.knowledgeRepo = knowledgeRepo;
        this.aiProvider = aiProvider;
        this.embeddingProvider = embeddingProvider;
        this.intentClassifier = intentClassifier;
        this.dataExtractor = dataExtractor;
        this.platformManager = platformManager;
        this.eventEmitter = eventEmitter;
        this.log = log.child({ useCase: 'ProcessMessageUseCase' });

        this.pausedConversations = new Map(); // admin takeover state
    }

    async execute({ type, text, conversationId: extConversationId, orgId, filePath, platform, traceId }) {
        const log = this.log.child({ orgId, conversationId: extConversationId, platform, traceId });
        log.info('▶ INICIO proceso mensaje', { type, hasFile: !!filePath });

        const steps = {};
        const startTotal = Date.now();

        try {
            // ─── 0. Resolver/Asegurar conversación ─────────────
            const step0 = Date.now();
            let conversation = await this.conversationRepo.findByPlatform(orgId, platform, extConversationId);
            if (!conversation) {
                conversation = await this.conversationRepo.save({
                    organizationId: orgId, platform, platformConversationId: extConversationId,
                    status: 'active', metadata: {},
                });
                log.info('🆕 conversación creada', { conversationId: conversation.id });
            }
            steps.resolveConversation = Date.now() - step0;

            // Si la conversación está en pausa (admin tomó control), no responder automáticamente
            if (conversation.isPaused) {
                log.info('⏸️ conversación en pausa — salta respuesta automática');
                await this._persistUserMessage(orgId, conversation.id, text, platform);
                return { skipped: true, reason: 'paused' };
            }

            // ─── 1. Clasificar intención ───────────────────────
            const step1 = Date.now();
            const intentClassification = await this.intentClassifier.classify(text, { orgId, platform });
            steps.classifyIntent = Date.now() - step1;

            // Spam detection
            if (intentClassification.intent === IntentClassification.intents.SPAM) {
                log.warn('🚫 spam detectado — ignorando');
                return { skipped: true, reason: 'spam' };
            }

            // ─── 2. Recuperar contexto RAG ─────────────────────
            const step2 = Date.now();
            let ragContext = '';
            let ragSources = [];
            const needsRag = intentClassification.intent !== IntentClassification.intents.GREETING
                          && intentClassification.intent !== IntentClassification.intents.SPAM;
            if (needsRag) {
                try {
                    const embedding = await this.embeddingProvider.embed(text);
                    const similar = await this.knowledgeRepo.searchSimilar(orgId, embedding, 4);
                    ragSources = similar;
                    ragContext = similar.map(s => s.content).join('\n\n');
                    log.debug('📚 contexto RAG recuperado', { sources: similar.length });
                } catch (ragErr) {
                    log.warn('⚠️ error en RAG (continúa sin contexto)', { err: ragErr.message });
                }
            }
            steps.ragRetrieve = Date.now() - step2;

            // ─── 3. Obtener config del bot ─────────────────────
            const botConfig = await this.botConfigRepo.findByOrganization(orgId);

            // ─── 4. Generar respuesta con IA ───────────────────
            const step3 = Date.now();
            const responseText = await this._generateResponse({
                text, botConfig, ragContext, intentClassification, conversation,
            });
            steps.generateResponse = Date.now() - step3;

            // ─── 5. Extraer datos estructurados ────────────────
            const step4 = Date.now();
            let extractedData = {};
            try {
                extractedData = await this.dataExtractor.extract(text, { orgId, platform });
                if (Object.keys(extractedData).length > 0) {
                    log.info('📊 datos extraídos', extractedData);
                }
            } catch (extractErr) {
                log.debug('sin datos extraíbles', { err: extractErr.message });
            }
            steps.extractData = Date.now() - step4;

            // ─── 6. Persistir mensajes ─────────────────────────
            const step5 = Date.now();
            const userMsg = await this._persistUserMessage(orgId, conversation.id, text, platform, intentClassification, extractedData);
            const botMsg = await this._persistBotMessage(orgId, conversation.id, responseText, platform, intentClassification, extractedData);
            steps.persistMessages = Date.now() - step5;

            // ─── 7. Actualizar/Crear lead ──────────────────────
            const step6 = Date.now();
            if (Object.keys(extractedData).length > 0 || intentClassification.score >= 0.5) {
                try {
                    await this.leadRepo.upsertByConversation(orgId, conversation.id, {
                        nombre: extractedData.name,
                        contacto: extractedData.phone || extractedData.email || extConversationId,
                        fuente: platform,
                        producto_interes: extractedData.productInterest || intentClassification.entities.product,
                        kpi_category: intentClassification.isHighConfidence ? 'Interés' : 'Consultas',
                    });
                    log.info('👤 lead actualizado/creado');
                } catch (leadErr) {
                    log.warn('⚠️ error actualizando lead', { err: leadErr.message });
                }
            }
            steps.upsertLead = Date.now() - step6;

            // ─── 8. Enviar respuesta a plataforma ──────────────
            const step7 = Date.now();
            let sendResult = { sent: false };
            try {
                await this.platformManager.sendMessage(platform, extConversationId, responseText);
                sendResult = { sent: true };
                log.info('📤 respuesta enviada a plataforma');
            } catch (sendErr) {
                log.error('❌ error enviando respuesta', { err: sendErr.message });
                sendResult = { sent: false, error: sendErr.message };
            }
            steps.sendResponse = Date.now() - step7;

            // ─── 9. Emitir evento tiempo real ──────────────────
            if (this.eventEmitter) {
                this.eventEmitter.emit('chat:message', {
                    type: 'new_message',
                    conversationId: conversation.id,
                    role: 'user',
                    content: text,
                    platform,
                    orgId,
                    intent: intentClassification.intent,
                });
                if (extractedData.name || intentClassification.score >= 0.7) {
                    this.eventEmitter.emit('chat:hot_lead', {
                        type: 'hot_lead',
                        conversationId: conversation.id,
                        name: extractedData.name || 'Usuario',
                        platform,
                        orgId,
                    });
                }
            }

            const totalDuration = Date.now() - startTotal;
            log.info('✅ FIN proceso mensaje', {
                totalDurationMs: totalDuration,
                intent: intentClassification.intent,
                intentScore: intentClassification.score,
                steps,
                responseLength: responseText?.length || 0,
                hasExtractedData: Object.keys(extractedData).length > 0,
            });

            return {
                response_text: responseText,
                intent: intentClassification,
                extractedData,
                conversationId: conversation.id,
                durationMs: totalDuration,
                steps,
                sendResult,
            };

        } catch (err) {
            const totalDuration = Date.now() - startTotal;
            log.error('❌ ERROR fatal procesando mensaje', {
                err: err.message,
                stack: err.stack?.split('\n').slice(0, 3).join(' | '),
                totalDurationMs: totalDuration,
            });
            throw err;
        }
    }

    async _generateResponse({ text, botConfig, ragContext, intentClassification, conversation }) {
        const systemPrompt = this._buildSystemPrompt(botConfig, ragContext, intentClassification);
        const response = await this.aiProvider.generate(text, systemPrompt);
        return typeof response === 'string' ? response
             : response.response_text || response.text || response.message || JSON.stringify(response);
    }

    _buildSystemPrompt(botConfig, ragContext, intent) {
        let prompt = `Eres ${botConfig.businessName || 'OmniPresence'}, un asistente virtual amable y profesional.\n`;
        prompt += `Tono: ${botConfig.tone || 'amigable'}.\n`;
        prompt += `Mensaje de escalación: ${botConfig.escalationMessage || 'Lo siento, no puedo ayudarte con eso. Te paso con un humano.'}\n`;

        if (ragContext) {
            prompt += `\n--- CONTEXTO DE CONOCIMIENTO ---\n${ragContext}\n--- FIN CONTEXTO ---\n`;
        }
        if (intent && intent.intent !== 'unknown') {
            prompt += `\nIntención detectada: ${intent.intent} (confianza: ${Math.round(intent.score * 100)}%)\n`;
        }
        if (botConfig.welcomeMessage && intent?.intent === 'greeting') {
            prompt += `\nMensaje de bienvenida: ${botConfig.welcomeMessage}\n`;
        }

        prompt += `\nReglas:\n1. Responde ÚNICAMENTE con la información del contexto proporcionado.\n`;
        prompt += `2. Si no tienes la respuesta, usa el mensaje de escalación.\n`;
        prompt += `3. Responde en el mismo idioma del usuario.\n`;
        prompt += `4. Sé conciso pero amigable.\n`;
        prompt += `5. NO inventes precios, existencias o información que no esté en el contexto.\n`;
        return prompt;
    }

    async _persistUserMessage(orgId, conversationId, text, platform, intent, extractedData) {
        const Message = require('../../../domain/entities/ChatMessage');
        const msg = new Message({
            organizationId: orgId,
            conversationId,
            platform,
            role: 'user',
            content: text,
            intent: intent?.intent,
            intentScore: intent?.score || 0,
            capturedData: extractedData || {},
        });
        return await this.messageRepo.save(msg);
    }

    async _persistBotMessage(orgId, conversationId, text, platform, intent, extractedData) {
        const Message = require('../../../domain/entities/ChatMessage');
        const msg = new Message({
            organizationId: orgId,
            conversationId,
            platform,
            role: 'assistant',
            content: text,
            intent: intent?.intent,
            intentScore: intent?.score || 0,
            capturedData: extractedData || {},
        });
        return await this.messageRepo.save(msg);
    }
}

module.exports = ProcessMessageUseCase;
