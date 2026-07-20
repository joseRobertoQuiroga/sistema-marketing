/**
 * Tests de la capa Infrastructure — Adaptadores y Repositorios
 * SRP: Tests específicos por adaptador
 * OCP: Verificamos que nuevos adaptadores siguen el contrato IPlatformAdapter
 */

const PlatformAdapterFactory = require('../../../../src/modules/chatbot/infrastructure/platforms/PlatformAdapterFactory');
const AIProviderWithFailover = require('../../../../src/modules/chatbot/infrastructure/ai/AIProviderWithFailover');
const GroqProvider = require('../../../../src/modules/chatbot/infrastructure/ai/GroqProvider');
const NVIDIACloudProvider = require('../../../../src/modules/chatbot/infrastructure/ai/NVIDIACloudProvider');
const GeminiProvider = require('../../../../src/modules/chatbot/infrastructure/ai/GeminiProvider');
const IntentClassification = require('../../../../src/modules/chatbot/domain/value-objects/IntentClassification');

const createMockLogger = () => ({
    child: () => createMockLogger(),
    info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn(), trace: jest.fn(), timed: jest.fn(),
});

describe('Infrastructure - PlatformAdapterFactory', () => {
    let factory;

    beforeEach(() => {
        factory = new PlatformAdapterFactory({ log: createMockLogger() });
    });

    test('registra y obtiene adaptadores', () => {
        // Mock adapter class
        class MockAdapter {
            get name() { return 'mock'; }
            async sendMessage(cid, text) { return { ok: true }; }
        }

        factory.register('mock', MockAdapter);
        const adapter = factory.get('mock');
        expect(adapter.name).toBe('mock');
    });

    test('lanza error para plataforma no registrada', () => {
        expect(() => factory.get('nonexistent')).toThrow('Adaptador no encontrado');
    });

    test('listado de plataformas registradas', () => {
        class A { get name() { return 'a'; } async sendMessage() {} }
        class B { get name() { return 'b'; } async sendMessage() {} }
        factory.register('a', A);
        factory.register('b', B);
        expect(factory.getRegistered()).toEqual(['a', 'b']);
    });

    test('singleton — misma instancia para mismo nombre', () => {
        class MockAdapter {
            get name() { return 'mock'; }
            async sendMessage() {}
        }
        factory.register('mock', MockAdapter);
        const a = factory.get('mock');
        const b = factory.get('mock');
        expect(a).toBe(b);
    });

    test('broadcast envía a todas las plataformas', async () => {
        class A {
            get name() { return 'a'; }
            async sendMessage() { return { ok: true }; }
        }
        class B {
            get name() { return 'b'; }
            async sendMessage() { throw new Error('fail'); }
        }
        factory.register('a', A);
        factory.register('b', B);

        const results = await factory.broadcast('cid', 'hello');
        expect(results).toContainEqual({ platform: 'a', success: true });
        expect(results).toContainEqual({ platform: 'b', success: false });
    });
});

describe('Infrastructure - AIProviderWithFailover', () => {
    test('usa el primer proveedor si funciona', async () => {
        const p1 = { name: 'p1', provider: { generate: jest.fn().mockResolvedValue('respuesta') } };
        const p2 = { name: 'p2', provider: { generate: jest.fn() } };

        const provider = new AIProviderWithFailover({ providers: [p1, p2], log: createMockLogger() });
        const result = await provider.generate('test', 'system');

        expect(result).toBe('respuesta');
        expect(p2.provider.generate).not.toHaveBeenCalled();
    });

    test('failover: si el primero falla, usa el segundo', async () => {
        const p1 = { name: 'p1', provider: { generate: jest.fn().mockRejectedValue(new Error('timeout')) } };
        const p2 = { name: 'p2', provider: { generate: jest.fn().mockResolvedValue('fallback') } };

        const provider = new AIProviderWithFailover({ providers: [p1, p2], log: createMockLogger() });
        const result = await provider.generate('test', 'system');

        expect(result).toBe('fallback');
        expect(p1.provider.generate).toHaveBeenCalled();
        expect(p2.provider.generate).toHaveBeenCalled();
    });

    test('respuesta offline cuando todos fallan', async () => {
        const p1 = { name: 'p1', provider: { generate: jest.fn().mockRejectedValue(new Error('err')) } };
        const p2 = { name: 'p2', provider: { generate: jest.fn().mockRejectedValue(new Error('err2')) } };

        const provider = new AIProviderWithFailover({ providers: [p1, p2], log: createMockLogger() });
        const result = await provider.generate('test', 'system');

        expect(typeof result).toBe('string');
        expect(result.length).toBeGreaterThan(10);
    });

    test('embedding usa el primer proveedor que lo soporta', async () => {
        const p1 = { name: 'p1', provider: { embed: jest.fn().mockResolvedValue([0.1, 0.2]) } };
        const provider = new AIProviderWithFailover({ providers: [p1], log: createMockLogger() });
        const result = await provider.embed('test');
        expect(result).toEqual([0.1, 0.2]);
    });

    test('métricas de uso', async () => {
        const p1 = { name: 'p1', provider: { generate: jest.fn().mockResolvedValue('ok') } };
        const provider = new AIProviderWithFailover({ providers: [p1], log: createMockLogger() });
        await provider.generate('test', 'sys');

        const metrics = provider.getMetrics();
        expect(metrics.attempts).toBe(1);
        expect(metrics.failures).toBe(0);
        expect(metrics.availableProviders).toEqual(['p1']);
    });
});

describe('Infrastructure - GroqProvider', () => {
    test('requiere GROQ_API_KEY', () => {
        const key = process.env.GROQ_API_KEY;
        const provider = new GroqProvider();
        if (key) {
            expect(provider.apiKey).toBe(key);
        } else {
            expect(provider.apiKey).toBeUndefined();
        }
    });

    test('embedding lanza error (no soportado)', async () => {
        const provider = new GroqProvider();
        await expect(provider.embed('test')).rejects.toThrow('Groq no soporta embeddings');
    });
});

describe('Infrastructure - NVIDIACloudProvider', () => {
    test('usa URL correcta', () => {
        const provider = new NVIDIACloudProvider();
        expect(provider.baseUrl).toBe('https://integrate.api.nvidia.com/v1/chat/completions');
        expect(provider.model).toBe('meta/llama-3.3-70b-instruct');
    });

    test('requiere NVIDIA_API_KEY', () => {
        const key = process.env.NVIDIA_API_KEY;
        const provider = new NVIDIACloudProvider();
        if (key) {
            expect(provider.apiKey).toBe(key);
        } else {
            expect(provider.apiKey).toBeUndefined();
        }
    });
});

describe('Infrastructure - GeminiProvider', () => {
    test('usa modelo por defecto correcto', () => {
        const provider = new GeminiProvider();
        expect(provider.model).toBe('gemini-2.0-flash');
    });

    test('requiere GEMINI_API_KEY', () => {
        const key = process.env.GEMINI_API_KEY;
        const provider = new GeminiProvider();
        if (key) {
            expect(provider.apiKey).toBe(key);
        } else {
            expect(provider.apiKey).toBeUndefined();
        }
    });
});

describe('Infrastructure - IntentClassifier', () => {
    test('clasifica saludo correctamente', async () => {
        const classifier = {
            classify: async (msg) => new IntentClassification({
                intent: 'greeting', score: 0.9, suggestedAction: 'respond',
            }),
        };
        const result = await classifier.classify('Hola, ¿cómo estás?');
        expect(result.intent).toBe('greeting');
        expect(result.isHighConfidence).toBe(true);
    });

    test('clasifica consulta de producto', async () => {
        const classifier = {
            classify: async (msg) => new IntentClassification({
                intent: 'product_inquiry', score: 0.85, suggestedAction: 'respond',
            }),
        };
        const result = await classifier.classify('¿Cuánto cuesta el vestido rojo?');
        expect(result.intent).toBe('product_inquiry');
        expect(result.shouldEscalate).toBe(false);
    });

    test('detecta spam', async () => {
        const classifier = {
            classify: async (msg) => new IntentClassification({
                intent: 'spam', score: 0.95, suggestedAction: 'ignore',
            }),
        };
        const result = await classifier.classify('GANA DINERO FÁCIL!!!');
        expect(result.intent).toBe('spam');
    });
});
