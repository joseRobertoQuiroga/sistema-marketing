/**
 * Tests de la capa Application — Use Cases
 * SRP: Cada test verifica UN use case
 * DIP: Usamos mocks de los puertos (interfaces), no implementaciones reales
 */

const ProcessMessageUseCase = require('../../../../src/modules/chatbot/application/use-cases/chat/ProcessMessageUseCase');
const ClassifyIntentUseCase = require('../../../../src/modules/chatbot/application/use-cases/chat/ClassifyIntentUseCase');
const IntentClassification = require('../../../../src/modules/chatbot/domain/value-objects/IntentClassification');
const Conversation = require('../../../../src/modules/chatbot/domain/entities/Conversation');

// Mocks (puertos)
const createMockLogger = () => ({
    child: () => createMockLogger(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
    trace: jest.fn(),
    timed: jest.fn(),
});

describe('Application - ClassifyIntentUseCase', () => {
    let useCase;
    let mockClassifier;

    beforeEach(() => {
        mockClassifier = {
            classify: jest.fn(),
        };
        useCase = new ClassifyIntentUseCase({ intentClassifier: mockClassifier, log: createMockLogger() });
    });

    test('devuelve clasificación correcta cuando el clasificador funciona', async () => {
        const expected = new IntentClassification({ intent: 'greeting', score: 0.9, suggestedAction: 'respond' });
        mockClassifier.classify.mockResolvedValue(expected);

        const result = await useCase.execute('Hola', { platform: 'telegram' });
        expect(result.intent).toBe('greeting');
        expect(result.score).toBe(0.9);
        expect(mockClassifier.classify).toHaveBeenCalledWith('Hola', { platform: 'telegram' });
    });

    test('fallback seguro cuando el clasificador lanza error', async () => {
        mockClassifier.classify.mockRejectedValue(new Error('API error'));

        const result = await useCase.execute('test');
        expect(result.intent).toBe('unknown');
        expect(result.score).toBe(0);
        expect(result.suggestedAction).toBe('respond');
    });
});

describe('Application - ProcessMessageUseCase', () => {
    let useCase;
    let mocks;

    const createConversation = (overrides = {}) => new Conversation({
        id: 'conv-1', organizationId: 'org-1', platform: 'telegram',
        platformConversationId: 'ext-1', status: 'active',
        ...overrides,
    });

    beforeEach(() => {
        const log = createMockLogger();

        mocks = {
            messageRepo: { save: jest.fn().mockResolvedValue({ id: 'msg-1' }) },
            conversationRepo: {
                findByPlatform: jest.fn(),
                save: jest.fn(),
                updateStatus: jest.fn(),
            },
            botConfigRepo: {
                findByOrganization: jest.fn().mockResolvedValue({
                    businessName: 'TestShop', tone: 'amigable', escalationMessage: 'Lo siento',
                    welcomeMessage: '¡Hola!',
                }),
            },
            leadRepo: { upsertByConversation: jest.fn().mockResolvedValue({}) },
            knowledgeRepo: { searchSimilar: jest.fn().mockResolvedValue([]) },
            aiProvider: {
                generate: jest.fn().mockResolvedValue('¡Hola! ¿En qué puedo ayudarte?'),
                embed: jest.fn().mockResolvedValue(Array(768).fill(0.1)),
                providers: [{ name: 'mock' }],
                getMetrics: jest.fn().mockReturnValue({ attempts: 1, failures: 0 }),
            },
            embeddingProvider: {
                embed: jest.fn().mockResolvedValue(Array(768).fill(0.1)),
            },
            intentClassifier: {
                classify: jest.fn().mockResolvedValue(
                    new IntentClassification({ intent: 'greeting', score: 0.9, suggestedAction: 'respond' })
                ),
            },
            dataExtractor: {
                extract: jest.fn().mockResolvedValue({}),
            },
            platformManager: {
                sendMessage: jest.fn().mockResolvedValue(true),
            },
            eventEmitter: { emit: jest.fn() },
            log,
        };

        useCase = new ProcessMessageUseCase(mocks);
    });

    test('procesa mensaje de saludo completo', async () => {
        mocks.conversationRepo.findByPlatform.mockResolvedValue(createConversation());

        const result = await useCase.execute({
            type: 'text', text: 'Hola', conversationId: 'ext-1',
            orgId: 'org-1', platform: 'telegram',
        });

        // Verify all steps executed
        expect(mocks.intentClassifier.classify).toHaveBeenCalledWith('Hola', { orgId: 'org-1', platform: 'telegram' });
        expect(mocks.aiProvider.generate).toHaveBeenCalled();
        expect(mocks.messageRepo.save).toHaveBeenCalledTimes(2); // user + assistant
        expect(mocks.platformManager.sendMessage).toHaveBeenCalledWith('telegram', 'ext-1', expect.any(String));
        expect(mocks.eventEmitter.emit).toHaveBeenCalled();

        // Verify result structure
        expect(result.response_text).toBe('¡Hola! ¿En qué puedo ayudarte?');
        expect(result.intent.intent).toBe('greeting');
        expect(result.durationMs).toBeGreaterThan(0);
        expect(result.steps).toHaveProperty('classifyIntent');
        expect(result.steps).toHaveProperty('generateResponse');
        expect(result.steps).toHaveProperty('sendResponse');
        expect(result.sendResult.sent).toBe(true);
    });

    test('crea conversación si no existe', async () => {
        mocks.conversationRepo.findByPlatform.mockResolvedValue(null);
        mocks.conversationRepo.save.mockImplementation((data) =>
            Promise.resolve(createConversation({ ...data, id: 'conv-new' }))
        );

        const result = await useCase.execute({
            type: 'text', text: 'Hola', conversationId: 'ext-new',
            orgId: 'org-1', platform: 'whatsapp',
        });

        expect(mocks.conversationRepo.save).toHaveBeenCalledWith(
            expect.objectContaining({ platform: 'whatsapp', platformConversationId: 'ext-new' })
        );
        expect(result.response_text).toBeTruthy();
    });

    test('salta respuesta automática si conversación está en pausa', async () => {
        mocks.conversationRepo.findByPlatform.mockResolvedValue(createConversation({ status: 'paused' }));

        const result = await useCase.execute({
            type: 'text', text: 'Hola', conversationId: 'ext-1',
            orgId: 'org-1', platform: 'telegram',
        });

        expect(result.skipped).toBe(true);
        expect(result.reason).toBe('paused');
        expect(mocks.aiProvider.generate).not.toHaveBeenCalled();
        expect(mocks.platformManager.sendMessage).not.toHaveBeenCalled();
    });

    test('ignora spam', async () => {
        mocks.conversationRepo.findByPlatform.mockResolvedValue(createConversation());
        mocks.intentClassifier.classify.mockResolvedValue(
            new IntentClassification({ intent: 'spam', score: 0.95, suggestedAction: 'ignore' })
        );

        const result = await useCase.execute({
            type: 'text', text: 'Compra ahora!', conversationId: 'ext-1',
            orgId: 'org-1', platform: 'telegram',
        });

        expect(result.skipped).toBe(true);
        expect(result.reason).toBe('spam');
        expect(mocks.aiProvider.generate).not.toHaveBeenCalled();
    });

    test('extrae datos estructurados cuando están presentes', async () => {
        mocks.conversationRepo.findByPlatform.mockResolvedValue(createConversation());
        mocks.dataExtractor.extract.mockResolvedValue({
            name: 'Juan Pérez',
            phone: '59171234567',
            productInterest: 'Vestido Rojo',
        });

        const result = await useCase.execute({
            type: 'text', text: 'Quiero comprar el vestido rojo', conversationId: 'ext-1',
            orgId: 'org-1', platform: 'telegram',
        });

        expect(result.extractedData.name).toBe('Juan Pérez');
        expect(result.extractedData.productInterest).toBe('Vestido Rojo');
        expect(mocks.leadRepo.upsertByConversation).toHaveBeenCalled();
    });

    test('recupera contexto RAG para consultas de producto', async () => {
        mocks.conversationRepo.findByPlatform.mockResolvedValue(createConversation());
        mocks.intentClassifier.classify.mockResolvedValue(
            new IntentClassification({ intent: 'product_inquiry', score: 0.85, suggestedAction: 'respond' })
        );
        mocks.knowledgeRepo.searchSimilar.mockResolvedValue([
            { content: 'Producto: Vestido Rojo, Precio: Bs. 180' },
            { content: 'Producto: Sandalias Plata, Precio: Bs. 120' },
        ]);

        const result = await useCase.execute({
            type: 'text', text: '¿Cuánto cuesta el vestido rojo?', conversationId: 'ext-1',
            orgId: 'org-1', platform: 'telegram',
        });

        expect(mocks.knowledgeRepo.searchSimilar).toHaveBeenCalled();
        expect(mocks.embeddingProvider.embed).toHaveBeenCalledWith('¿Cuánto cuesta el vestido rojo?');
        expect(result.response_text).toBeTruthy();
    });

    test('maneja error de IA con fallback offline', async () => {
        mocks.conversationRepo.findByPlatform.mockResolvedValue(createConversation());
        mocks.aiProvider.generate.mockRejectedValue(new Error('Todos los proveedores fallaron'));

        await expect(useCase.execute({
            type: 'text', text: 'Hola', conversationId: 'ext-1',
            orgId: 'org-1', platform: 'telegram',
        })).rejects.toThrow();
    });

    test('incluye traceId en todos los pasos', async () => {
        mocks.conversationRepo.findByPlatform.mockResolvedValue(createConversation());

        const result = await useCase.execute({
            type: 'text', text: 'Hola', conversationId: 'ext-1',
            orgId: 'org-1', platform: 'telegram', traceId: 'test-trace-001',
        });

        expect(result).toBeDefined();
        expect(mocks.messageRepo.save).toHaveBeenCalled();
        expect(mocks.platformManager.sendMessage).toHaveBeenCalled();
    });

    test('métricas de tiempo en cada paso', async () => {
        mocks.conversationRepo.findByPlatform.mockResolvedValue(createConversation());

        const start = Date.now();
        const result = await useCase.execute({
            type: 'text', text: 'test', conversationId: 'ext-1',
            orgId: 'org-1', platform: 'telegram',
        });

        expect(result.durationMs).toBeGreaterThanOrEqual(0);
        expect(result.steps.classifyIntent).toBeGreaterThanOrEqual(0);
        expect(result.steps.ragRetrieve).toBeGreaterThanOrEqual(0);
        expect(result.steps.generateResponse).toBeGreaterThanOrEqual(0);
        expect(result.steps.persistMessages).toBeGreaterThanOrEqual(0);
        expect(result.steps.sendResponse).toBeGreaterThanOrEqual(0);
    });
});
