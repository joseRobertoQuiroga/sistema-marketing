const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const http = require('http');
const socketIo = require('socket.io');
const multer = require('multer');
const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');
const logger = require('./src/infrastructure/utils/logger');

dotenv.config();
const { validateEnv, getAllowedOrigins } = require('./src/config/env');
validateEnv();

const { pool } = require('./src/config/db');

// ─── Infrastructure ─────────────────────────────────────
const PostgresMessageRepository = require('./src/infrastructure/persistence/PostgresMessageRepository');
const PostgresBotConfigRepository = require('./src/infrastructure/persistence/PostgresBotConfigRepository');
const PostgresLeadRepository = require('./src/infrastructure/persistence/PostgresLeadRepository');
const PostgresKnowledgeRepository = require('./src/infrastructure/persistence/PostgresKnowledgeRepository');
const PostgresProductRepository = require('./src/infrastructure/persistence/PostgresProductRepository');
const PostgresUserRepository = require('./src/infrastructure/persistence/PostgresUserRepository');
const PostgresOrganizationRepository = require('./src/infrastructure/persistence/PostgresOrganizationRepository');
const PostgresSessionRepository = require('./src/infrastructure/persistence/PostgresSessionRepository');
const PostgresPlatformConnectionRepository = require('./src/infrastructure/persistence/PostgresPlatformConnectionRepository');

const OllamaAIService = require('./src/infrastructure/ai/OllamaAIService');
const WhisperTranscriptionService = require('./src/infrastructure/ai/WhisperTranscriptionService');
const TelegramAdapter = require('./src/infrastructure/platform/TelegramAdapter');
const WhatsAppAdapter = require('./src/infrastructure/platform/WhatsAppAdapter');
const PlatformManager = require('./src/infrastructure/platform/PlatformManager');
const BotQueue = require('./src/infrastructure/messaging/BotQueue');
const BotWorker = require('./src/infrastructure/messaging/BotWorker');

// ─── Application (Use Cases) ────────────────────────────
const { ProcessMessageUseCase, AuthenticateUserUseCase } = require('./src/application/use-cases');

// ─── API (Controllers) ──────────────────────────────────
const AuthController = require('./src/api/controllers/AuthController');
const ConversationController = require('./src/api/controllers/ConversationController');
const ProductController = require('./src/api/controllers/ProductController');
const LeadController = require('./src/api/controllers/LeadController');
const BillingController = require('./src/api/controllers/BillingController');
const StripeWebhookController = require('./src/api/controllers/StripeWebhookController');
const WebhookController = require('./src/api/controllers/WebhookController');
const MetaWebhookController = require('./src/api/controllers/MetaWebhookController');
const AnalyticsController = require('./src/api/controllers/AnalyticsController');
const ContentController = require('./src/api/controllers/ContentController');
const CampaignController = require('./src/api/controllers/CampaignController');
const MonitoringController = require('./src/api/controllers/MonitoringController');
const HealthController = require('./src/api/controllers/HealthController');
const registerRoutes = require('./src/api/routes/index');

// ─── Dependency Injection ───────────────────────────────
const messageRepo = new PostgresMessageRepository(pool);
const botConfigRepo = new PostgresBotConfigRepository(pool);
const platformConnRepo = new PostgresPlatformConnectionRepository(pool);
const leadRepo = new PostgresLeadRepository(pool);
const knowledgeRepo = new PostgresKnowledgeRepository(pool);
const productRepo = new PostgresProductRepository(pool);
const userRepo = new PostgresUserRepository(pool);
const orgRepo = new PostgresOrganizationRepository(pool);
const sessionRepo = new PostgresSessionRepository(pool);

const aiService = new OllamaAIService();
const transcriptionService = new WhisperTranscriptionService();

const platformManager = new PlatformManager();
platformManager.registerAdapter('telegram', new TelegramAdapter());
platformManager.registerAdapter('whatsapp', new WhatsAppAdapter());

// ─── Express App (must be before use-cases that need io) ─
const app = express();
const server = http.createServer(app);
const io = socketIo(server, { cors: { origin: getAllowedOrigins() } });

const processMessageUseCase = new ProcessMessageUseCase({
    messageRepo, botConfigRepo, leadRepo, knowledgeRepo, aiService, transcriptionService, platformManager, io,
});

const authenticateUseCase = new AuthenticateUserUseCase({ userRepo, orgRepo, sessionRepo });

const botQueue = new BotQueue();

const authController = new AuthController({ authenticateUseCase });
const conversationController = new ConversationController({ messageRepo, processMessageUseCase, platformManager });
const productController = new ProductController({ productRepo });
const leadController = new LeadController({ leadRepo });
const billingController = new BillingController({ orgRepo });
const stripeWebhookController = new StripeWebhookController({ orgRepo, pool });
const analyticsController = new AnalyticsController({ pool });
const contentController = new ContentController({ pool });
const webhookController = new WebhookController({ botQueue, platformConnRepo });
const metaWebhookController = new MetaWebhookController({ botQueue, platformConnRepo });

// ─── Monitoring Controller (wired after all modules) ────
const monitoringController = new MonitoringController();

// ─── Campaign Controller (wired after chatbot init) ─────
let campaignController = null;
const chatCampaignUseCases = {};

// ─── Chatbot Module (Clean Architecture) ────────────────
const ChatbotModule = require('./src/modules/chatbot');
const chatbotModule = new ChatbotModule();
let chatbotReady = false;

// ─── Lumi Module ─────────────────────────────────────────
const LumiModule = require('./src/modules/lumi');
const lumiModule = new LumiModule();
let lumiReady = false;

chatbotModule.initialize({ io }).then(() => {
    chatbotReady = true;
    logger.info('🤖 Módulo Chatbot v2.0 listo');

    // Initialize Lumi module with chatbot's AI provider
    const cc = chatbotModule.components;
    const lumiComponents = lumiModule.initialize({ aiProvider: cc.aiProvider });
    lumiReady = true;
    logger.info('✨ Módulo Lumi v1.0 listo');

    // Wire campaign controller from chatbot module components
    if (cc.createCampaign) {
        campaignController = new CampaignController({
            createCampaign: cc.createCampaign,
            scheduleCampaign: cc.scheduleCampaign,
            sendCampaign: cc.sendCampaign,
            cancelCampaign: cc.cancelCampaign,
            getCampaignStats: cc.getCampaignStats,
            campaignRepo: cc.campaignRepo,
            leadRepo,
        });
        Object.assign(chatCampaignUseCases, cc);
        logger.info('📬 CampaignController listo');

        // Register campaign routes after controller is ready
        const createCampaignRoutes = require('./src/api/routes/campaign.routes');
        const { authenticate } = require('./src/api/middleware/auth');
        const { tenantContext, releaseDbClient } = require('./src/api/middleware/tenant');
        app.use('/api/campaigns', authenticate, tenantContext, releaseDbClient, createCampaignRoutes(campaignController));
    }

    // Register Lumi routes
    const { authenticate: authMiddleware } = require('./src/api/middleware/auth');
    const { tenantContext: tenantCtx, releaseDbClient: releaseDb } = require('./src/api/middleware/tenant');
    app.use('/api/lumi', authMiddleware, tenantCtx, releaseDb, lumiModule.createRouter());
    logger.info('🌐 Rutas Lumi registradas en /api/lumi');

    // Wire monitoring with all module references
    monitoringController.setModuleRefs({
        chatbotComponents: cc,
        lumiComponents: lumiComponents,
        campaignScheduler: cc.campaignScheduler,
    });

    // Register monitoring routes
    const createMonitoringRoutes = require('./src/api/routes/monitoring.routes');
    app.use('/api/monitoring', authMiddleware, tenantCtx, releaseDb, createMonitoringRoutes(monitoringController));
    logger.info('📊 Monitoreo registrado en /api/monitoring');
}).catch(err => {
    logger.error({ err: err.message }, '❌ Error inicializando módulo chatbot');
});

// ─── Worker ─────────────────────────────────────────────
new BotWorker({ queue: botQueue, processMessageUseCase, platformManager });

app.use(helmet());
app.use(cors({ origin: getAllowedOrigins(), credentials: true }));
app.use(express.json({ limit: '1mb' }));

const globalLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 300,
    standardHeaders: true,
    legacyHeaders: false,
});
app.use(globalLimiter);

const upload = multer({ dest: 'uploads/' });
if (!fs.existsSync('uploads')) fs.mkdirSync('uploads');

// ─── Routes ─────────────────────────────────────────────
registerRoutes(app, { authController, conversationController, productController, leadController, webhookController, billingController, stripeWebhookController, analyticsController, contentController });

// Módulo Chatbot v2.0 (Clean Architecture)
app.use('/api/chatbot', chatbotModule.createRouter());

app.get('/health', HealthController.check);

app.post('/webhook', upload.single('media'), (req, res) => webhookController.receive(req, res));

// Meta webhook para WhatsApp
app.get('/meta/webhook', (req, res) => metaWebhookController.verify(req, res));
app.post('/meta/webhook', (req, res) => metaWebhookController.receive(req, res));

// Stripe webhook (raw body required for signature verification)
app.post('/api/billing/stripe-webhook', express.raw({ type: 'application/json' }), (req, res) => stripeWebhookController.handle(req, res));

// ─── Telegram Polling ───────────────────────────────────
const TELEGRAM_TOKEN = process.env.TELEGRAM_TOKEN;
if (TELEGRAM_TOKEN) {
    const API_URL = `https://api.telegram.org/bot${TELEGRAM_TOKEN}`;
    let lastUpdateId = 0;
    let resolvedOrgId = null;

    async function resolveOrgId() {
        try {
            const conn = await platformConnRepo.findByBotToken(TELEGRAM_TOKEN);
            if (conn) {
                resolvedOrgId = conn.organization_id;
            }
        } catch (err) {
            logger.warn('No se pudo resolver orgId desde platform_connections');
        }
    }

    async function pollTelegram() {
        try {
            if (!resolvedOrgId) await resolveOrgId();
            const orgId = resolvedOrgId || (await resolveOrgId()) || null;
            if (!orgId) {
                logger.warn('⚠️ No se pudo resolver orgId para Telegram. Salta mensaje.');
                setTimeout(pollTelegram, 500);
                return;
            }

            const res = await fetch(`${API_URL}/getUpdates?offset=${lastUpdateId + 1}&timeout=30`);
            const data = await res.json();
            if (data.ok && data.result.length > 0) {
                for (const update of data.result) {
                    lastUpdateId = update.update_id;
                    if (update.message) {
                        const chatId = update.message.chat.id.toString();
                        if (update.message.text) {
                            await botQueue.add('process_message', {
                                type: 'text', text: update.message.text,
                                conversationId: chatId, orgId, platform: 'telegram',
                            });
                            io.emit('new_message', { conversationId: chatId, role: 'user', content: update.message.text });
                        } else if (update.message.voice) {
                            const fileId = update.message.voice.file_id;
                            const fileRes = await fetch(`${API_URL}/getFile?file_id=${fileId}`);
                            const fileData = await fileRes.json();
                            const downloadUrl = `https://api.telegram.org/file/bot${TELEGRAM_TOKEN}/${fileData.result.file_path}`;
                            const localPath = path.join(__dirname, 'uploads', `${fileId}.oga`);
                            const writer = fs.createWriteStream(localPath);
                            const response = await fetch(downloadUrl);
                            response.body.pipe(writer);
                            await new Promise((resolve) => writer.on('finish', resolve));
                            await botQueue.add('process_message', {
                                type: 'audio', conversationId: chatId,
                                orgId, filePath: localPath, platform: 'telegram',
                            });
                        }
                    }
                }
            }
            setTimeout(pollTelegram, 500);
        } catch (error) {
            logger.error({ err: error }, 'Error en Polling Telegram');
            setTimeout(pollTelegram, 5000);
        }
    }

    logger.info('Iniciando Polling Manual de Telegram...');
    pollTelegram();
}

// ─── Socket.IO ──────────────────────────────────────────
io.on('connection', (socket) => {
    logger.info({ socketId: socket.id }, 'Cliente conectado');
    socket.on('join_org', (orgId) => {
        if (orgId) socket.join(`org_${orgId}`);
    });
    socket.on('disconnect', () => {
        logger.info({ socketId: socket.id }, 'Cliente desconectado');
    });
});

// ─── Error handler ──────────────────────────────────────
app.use((err, req, res, next) => {
    logger.error({ err }, 'Error no manejado');
    res.status(err.status || 500).json({
        error: {
            code: err.code || 'INTERNAL_ERROR',
            message: process.env.NODE_ENV === 'production' ? 'Error interno del servidor' : err.message,
        }
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => logger.info({ port: PORT }, 'API iniciada'));

module.exports = { app, server, io };
