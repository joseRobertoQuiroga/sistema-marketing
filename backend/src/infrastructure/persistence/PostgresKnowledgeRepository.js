const IKnowledgeRepository = require('../../domain/ports/IKnowledgeRepository');

class PostgresKnowledgeRepository extends IKnowledgeRepository {
    constructor(pool) {
        super();
        this.pool = pool;
    }

    async searchSimilar(organizationId, embedding, limit = 3) {
        const result = await this.pool.query(
            `SELECT content FROM knowledge_chunks
             WHERE organization_id = $1
             ORDER BY embedding <=> $2 LIMIT $3`,
            [organizationId, JSON.stringify(embedding), limit]
        );
        return result.rows;
    }
}

module.exports = PostgresKnowledgeRepository;
