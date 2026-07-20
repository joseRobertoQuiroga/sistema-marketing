describe('RAG Engine: Knowledge Repository', () => {
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
        const PostgresKnowledgeRepository = require('../src/infrastructure/persistence/PostgresKnowledgeRepository');
        repo = new PostgresKnowledgeRepository(mockPool);
    });

    test('Debe llamar a la DB con el organization_id correcto', async () => {
        const orgId = 'test-org-123';
        const embedding = [0.1, 0.2, 0.3];
        mockPool.query.mockResolvedValue({ rows: [{ content: 'Vestido Rojo' }] });
        const result = await repo.searchSimilar(orgId, embedding, 3);
        expect(mockPool.query).toHaveBeenCalledWith(
            expect.stringContaining('WHERE organization_id = $1'),
            [orgId, JSON.stringify(embedding), 3]
        );
        expect(result).toEqual([{ content: 'Vestido Rojo' }]);
    });

    test('Debe retornar array vacío si no hay coincidencias', async () => {
        mockPool.query.mockResolvedValue({ rows: [] });
        const result = await repo.searchSimilar('org-1', [0.1], 3);
        expect(result).toEqual([]);
    });
});
