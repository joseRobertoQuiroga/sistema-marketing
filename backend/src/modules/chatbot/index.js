const logger = require('../../../infrastructure/utils/logger-strategic');
const { pool } = require('../../../config/db');

// ██████ DOMAIN LAYER ██████
const Conversation = require('../domain/entities/Conversation');
const ChatMessage = require('../domain/entities/ChatMessage');
const Campaign = require('../domain/entities/Campaign');
const IntentClassification = require('../domain/value-objects/IntentClassification');

// ██████ PORT INTERFACES ██████
const IConversationRepository = require('../domain/ports/IConversationRepository');
const IChatMessageRepository = require('../domain/ports/IChatMessageRepository');
const ICampaignRepository = require('../domain/ports/ICampaignRepository');
const IIntentClassifier = require('../domain/ports/IIntentClassifier');
const IDataExtractor = require('../domain/ports/IDataExtractor');
const IPlatformAdapter = require('../domain/ports/IPlatformAdapter');

// ██████ APPLICATION LAYER ██████
const ProcessMessageUseCase = require('../application/use-cases/chat/ProcessMessageUseCase');
const ClassifyIntentUseCase = require('../application/use-cases/chat/ClassifyIntentUseCase');
const CreateCampaignUseCase = require('../application/use-cases/campaign/CreateCampaignUseCase');
const ScheduleCampaignUseCase = require('../application/use-cases/campaign/ScheduleCampaignUseCase');
const SendCampaignUseCase = require('../application/use-cases/campaign/SendCampaignUseCase');
const CancelCampaignUseCase = require('../application/use-cases/campaign/CancelCampaignUseCase');
const GetCampaignStatsUseCase = require('../application/use-cases/campaign/GetCampaignStatsUseCase');

// ██████ INFRASTRUCTURE LAYER ██████
const PlatformAdapterFactory = require('../infrastructure/platforms/PlatformAdapterFactory');
const MessengerAdapter = require('../infrastructure/platforms/MessengerAdapter');
const TikTokAdapter = require('../infrastructure/platforms/TikTokAdapter');
const PostgresCampaignRepository = require('../infrastructure/campaign/PostgresCampaignRepository');
const CampaignSegmentService = require('../infrastructure/campaign/CampaignSegmentService');
const CampaignScheduler = require('../infrastructure/campaign/CampaignScheduler');
const AIProviderWithFailover = require('../infrastructure/ai/AIProviderWithFailover');
const GroqProvider = require('../infrastructure/ai/GroqProvider');
const NVIDIACloudProvider = require('../infrastructure/ai/NVIDIACloudProvider');
const GeminiProvider = require('../infrastructure/ai/GeminiProvider');
const PgVectorRAGStore = require('../infrastructure/rag/PgVectorRAGStore');
const PostgresConversationRepository = require('../infrastructure/persistence/PostgresConversationRepository');
const PostgresChatMessageRepository = require('../infrastructure/persistence/PostgresChatMessageRepository');
const { CONVERSATIONS_TABLE, CAMPAIGNS_TABLE } = require('../infrastructure/persistence/schema');

// ██████ REUSED FROM EXISTING CODE ██████
const PostgresMessageRepository = require('../../../infrastructure/persistence/PostgresMessageRepository');
const PostgresBotConfigRepository = require('../../../infrastructure/persistence/PostgresBotConfigRepository');
const PostgresLeadRepository = require('../../../infrastructure/persistence/PostgresLeadRepository');
const PostgresKnowledgeRepository = require('../../../infrastructure/persistence/PostgresKnowledgeRepository');
const PlatformManager = require('../../../infrastructure/platform/PlatformManager');
const TelegramAdapter = require('../../../infrastructure/platform/TelegramAdapter');
const WhatsAppAdapter = require('../../../infrastructure/platform/WhatsAppAdapter');

/**
 * ChatbotModule — Inicializa y wirea todo el módulo chatbot con Clean Architecture
 *
 * Uso en index.js:
 *   const chatbotModule = require('./src/modules/chatbot');
 *   const { processMessage, platformFactory, webhookRouter } = chatbotModule.initialize({ io });
 *   app.use('/api/chatbot', chatbotModule.createRouter());
 */
class ChatbotModule {
    constructor() {
        this.initialized = false;
        this.log = logger.child({ module: 'chatbot' });
        this.components = {};
    }

    /**
     * Inicializa el módulo completo con todas sus dependencias
     * @param {Object} options - { io: SocketIO server, eventEmitter: EventEmitter }
     */
    async initialize(options = {}) {
        if (this.initialized) return this.components;
        const log = this.log;

        log.info('═══════════════════════════════════════');
        log.info('🚀 INICIALIZANDO MÓDULO CHATBOT v2.0');
        log.info('═══════════════════════════════════════');

        // ─── 0. Migraciones ─────────────────────
        log.info('📦 ejecutando migraciones chatbot...');
        try {
            await pool.query(CONVERSATIONS_TABLE);
            await pool.query(CAMPAIGNS_TABLE);
            log.info('✅ migraciones chatbot OK');
        } catch (err) {
            log.error('❌ error en migraciones', { err: err.message });
            throw err;
        }

        // ─── 1. Domain Layer ─────────────────────
        log.info('📐 capa DOMAIN: entidades + puertos');
        const domain = { Conversation, ChatMessage, Campaign, IntentClassification };

        // ─── 2. Infrastructure Layer ─────────────
        log.info('🔧 capa INFRASTRUCTURE: persistencia + plataformas + IA');

        // 2a. Repositorios reutilizados (existentes)
        const messageRepo = new PostgresMessageRepository(pool);
        const botConfigRepo = new PostgresBotConfigRepository(pool);
        const leadRepo = new PostgresLeadRepository(pool);
        const knowledgeRepo = new PostgresKnowledgeRepository(pool);
        log.info('✅ repositorios existentes reutilizados');

        // 2b. Nuevos repositorios del módulo
        const conversationRepo = new PostgresConversationRepository({ pool, log });
        const chatMessageRepo = new PostgresChatMessageRepository({ pool, log });
        const ragStore = new PgVectorRAGStore({ pool, log });
        const campaignRepo = new PostgresCampaignRepository({ pool, log });
        const segmentService = new CampaignSegmentService({ leadRepo, log });
        log.info('✅ nuevos repositorios chatbot creados');

        // 2c. Proveedores IA con failover
        const groq = new GroqProvider();
        const nvidia = new NVIDIACloudProvider();
        const gemini = new GeminiProvider();

        const aiProvider = new AIProviderWithFailover({
            providers: [
                ...(process.env.GROQ_API_KEY ? [{ name: 'groq', provider: groq }] : []),
                ...(process.env.NVIDIA_API_KEY ? [{ name: 'nvidia', provider: nvidia }] : []),
                ...(process.env.GEMINI_API_KEY ? [{ name: 'gemini', provider: gemini }] : []),
            ],
            log,
        });

        if (aiProvider.providers.length === 0) {
            log.warn('⚠️ No hay APIs de IA configuradas. Usa GROQ_API_KEY, NVIDIA_API_KEY o GEMINI_API_KEY en .env');
        } else {
            log.info(`✅ ${aiProvider.providers.length} proveedores IA registrados: ${aiProvider.providers.map(p => p.name).join(', ')}`);
        }

        // 2d. Clasificador de intención y extractor de datos (vía IA)
        const intentClassifier = {
            classify: async (message, context) => {
                try {
                    const prompt = `Clasifica la siguiente intención del mensaje. Responde SOLO con el nombre de la intención.
Categorías: product_inquiry (consulta de producto/precio), purchase (intención de compra), complaint (queja/reclamo), greeting (saludo), spam (publicidad/no relevante), escalation (derivar a humano), unknown (no clasificable).

Mensaje: "${message}"

Intención:`;
                    const result = await aiProvider.generate(prompt, 'Eres un clasificador de intenciones. Responde ÚNICAMENTE con el nombre de la categoría.');
                    const cleaned = result.trim().toLowerCase().replace(/[^a-z_]/g, '');
                    const validIntents = ['product_inquiry', 'purchase', 'complaint', 'greeting', 'spam', 'escalation', 'unknown'];
                    const intent = validIntents.includes(cleaned) ? cleaned : 'unknown';
                    return new IntentClassification({ intent, score: intent === 'unknown' ? 0.3 : 0.7, suggestedAction: intent === 'escalation' ? 'escalate' : 'respond' });
                } catch {
                    return new IntentClassification({ intent: 'unknown', score: 0, suggestedAction: 'respond' });
                }
            },
        };

        const dataExtractor = {
            extract: async (message, context) => {
                try {
                    const prompt = `Extrae datos estructurados del siguiente mensaje. Responde SOLO con JSON válido.
Campos: name (nombre), email, phone (teléfono), productInterest (producto de interés), location (ubicación).

Mensaje: "${message}"

JSON:`;
                    const result = await aiProvider.generate(prompt, 'Eres un extractor de datos. Responde ÚNICAMENTE con JSON válido, sin explicaciones.');
                    const jsonStr = result.replace(/```json/g, '').replace(/```/g, '').trim();
                    return JSON.parse(jsonStr);
                } catch {
                    return {};
                }
            },
        };

        log.info('✅ clasificador de intención + extractor registrados');

        // 2e. Plataforma Factory (plugin system)
        const platformFactory = new PlatformAdapterFactory({ log });
        platformFactory.register('telegram', TelegramAdapter);
        platformFactory.register('whatsapp', WhatsAppAdapter);
        platformFactory.register('messenger', MessengerAdapter);
        platformFactory.register('tiktok', TikTokAdapter);

        // Reusar PlatformManager existente para compatibilidad
        const platformManager = new PlatformManager();
        platformManager.registerAdapter('telegram', new TelegramAdapter());
        platformManager.registerAdapter('whatsapp', new WhatsAppAdapter());
        platformManager.registerAdapter('messenger', new MessengerAdapter());
        platformManager.registerAdapter('tiktok', new TikTokAdapter());
        log.info(`✅ ${platformFactory.getRegistered().length} plataformas registradas: ${platformFactory.getRegistered().join(', ')}`);

        // 2f. Event emitter (Socket.IO)
        const eventEmitter = options.io || null;

        // ─── 3. Application Layer ────────────────
        log.info('⚙️  capa APPLICATION: use cases');

        const processMessage = new ProcessMessageUseCase({
            messageRepo: chatMessageRepo,
            conversationRepo,
            botConfigRepo,
            leadRepo,
            knowledgeRepo: ragStore,
            aiProvider,
            embeddingProvider: aiProvider,
            intentClassifier,
            dataExtractor,
            platformManager,
            eventEmitter,
            log,
        });

        const classifyIntent = new ClassifyIntentUseCase({ intentClassifier, log });

        // ─── Campaign Use Cases ──────────────────────
        const createCampaign = new CreateCampaignUseCase({ campaignRepo, log });
        const scheduleCampaign = new ScheduleCampaignUseCase({ campaignRepo, log });
        const sendCampaign = new SendCampaignUseCase({
            campaignRepo, segmentService, platformFactory, platformManager, log,
        });
        const cancelCampaign = new CancelCampaignUseCase({ campaignRepo, log });
        const getCampaignStats = new GetCampaignStatsUseCase({ campaignRepo, log });

        // ─── Campaign Scheduler ───────────────────────
        const campaignScheduler = new CampaignScheduler({ sendCampaignUseCase: sendCampaign, campaignRepo, log });
        campaignScheduler.start();

        log.info('✅ use cases + campañas listos');

        // ─── Guardar referencias ─────────────────
        this.components = {
            domain,
            processMessage,
            classifyIntent,
            aiProvider,
            platformFactory,
            platformManager,
            conversationRepo,
            chatMessageRepo,
            ragStore,
            intentClassifier,
            dataExtractor,
            campaignRepo,
            segmentService,
            createCampaign,
            scheduleCampaign,
            sendCampaign,
            cancelCampaign,
            getCampaignStats,
            campaignScheduler,
        };
        this.initialized = true;

        log.info('═══════════════════════════════════════');
        log.info('✅ MÓDULO CHATBOT INICIALIZADO');
        log.info('═══════════════════════════════════════');

        return this.components;
    }

    /** Crea el router de Express para el módulo */
    createRouter() {
        const express = require('express');
        const router = express.Router();

        // Webhook genérico para recibir mensajes
        router.post('/webhook/:platform', async (req, res) => {
            const log = logger.child({ module: 'chatbot-webhook' });
            const { platform } = req.params;
            const { type, text, conversationId, orgId } = req.body;

            log.info('📩 webhook recibido', { platform, type, conversationId: conversationId?.slice(0, 20) });

            if (!text || !conversationId) {
                return res.status(400).json({ error: 'text y conversationId son requeridos' });
            }

            try {
                const result = await this.components.processMessage.execute({
                    type: type || 'text',
                    text,
                    conversationId,
                    orgId,
                    platform,
                });
                res.json(result);
            } catch (err) {
                log.error('error procesando webhook', { err: err.message });
                res.status(500).json({ error: 'Error procesando mensaje' });
            }
        });

        // Health check del módulo
        router.get('/health', (req, res) => {
            res.json({
                status: 'ok',
                initialized: this.initialized,
                platforms: this.components.platformFactory?.getRegistered() || [],
                aiProviders: this.components.aiProvider?.getMetrics() || { providers: [] },
            });
        });

        return router;
    }
}

module.exports = ChatbotModule;
