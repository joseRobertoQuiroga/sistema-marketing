describe('PlatformConnectionRepository', () => {
    let repo;
    let mockPool;

    beforeEach(() => {
        jest.resetModules();
        jest.mock('pg', () => {
            const mockPoolInstance = { query: jest.fn() };
            return { Pool: jest.fn(() => mockPoolInstance) };
        });
        const { Pool } = require('pg');
        mockPool = new Pool();
        const PostgresPlatformConnectionRepository = require('../../src/infrastructure/persistence/PostgresPlatformConnectionRepository');
        repo = new PostgresPlatformConnectionRepository(mockPool);
    });

    test('findByBotToken returns connection when found', async () => {
        mockPool.query.mockResolvedValue({
            rows: [{ id: 'conn-1', organization_id: 'org-1', platform: 'telegram', bot_token: 'token:abc', is_active: true }]
        });
        const result = await repo.findByBotToken('token:abc');
        expect(result).not.toBeNull();
        expect(result.organization_id).toBe('org-1');
    });

    test('findByBotToken returns null when no active connection', async () => {
        mockPool.query.mockResolvedValue({ rows: [] });
        const result = await repo.findByBotToken('non-existent-token');
        expect(result).toBeNull();
    });

    test('findByOrganization returns all connections for org', async () => {
        mockPool.query.mockResolvedValue({
            rows: [
                { id: 'conn-1', organization_id: 'org-1', platform: 'telegram', bot_token: 'tok1', is_active: true },
                { id: 'conn-2', organization_id: 'org-1', platform: 'whatsapp', bot_token: 'tok2', is_active: true },
            ]
        });
        const result = await repo.findByOrganization('org-1');
        expect(result.length).toBe(2);
        expect(result[0].platform).toBe('telegram');
    });

    test('save inserts new connection', async () => {
        mockPool.query.mockResolvedValue({
            rows: [{ id: 'conn-new', organization_id: 'org-1', platform: 'telegram', bot_token: 'new-token', is_active: true }]
        });
        const result = await repo.save({
            organizationId: 'org-1', platform: 'telegram', botToken: 'new-token',
            platformUserId: 'user-123', settings: { webhook: true }
        });
        expect(result).not.toBeNull();
        expect(result.organization_id).toBe('org-1');
    });
});
