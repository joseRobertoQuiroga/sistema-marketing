const logger = require('../../infrastructure/utils/logger-strategic');
const { pool } = require('../../config/db');

// ██████ DOMAIN ██████
const LumiQuery = require('./domain/entities/LumiQuery');
const LumiAction = require('./domain/entities/LumiAction');
const LumiIntentClassification = require('./domain/value-objects/LumiIntentClassification');
const ILumiContextProvider = require('./domain/ports/ILumiContextProvider');

// ██████ APPLICATION ██████
const QueryAnalyticsUseCase = require('./application/use-cases/QueryAnalyticsUseCase');
const GenerateContentUseCase = require('./application/use-cases/GenerateContentUseCase');
const ExecuteActionUseCase = require('./application/use-cases/ExecuteActionUseCase');

// ██████ INFRASTRUCTURE ██████
const LumiIntentClassifier = require('./infrastructure/LumiIntentClassifier');
const LumiContextBuilder = require('./infrastructure/LumiContextBuilder');
const LumiOrchestrator = require('./infrastructure/LumiOrchestrator');
const LumiResponseFormatter = require('./infrastructure/LumiResponseFormatter');

// ██████ API ██████
const LumiController = require('./api/LumiController');
const createLumiRoutes = require('./api/lumi.routes');

class LumiModule {
    constructor() {
        this.initialized = false;
        this.log = logger.child({ module: 'lumi' });
        this.components = {};
    }

    initialize(options = {}) {
        if (this.initialized) return this.components;
        const log = this.log;

        log.info('═══════════════════════════════════════');
        log.info('🤖 INICIALIZANDO MÓDULO LUMI v1.0');
        log.info('═══════════════════════════════════════');

        // Get AI provider from chatbot module if available
        const aiProvider = options.aiProvider || this._createFallbackAI();

        // Infrastructure
        const intentClassifier = new LumiIntentClassifier({ aiProvider, log });
        const contextBuilder = new LumiContextBuilder({ pool, log });
        const responseFormatter = new LumiResponseFormatter({ log });

        // Use Cases
        const analyticsUseCase = new QueryAnalyticsUseCase({ aiProvider, pool, log });
        const contentGenUseCase = new GenerateContentUseCase({ aiProvider, pool, log });
        const actionUseCase = new ExecuteActionUseCase({ aiProvider, pool, log });

        // Orchestrator
        const orchestrator = new LumiOrchestrator({
            intentClassifier,
            contextBuilder,
            analyticsUseCase,
            contentGenUseCase,
            actionUseCase,
            responseFormatter,
            log,
        });

        // Controller
        const controller = new LumiController({ orchestrator, contextBuilder });

        this.components = {
            domain: { LumiQuery, LumiAction, LumiIntentClassification },
            orchestrator,
            contextBuilder,
            controller,
            aiProvider,
        };

        this.initialized = true;
        log.info('✅ MÓDULO LUMI INICIALIZADO');
        return this.components;
    }

    createRouter() {
        if (!this.initialized) {
            throw new Error('LumiModule no está inicializado. Llama a initialize() primero.');
        }
        return createLumiRoutes(this.components.controller);
    }

    _createFallbackAI() {
        const AIProviderWithFailover = require('../chatbot/infrastructure/ai/AIProviderWithFailover');
        const GroqProvider = require('../chatbot/infrastructure/ai/GroqProvider');
        const NVIDIACloudProvider = require('../chatbot/infrastructure/ai/NVIDIACloudProvider');
        const GeminiProvider = require('../chatbot/infrastructure/ai/GeminiProvider');

        const groq = new GroqProvider();
        const nvidia = new NVIDIACloudProvider();
        const gemini = new GeminiProvider();

        return new AIProviderWithFailover({
            providers: [
                ...(process.env.GROQ_API_KEY ? [{ name: 'groq', provider: groq }] : []),
                ...(process.env.NVIDIA_API_KEY ? [{ name: 'nvidia', provider: nvidia }] : []),
                ...(process.env.GEMINI_API_KEY ? [{ name: 'gemini', provider: gemini }] : []),
            ],
            log: this.log,
        });
    }
}

module.exports = LumiModule;
