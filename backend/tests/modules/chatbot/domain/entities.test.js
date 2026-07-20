/**
 * Tests de la capa Domain — Entidades y Value Objects
 * Principio: Las entidades NO deben depender de nada externo (Clean Architecture)
 */

const Conversation = require('../../../../src/modules/chatbot/domain/entities/Conversation');
const ChatMessage = require('../../../../src/modules/chatbot/domain/entities/ChatMessage');
const Campaign = require('../../../../src/modules/chatbot/domain/entities/Campaign');
const IntentClassification = require('../../../../src/modules/chatbot/domain/value-objects/IntentClassification');

describe('Domain - Conversation', () => {
    test('crea conversación con valores por defecto', () => {
        const c = new Conversation({ organizationId: 'org-1', platform: 'telegram', platformConversationId: '123' });
        expect(c.status).toBe('active');
        expect(c.contactName).toBe('Usuario');
        expect(c.isActive).toBe(true);
        expect(c.isPaused).toBe(false);
    });

    test('detecta estados correctamente', () => {
        const active = new Conversation({ organizationId: 'o1', platform: 't', platformConversationId: '1', status: 'active' });
        const paused = new Conversation({ organizationId: 'o1', platform: 't', platformConversationId: '2', status: 'paused' });
        const escalated = new Conversation({ organizationId: 'o1', platform: 't', platformConversationId: '3', status: 'escalated' });

        expect(active.isActive).toBe(true);
        expect(paused.isPaused).toBe(true);
        expect(escalated.isEscalated).toBe(true);
    });

    test('inmutable con Object.freeze en IntentClassification', () => {
        const ic = new IntentClassification({ intent: 'greeting', score: 0.9 });
        expect(Object.isFrozen(ic)).toBe(true);
    });
});

describe('Domain - ChatMessage', () => {
    test('crea mensaje con valores por defecto', () => {
        const m = new ChatMessage({ organizationId: 'o1', conversationId: 'c1', platform: 'telegram', role: 'user', content: 'Hola' });
        expect(m.contentType).toBe('text');
        expect(m.intentScore).toBe(0);
        expect(m.isFromUser).toBe(true);
        expect(m.isFromBot).toBe(false);
    });

    test('contentPreview trunca a 80 chars', () => {
        const long = 'a'.repeat(200);
        const m = new ChatMessage({ organizationId: 'o1', conversationId: 'c1', platform: 't', role: 'user', content: long });
        expect(m.contentPreview.length).toBe(80);
    });

    test('detecta roles correctamente', () => {
        const user = new ChatMessage({ organizationId: 'o1', conversationId: 'c1', platform: 't', role: 'user', content: 'a' });
        const bot = new ChatMessage({ organizationId: 'o1', conversationId: 'c1', platform: 't', role: 'assistant', content: 'b' });
        const admin = new ChatMessage({ organizationId: 'o1', conversationId: 'c1', platform: 't', role: 'admin', content: 'c' });

        expect(user.isFromUser).toBe(true);
        expect(bot.isFromBot).toBe(true);
        expect(admin.isFromAdmin).toBe(true);
    });
});

describe('Domain - Campaign', () => {
    test('crea campaña como draft por defecto', () => {
        const c = new Campaign({ organizationId: 'o1', name: 'Test', createdBy: 'user-1' });
        expect(c.status).toBe('draft');
        expect(c.isDraft).toBe(true);
        expect(c.progress).toBe(0);
    });

    test('calcula progreso correctamente', () => {
        const c = new Campaign({
            organizationId: 'o1', name: 'Test', createdBy: 'u1',
            stats: { total: 100, sent: 50, delivered: 30, read: 10, replied: 5, failed: 2 },
        });
        expect(c.progress).toBe(50);
    });

    test('detecta estados', () => {
        const s = new Campaign({ organizationId: 'o1', name: 'S', status: 'scheduled', createdBy: 'u1' });
        const sending = new Campaign({ organizationId: 'o1', name: 'Sg', status: 'sending', createdBy: 'u1' });
        const done = new Campaign({ organizationId: 'o1', name: 'D', status: 'completed', createdBy: 'u1' });

        expect(s.isScheduled).toBe(true);
        expect(sending.isSending).toBe(true);
        expect(done.isCompleted).toBe(true);
    });
});

describe('Domain - IntentClassification', () => {
    test('clasificación con alta confianza', () => {
        const ic = new IntentClassification({ intent: 'product_inquiry', score: 0.85, suggestedAction: 'respond' });
        expect(ic.isHighConfidence).toBe(true);
        expect(ic.isMediumConfidence).toBe(false);
        expect(ic.shouldEscalate).toBe(false);
    });

    test('clasificación con baja confianza', () => {
        const ic = new IntentClassification({ intent: 'unknown', score: 0.2, suggestedAction: 'escalate' });
        expect(ic.isLowConfidence).toBe(true);
        expect(ic.shouldEscalate).toBe(true);
    });

    test('intents estáticos disponibles', () => {
        expect(IntentClassification.intents.PRODUCT_INQUIRY).toBe('product_inquiry');
        expect(IntentClassification.intents.PURCHASE).toBe('purchase');
        expect(IntentClassification.intents.GREETING).toBe('greeting');
        expect(IntentClassification.intents.SPAM).toBe('spam');
    });
});
