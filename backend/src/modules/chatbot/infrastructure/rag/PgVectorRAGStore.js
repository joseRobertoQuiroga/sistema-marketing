const { Pool } = require('pg');

/**
 * RAG Store — Gestión de vectores para búsqueda semántica
 * Utiliza pgvector para almacenar y buscar embeddings
 */
class PgVectorRAGStore {
    constructor({ pool, log }) {
        this.pool = pool;
        this.log = log?.child({ service: 'PgVectorRAGStore' });
    }

    /**
     * Busca fragmentos de conocimiento similares por embedding
     */
    async searchSimilar(organizationId, embedding, limit = 4) {
        const start = Date.now();
        try {
            const result = await this.pool.query(
                `SELECT content, source_type, source_name, metadata,
                        1 - (embedding <=> $2) as similarity
                 FROM knowledge_chunks
                 WHERE organization_id = $1
                   AND is_active = true
                   AND deleted_at IS NULL
                 ORDER BY embedding <=> $2
                 LIMIT $3`,
                [organizationId, JSON.stringify(embedding), limit]
            );
            this.log?.debug('búsqueda RAG', {
                results: result.rows.length,
                durationMs: Date.now() - start,
            });
            return result.rows;
        } catch (err) {
            this.log?.error('error en búsqueda RAG', {
                err: err.message,
                durationMs: Date.now() - start,
            });
            return [];
        }
    }

    /**
     * Busca productos por similitud semántica
     */
    async searchProducts(organizationId, embedding, limit = 5) {
        const result = await this.pool.query(
            `SELECT id, name, description, price, currency, category, image_url
             FROM products
             WHERE organization_id = $1 AND is_active = true
             ORDER BY
                CASE WHEN $2 IS NOT NULL THEN 1 - (embedding <=> $2) END DESC NULLS LAST,
                created_at DESC
             LIMIT $3`,
            [organizationId, embedding ? JSON.stringify(embedding) : null, limit]
        );
        return result.rows;
    }

    /**
     * Indexa un fragmento de conocimiento (crea embedding + guarda)
     */
    async indexChunk(organizationId, content, sourceType, sourceName, embedding, metadata = {}) {
        const result = await this.pool.query(
            `INSERT INTO knowledge_chunks (organization_id, source_type, source_name, content, embedding, metadata)
             VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
            [organizationId, sourceType, sourceName, content, JSON.stringify(embedding), JSON.stringify(metadata)]
        );
        return result.rows[0].id;
    }

    /**
     * Elimina fragmentos de conocimiento por organización
     */
    async clearOrganizationChunks(organizationId) {
        await this.pool.query(
            'UPDATE knowledge_chunks SET deleted_at = NOW(), is_active = false WHERE organization_id = $1 AND deleted_at IS NULL',
            [organizationId]
        );
    }
}

module.exports = PgVectorRAGStore;
