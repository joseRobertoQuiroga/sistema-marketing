const Message = require('../../domain/entities/Message');
const Lead = require('../../domain/entities/Lead');
const { sanitizeUserMessage } = require('../../infrastructure/utils/securityUtils');

class ProcessMessageUseCase {
    constructor({ messageRepo, botConfigRepo, leadRepo, knowledgeRepo, aiService, transcriptionService, platformManager, io }) {
        this.messageRepo = messageRepo;
        this.botConfigRepo = botConfigRepo;
        this.leadRepo = leadRepo;
        this.knowledgeRepo = knowledgeRepo;
        this.aiService = aiService;
        this.transcriptionService = transcriptionService;
        this.platformManager = platformManager;
        this.io = io;
        this.botPaused = new Map();
    }

    async execute({ type, text, conversationId, orgId, filePath, platform }) {
        if (this.botPaused.get(conversationId)) {
            await this.messageRepo.save(new Message({ organizationId: orgId, conversationId, role: 'user', content: text }));
            return null;
        }

        let inputContent = text;

        if (type === 'audio' && filePath) {
            inputContent = await this.transcriptionService.transcribe(filePath);
        }

        const { sanitized, isInjectionAttempt } = sanitizeUserMessage(inputContent);
        inputContent = sanitized;
        if (isInjectionAttempt) {
            await this.messageRepo.save(new Message({ organizationId: orgId, conversationId, role: 'user', content: sanitized }));
            await this.messageRepo.save(new Message({
                organizationId: orgId, conversationId, role: 'assistant',
                content: '⚠️ Mensaje bloqueado por seguridad.', intentScore: 0,
            }));
            return { response_text: '⚠️ Mensaje bloqueado por seguridad.', intent_score: 0, confidence: 1.0, captured_data: {} };
        }

        const botConfig = await this.botConfigRepo.findByOrganization(orgId);
        const history = await this.messageRepo.findByConversation(conversationId, 5);
        const historyText = history.map(m => `${m.role === 'user' ? 'Usuario' : 'Bot'}: ${m.content}`).join('\n');

        const embedding = await this.aiService.embed(inputContent);
        const knowledge = await this.knowledgeRepo.searchSimilar(orgId, embedding, 3);
        const context = knowledge.map(r => r.content).join('\n');

        const systemPrompt = `Eres ${botConfig.businessName}, un vendedor amable, directo pero dinámico. Da respuestas claras y concisas.
Usa el siguiente CONTEXTO para responder al usuario. Si no sabes la respuesta, usa el mensaje de escalado: "${botConfig.escalationMessage}".

CONTEXTO:
${context}

HISTORIAL RECIENTE:
${historyText}

INSTRUCCIONES:
1. Responde siempre en formato JSON válido.
2. Recaba de manera sutil y discreta información del usuario (nombre, localidad, intereses) e inclúyelos en "captured_data".
3. Clasifica al usuario por KPI en "kpi_category" (valores permitidos: "Interés", "Conversión", "Consultas") basado en su nivel de interacción y añade esto en "captured_data".
4. Incluye "response_text" (tu respuesta al usuario, clara y concisa), "intent_score" (0-100), "confidence" (0.0-1.0) y "captured_data" (objeto con nombre, localidad, intereses y kpi_category).
5. Si el usuario muestra intención clara de compra, asigna kpi_category: "Conversión" e intent_score > 80. Si explora catálogo: "Interés". Si hace preguntas generales: "Consultas".`;

        const response = await this.aiService.generate(inputContent, systemPrompt);

        await this.messageRepo.save(new Message({ organizationId: orgId, conversationId, role: 'user', content: inputContent }));
        await this.messageRepo.save(new Message({
            organizationId: orgId,
            conversationId,
            role: 'assistant',
            content: response.response_text,
            intentScore: response.intent_score,
            capturedData: response.captured_data,
        }));

        if (response.intent_score >= 50) {
            const data = response.captured_data || {};
            await this.leadRepo.upsertByConversation(orgId, conversationId, {
                name: data.nombre || 'Usuario',
                contactInfo: { localidad: data.localidad, intereses: data.intereses },
                source: platform,
                score: response.intent_score,
                capturedData: data,
                status: response.intent_score >= 80 ? 'qualified' : 'new',
            });

            if (this.io && response.intent_score >= 70) {
                this.io.to(`org_${orgId}`).emit('hot_lead', {
                    conversationId, orgId, score: response.intent_score,
                    name: data.nombre || 'Usuario', platform,
                });
            }
        }

        return response;
    }

    setPaused(conversationId, paused) {
        this.botPaused.set(conversationId, paused);
    }

    isPaused(conversationId) {
        return this.botPaused.get(conversationId) || false;
    }
}

module.exports = ProcessMessageUseCase;
