const { Pool } = require('pg');
const ChatMessage = require('../../domain/entities/ChatMessage');
const IChatMessageRepository = require('../../domain/ports/IChatMessageRepository');

/**
 * Implementación PostgreSQL del repositorio de mensajes del chatbot
 */
class PostgresChatMessageRepository extends IChatMessageRepository {
    constructor({ pool, log }) {
        super();
        this.pool = pool;
        this.log = log?.child({ service: 'PostgresChatMessageRepository' });
    }

    async save(message) {
        const result = await this.pool.query(
            `INSERT INTO messages (organization_id, conversation_id, role, content, intent_score, captured_data, metadata)
             VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
            [
                message.organizationId,
                message.conversationId || message.conversation_id,
                message.role,
                message.content,
                message.intentScore || 0,
                JSON.stringify(message.capturedData || {}),
                JSON.stringify({
                    platform: message.platform,
                    intent: message.intent,
                    traceId: message.traceId,
                    ...(message.metadata || {}),
                }),
            ]
        );
        return result.rows[0];
    }

    async findByConversation(conversationId, limit = 50, offset = 0) {
        const result = await this.pool.query(
            `SELECT id, conversation_id, role, content, intent_score, captured_data, metadata, created_at
             FROM messages
             WHERE conversation_id = $1
             ORDER BY created_at ASC
             LIMIT $2 OFFSET $3`,
            [conversationId, limit, offset]
        );
        return result.rows.map(r => new ChatMessage({
            id: r.id,
            conversationId: r.conversation_id,
            role: r.role,
            content: r.content,
            intentScore: r.intent_score,
            capturedData: r.captured_data,
            metadata: r.metadata || {},
            createdAt: r.created_at,
        }));
    }

    async findById(id) {
        const result = await this.pool.query(
            'SELECT * FROM messages WHERE id = $1', [id]
        );
        return result.rows[0] || null;
    }

    async countByOrganization(organizationId, filters = {}) {
        let query = 'SELECT COUNT(*) as total FROM messages WHERE organization_id = $1';
        const params = [organizationId];
        let idx = 2;

        if (filters.role) {
            query += ` AND role = $${idx++}`;
            params.push(filters.role);
        }
        if (filters.since) {
            query += ` AND created_at >= $${idx++}`;
            params.push(filters.since);
        }
        if (filters.until) {
            query += ` AND created_at <= $${idx++}`;
            params.push(filters.until);
        }

        const result = await this.pool.query(query, params);
        return parseInt(result.rows[0].total, 10);
    }

    async getPlatformSummary(organizationId) {
        const result = await this.pool.query(
            `SELECT
                m.metadata->>'platform' as platform,
                COUNT(*) as total_messages,
                COUNT(DISTINCT m.conversation_id) as total_conversations,
                AVG(m.intent_score) as avg_intent_score
             FROM messages m
             WHERE m.organization_id = $1
             GROUP BY m.metadata->>'platform'
             ORDER BY total_messages DESC`,
            [organizationId]
        );
        return result.rows;
    }
}

module.exports = PostgresChatMessageRepository;
