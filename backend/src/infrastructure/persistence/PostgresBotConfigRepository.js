const IBotConfigRepository = require('../../domain/ports/IBotConfigRepository');
const BotConfig = require('../../domain/entities/BotConfig');

class PostgresBotConfigRepository extends IBotConfigRepository {
    constructor(pool) {
        super();
        this.pool = pool;
    }

    async findByOrganization(organizationId) {
        const result = await this.pool.query('SELECT * FROM bot_configs WHERE organization_id = $1', [organizationId]);
        const row = result.rows[0];
        if (!row) {
            return new BotConfig({ organizationId });
        }
        return new BotConfig({
            organizationId: row.organization_id,
            businessName: row.business_name, tone: row.tone,
            escalationMessage: row.escalation_message,
            welcomeMessage: row.welcome_message, updatedAt: row.updated_at,
        });
    }
}

module.exports = PostgresBotConfigRepository;
