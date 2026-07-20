describe('WhatsAppAdapter', () => {
    let adapter;

    beforeEach(() => {
        const WhatsAppAdapter = require('../../src/infrastructure/platform/WhatsAppAdapter');
        adapter = new WhatsAppAdapter();
    });

    test('name returns "whatsapp"', () => {
        expect(adapter.name).toBe('whatsapp');
    });

    test('sendMessage returns false when not configured', async () => {
        delete process.env.WHATSAPP_PHONE_NUMBER_ID;
        delete process.env.META_APP_ID;
        const result = await adapter.sendMessage('123', 'test');
        expect(result).toBe(false);
    });

    test('sendMessage returns false on API error', async () => {
        process.env.WHATSAPP_PHONE_NUMBER_ID = '12345';
        process.env.META_APP_ID = 'app';
        process.env.META_APP_SECRET = 'secret';
        jest.mock('axios', () => ({
            post: jest.fn().mockRejectedValue(new Error('API Error')),
        }));
    });
});

describe('MetaWebhookController', () => {
    let controller;
    let mockBotQueue;

    beforeEach(() => {
        mockBotQueue = { add: jest.fn() };
        const mockPlatformConnRepo = {
            findByBotToken: jest.fn().mockResolvedValue({ organization_id: 'org-test-123' }),
        };
        const MetaWebhookController = require('../../src/api/controllers/MetaWebhookController');
        controller = new MetaWebhookController({ botQueue: mockBotQueue, platformConnRepo: mockPlatformConnRepo });
        process.env.META_WEBHOOK_VERIFY_TOKEN = 'test_verify_token';
    });

    test('verify returns challenge when token matches', () => {
        const req = {
            query: {
                'hub.mode': 'subscribe',
                'hub.verify_token': 'test_verify_token',
                'hub.challenge': 'challenge123',
            }
        };
        const res = { status: jest.fn().mockReturnThis(), send: jest.fn() };
        controller.verify(req, res);
        expect(res.status).toHaveBeenCalledWith(200);
        expect(res.send).toHaveBeenCalledWith('challenge123');
    });

    test('verify returns 403 when token mismatches', () => {
        const req = {
            query: {
                'hub.mode': 'subscribe',
                'hub.verify_token': 'wrong_token',
                'hub.challenge': 'challenge123',
            }
        };
        const res = { status: jest.fn().mockReturnThis(), send: jest.fn() };
        controller.verify(req, res);
        expect(res.status).toHaveBeenCalledWith(403);
    });

    test('receive ignores non-whatsapp objects', async () => {
        const req = { body: { object: 'not_whatsapp' } };
        const res = { sendStatus: jest.fn() };
        await controller.receive(req, res);
        expect(res.sendStatus).toHaveBeenCalledWith(400);
    });

    test('receive processes incoming text message', async () => {
        const req = {
            body: {
                object: 'whatsapp_business_account',
                entry: [{
                    changes: [{
                        field: 'messages',
                        value: {
                            messages: [{
                                from: '5491155551234',
                                text: { body: 'Hola, quiero comprar' },
                                type: 'text',
                            }],
                            metadata: { phone_number_id: '12345' },
                        }
                    }]
                }]
            }
        };
        const res = { sendStatus: jest.fn() };
        await controller.receive(req, res);
        expect(mockBotQueue.add).toHaveBeenCalledWith('process_message', expect.objectContaining({
            type: 'text',
            text: 'Hola, quiero comprar',
            conversationId: '5491155551234',
            orgId: 'org-test-123',
            platform: 'whatsapp',
        }));
        expect(res.sendStatus).toHaveBeenCalledWith(200);
    });
});
