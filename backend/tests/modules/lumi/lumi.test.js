/**
 * Tests del Módulo Lumi — Asistente IA de Negocio
 * Clean Architecture: Domain → Infrastructure → Application → API
 */

const LumiQuery = require('../../../src/modules/lumi/domain/entities/LumiQuery');
const LumiAction = require('../../../src/modules/lumi/domain/entities/LumiAction');
const LumiIntentClassification = require('../../../src/modules/lumi/domain/value-objects/LumiIntentClassification');
const LumiIntentClassifier = require('../../../src/modules/lumi/infrastructure/LumiIntentClassifier');
const LumiResponseFormatter = require('../../../src/modules/lumi/infrastructure/LumiResponseFormatter');

const createMockLogger = () => ({
    child: () => createMockLogger(),
    info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn(), trace: jest.fn(), timed: jest.fn(),
});

describe('Lumi - Domain Entities', () => {
    test('LumiQuery creación', () => {
        const q = new LumiQuery({ id: 'q1', organizationId: 'o1', text: '¿Cuántas ventas?', intent: 'analytics' });
        expect(q.organizationId).toBe('o1');
        expect(q.text).toBe('¿Cuántas ventas?');
        expect(q.intent).toBe('analytics');
        expect(q.createdAt).toBeInstanceOf(Date);
    });

    test('LumiAction estados', () => {
        const pending = new LumiAction({ id: 'a1', organizationId: 'o1', type: 'bulk_products' });
        expect(pending.isRunning).toBe(false);
        expect(pending.isCompleted).toBe(false);

        const running = new LumiAction({ id: 'a2', organizationId: 'o1', type: 'generate_content', status: 'running' });
        expect(running.isRunning).toBe(true);

        const done = new LumiAction({ id: 'a3', organizationId: 'o1', type: 'recommend', status: 'completed', result: { ok: true } });
        expect(done.isCompleted).toBe(true);

        const failed = new LumiAction({ id: 'a4', organizationId: 'o1', type: 'bulk_products', status: 'failed', error: 'error' });
        expect(failed.isFailed).toBe(true);
        expect(failed.error).toBe('error');
    });
});

describe('Lumi - IntentClassification', () => {
    test('clasificación analytics', () => {
        const ic = new LumiIntentClassification({ intent: 'analytics', subIntent: 'sales', confidence: 0.85 });
        expect(ic.isAnalytics).toBe(true);
        expect(ic.isContent).toBe(false);
        expect(ic.isAction).toBe(false);
        expect(ic.isHighConfidence).toBe(true);
        expect(ic.suggestedUseCase).toBe('analytics');
    });

    test('clasificación content', () => {
        const ic = new LumiIntentClassification({ intent: 'content', confidence: 0.72 });
        expect(ic.isContent).toBe(true);
        expect(ic.suggestedUseCase).toBe('content');
    });

    test('clasificación action', () => {
        const ic = new LumiIntentClassification({ intent: 'action', confidence: 0.9 });
        expect(ic.isAction).toBe(true);
        expect(ic.suggestedUseCase).toBe('action');
    });

    test('intents estáticos', () => {
        expect(LumiIntentClassification.intents.SALES_QUERY).toBe('analytics');
        expect(LumiIntentClassification.intents.GENERATE_DESCRIPTION).toBe('content');
        expect(LumiIntentClassification.intents.BULK_PRODUCTS).toBe('action');
    });
});

describe('Lumi - ResponseFormatter', () => {
    let formatter;

    beforeEach(() => {
        formatter = new LumiResponseFormatter({ log: createMockLogger() });
    });

    test('formato texto básico', () => {
        const result = formatter.format('Respuesta de prueba');
        expect(result.text).toBe('Respuesta de prueba');
        expect(result.type).toBe('text');
        expect(result.suggestions).toBeDefined();
        expect(result.suggestions.length).toBeGreaterThan(0);
    });

    test('formato con chartData', () => {
        const result = formatter.format('Gráfico de ventas', { chartData: { labels: ['Ene', 'Feb'], datasets: [] } });
        expect(result.type).toBe('chart');
        expect(result.data.chartData).toBeDefined();
    });

    test('formato con tableData', () => {
        const result = formatter.format('Tabla', { tableData: { columns: ['A', 'B'], rows: [[1, 2]] } });
        expect(result.type).toBe('table');
    });

    test('formato error', () => {
        const result = formatter.formatError('Error de prueba', { code: 500 });
        expect(result.text).toContain('Error de prueba');
        expect(result.type).toBe('error');
        expect(result.data.code).toBe(500);
    });

    test('sugerencias según intent', () => {
        const analyticsResult = formatter.format('test', {}, { intent: 'analytics' });
        expect(analyticsResult.suggestions[0].query).toContain('ventas');

        const contentResult = formatter.format('test', {}, { intent: 'content' });
        expect(contentResult.suggestions.some(s => s.query.includes('descripción'))).toBe(true);
    });
});

describe('Lumi - IntentClassifier mock', () => {
    test('clasifica analytics cuando el AI funciona', async () => {
        const mockAI = {
            generate: jest.fn().mockResolvedValue('analytics|sales|0.85'),
        };
        const classifier = new LumiIntentClassifier({ aiProvider: mockAI, log: createMockLogger() });
        const result = await classifier.classify('¿Cuántas ventas tuve?');
        expect(result.intent).toBe('analytics');
        expect(result.subIntent).toBe('sales');
        expect(result.confidence).toBe(0.85);
    });

    test('clasifica unknown cuando AI falla', async () => {
        const mockAI = {
            generate: jest.fn().mockRejectedValue(new Error('AI error')),
        };
        const classifier = new LumiIntentClassifier({ aiProvider: mockAI, log: createMockLogger() });
        const result = await classifier.classify('test');
        expect(result.intent).toBe('unknown');
        expect(result.confidence).toBe(0);
    });

    test('clasifica content', async () => {
        const mockAI = {
            generate: jest.fn().mockResolvedValue('content|description|0.78'),
        };
        const classifier = new LumiIntentClassifier({ aiProvider: mockAI, log: createMockLogger() });
        const result = await classifier.classify('Genera descripción');
        expect(result.intent).toBe('content');
        expect(result.suggestedUseCase).toBe('content');
    });

    test('clasifica action', async () => {
        const mockAI = {
            generate: jest.fn().mockResolvedValue('action|bulk_products|0.92'),
        };
        const classifier = new LumiIntentClassifier({ aiProvider: mockAI, log: createMockLogger() });
        const result = await classifier.classify('Cargar productos');
        expect(result.intent).toBe('action');
        expect(result.subIntent).toBe('bulk_products');
    });
});

describe('Lumi - LumiModule DI', () => {
    test('LumiModule requiere aiProvider para inicializar', () => {
        const LumiModule = require('../../../src/modules/lumi');
        const mod = new LumiModule();
        const components = mod.initialize({ aiProvider: { generate: async () => 'test', providers: [], getMetrics: () => ({}) } });
        expect(components.controller).toBeDefined();
        expect(components.orchestrator).toBeDefined();
        expect(components.contextBuilder).toBeDefined();
    });

    test('createRouter lanza error si no inicializado', () => {
        const LumiModule = require('../../../src/modules/lumi');
        const mod = new LumiModule();
        expect(() => mod.createRouter()).toThrow('no está inicializado');
    });
});
