const IPlatformConnectionRepository = require('../../domain/ports/IPlatformConnectionRepository');

class PostgresPlatformConnectionRepository extends IPlatformConnectionRepository {
    constructor(pool) {
        super();
        this.pool = pool;
    }

    async findByBotToken(botToken) {
        const result = await this.pool.query(
            'SELECT * FROM platform_connections WHERE bot_token = $1 AND is_active = true LIMIT 1',
            [botToken]
        );
        return result.rows[0] || null;
    }

    async findByOrganization(organizationId) {
        const result = await this.pool.query(
            'SELECT * FROM platform_connections WHERE organization_id = $1 AND is_active = true',
            [organizationId]
        );
        return result.rows;
    }

    async save(connection) {
        const result = await this.pool.query(`
            INSERT INTO platform_connections (organization_id, platform, bot_token, platform_user_id, settings, is_active)
            VALUES ($1, $2, $3, $4, $5, $6)
            ON CONFLICT (organization_id, platform) DO UPDATE SET
                bot_token = EXCLUDED.bot_token,
                platform_user_id = EXCLUDED.platform_user_id,
                settings = COALESCE(platform_connections.settings || EXCLUDED.settings, EXCLUDED.settings),
                is_active = EXCLUDED.is_active,
                updated_at = NOW()
            RETURNING *
        `, [connection.organizationId, connection.platform, connection.botToken,
            connection.platformUserId, JSON.stringify(connection.settings || {}), connection.isActive !== false]);
        return result.rows[0];
    }
}

module.exports = PostgresPlatformConnectionRepository;
