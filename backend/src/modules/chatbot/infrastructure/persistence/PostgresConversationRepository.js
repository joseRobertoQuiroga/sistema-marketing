const { Pool } = require('pg');
const Conversation = require('../../domain/entities/Conversation');
const IConversationRepository = require('../../domain/ports/IConversationRepository');

/**
 * Implementación PostgreSQL del repositorio de conversaciones
 */
class PostgresConversationRepository extends IConversationRepository {
    constructor({ pool, log }) {
        super();
        this.pool = pool;
        this.log = log?.child({ service: 'PostgresConversationRepository' });
    }

    async findById(id) {
        const result = await this.pool.query('SELECT * FROM conversations WHERE id = $1', [id]);
        return result.rows[0] ? this._mapRow(result.rows[0]) : null;
    }

    async findByPlatform(organizationId, platform, platformConversationId) {
        const result = await this.pool.query(
            `SELECT * FROM conversations
             WHERE organization_id = $1 AND platform = $2 AND platform_conversation_id = $3`,
            [organizationId, platform, platformConversationId]
        );
        return result.rows[0] ? this._mapRow(result.rows[0]) : null;
    }

    async findByOrganization(organizationId, filters = {}) {
        let query = 'SELECT * FROM conversations WHERE organization_id = $1';
        const params = [organizationId];
        let paramIdx = 2;

        if (filters.platform) {
            query += ` AND platform = $${paramIdx++}`;
            params.push(filters.platform);
        }
        if (filters.status) {
            query += ` AND status = $${paramIdx++}`;
            params.push(filters.status);
        }

        query += ' ORDER BY updated_at DESC';
        if (filters.limit) {
            query += ` LIMIT $${paramIdx++}`;
            params.push(filters.limit);
        }

        const result = await this.pool.query(query, params);
        return result.rows.map(r => this._mapRow(r));
    }

    async save(conversation) {
        const result = await this.pool.query(
            `INSERT INTO conversations (organization_id, platform, platform_conversation_id, contact_name, contact_info, status, metadata)
             VALUES ($1, $2, $3, $4, $5, $6, $7)
             ON CONFLICT (organization_id, platform, platform_conversation_id)
             DO UPDATE SET contact_name = COALESCE(EXCLUDED.contact_name, conversations.contact_name),
                           contact_info = conversations.contact_info || EXCLUDED.contact_info,
                           status = EXCLUDED.status,
                           metadata = conversations.metadata || EXCLUDED.metadata,
                           updated_at = NOW()
             RETURNING *`,
            [
                conversation.organizationId, conversation.platform,
                conversation.platformConversationId, conversation.contactName,
                JSON.stringify(conversation.contactInfo), conversation.status,
                JSON.stringify(conversation.metadata),
            ]
        );
        return this._mapRow(result.rows[0]);
    }

    async updateStatus(id, status) {
        const result = await this.pool.query(
            'UPDATE conversations SET status = $1, updated_at = NOW() WHERE id = $2 RETURNING *',
            [status, id]
        );
        return result.rows[0] ? this._mapRow(result.rows[0]) : null;
    }

    _mapRow(r) {
        return new Conversation({
            id: r.id,
            organizationId: r.organization_id,
            platform: r.platform,
            platformConversationId: r.platform_conversation_id,
            contactName: r.contact_name,
            contactInfo: r.contact_info || {},
            status: r.status,
            metadata: r.metadata || {},
            createdAt: r.created_at,
            updatedAt: r.updated_at,
        });
    }
}

module.exports = PostgresConversationRepository;
