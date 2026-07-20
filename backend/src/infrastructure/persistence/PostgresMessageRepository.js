const IMessageRepository = require('../../domain/ports/IMessageRepository');
const Message = require('../../domain/entities/Message');

class PostgresMessageRepository extends IMessageRepository {
    constructor(pool) {
        super();
        this.pool = pool;
    }

    async save(message) {
        const result = await this.pool.query(
            `INSERT INTO messages (organization_id, conversation_id, role, content, intent_score, captured_data)
             VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
            [message.organizationId, message.conversationId, message.role, message.content, message.intentScore, JSON.stringify(message.capturedData)]
        );
        return result.rows[0];
    }

    async findByConversation(conversationId, limit = 5) {
        const result = await this.pool.query(
            'SELECT role, content, intent_score, created_at, captured_data FROM messages WHERE conversation_id = $1 ORDER BY created_at DESC LIMIT $2',
            [conversationId, limit]
        );
        return result.rows.reverse().map(r => new Message({
            role: r.role, content: r.content, intentScore: r.intent_score,
            capturedData: r.captured_data, createdAt: r.created_at,
        }));
    }

    async getConversations(organizationId) {
        const result = await this.pool.query(`
            SELECT conversation_id as id, MAX(created_at) as last_activity,
                (SELECT content FROM messages WHERE conversation_id = m.conversation_id ORDER BY created_at DESC LIMIT 1) as last_msg,
                MAX(intent_score) as score,
                (SELECT captured_data FROM messages WHERE conversation_id = m.conversation_id AND role = 'assistant' AND captured_data IS NOT NULL AND captured_data::text != '{}'::text ORDER BY created_at DESC LIMIT 1) as captured_data
            FROM messages m WHERE organization_id = $1
            GROUP BY conversation_id ORDER BY last_activity DESC
        `, [organizationId]);
        return result.rows.map(row => {
            const data = row.captured_data || {};
            return { ...row, name: data.nombre || 'Usuario', status: data.kpi_category || 'Consultas', captured_data: data };
        });
    }
}

module.exports = PostgresMessageRepository;
