const Lead = require('../../src/domain/entities/Lead');

describe('Lead Entity', () => {
    test('kpiCategory returns "Conversión" for score >= 80', () => {
        const lead = new Lead({ score: 85 });
        expect(lead.kpiCategory).toBe('Conversión');
    });

    test('kpiCategory returns "Interés" for score >= 50', () => {
        const lead = new Lead({ score: 65 });
        expect(lead.kpiCategory).toBe('Interés');
    });

    test('kpiCategory returns "Consultas" for score < 50', () => {
        const lead = new Lead({ score: 30 });
        expect(lead.kpiCategory).toBe('Consultas');
    });

    test('default status is "new"', () => {
        const lead = new Lead({});
        expect(lead.status).toBe('new');
    });

    test('notes field defaults to null', () => {
        const lead = new Lead({});
        expect(lead.notes).toBeNull();
    });

    test('accepts all fields via constructor', () => {
        const lead = new Lead({
            id: 'abc-123', organizationId: 'org-1', conversationId: 'conv-1',
            name: 'Juan', contactInfo: { localidad: 'La Paz' }, source: 'telegram',
            status: 'qualified', score: 75, capturedData: { intereses: 'moda' },
            notes: 'Cliente interesado', createdAt: new Date(), updatedAt: new Date(),
        });
        expect(lead.name).toBe('Juan');
        expect(lead.status).toBe('qualified');
        expect(lead.notes).toBe('Cliente interesado');
        expect(lead.score).toBe(75);
    });
});

describe('PostgresLeadRepository.update()', () => {
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
        const PostgresLeadRepository = require('../../src/infrastructure/persistence/PostgresLeadRepository');
        repo = new PostgresLeadRepository(mockPool);
    });

    test('updates status and name', async () => {
        mockPool.query.mockResolvedValue({
            rows: [{ id: 'lead-1', organization_id: 'org-1', conversation_id: 'conv-1', name: 'Juan', contact_info: {}, source: 'telegram', status: 'contacted', score: 60, captured_data: {}, created_at: new Date(), updated_at: new Date() }]
        });
        const result = await repo.update('org-1', 'lead-1', { status: 'contacted', name: 'Juan' });
        expect(result).not.toBeNull();
        expect(result.status).toBe('contacted');
        expect(mockPool.query).toHaveBeenCalledWith(
            expect.stringContaining('UPDATE leads'),
            expect.arrayContaining(['contacted', 'Juan', 'org-1', 'lead-1'])
        );
    });

    test('returns null when no rows affected', async () => {
        mockPool.query.mockResolvedValue({ rows: [] });
        const result = await repo.update('org-1', 'non-existent', { status: 'lost' });
        expect(result).toBeNull();
    });

    test('returns null when no data provided', async () => {
        const result = await repo.update('org-1', 'lead-1', {});
        expect(result).toBeNull();
    });
});
