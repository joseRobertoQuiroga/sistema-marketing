const { Pool } = require('pg');
const Campaign = require('../../domain/entities/Campaign');
const ICampaignRepository = require('../../domain/ports/ICampaignRepository');

class PostgresCampaignRepository extends ICampaignRepository {
    constructor({ pool, log }) {
        super();
        this.pool = pool;
        this.log = log?.child({ service: 'PostgresCampaignRepository' });
    }

    async findById(id) {
        const result = await this.pool.query('SELECT * FROM campaigns WHERE id = $1', [id]);
        return result.rows[0] ? this._mapRow(result.rows[0]) : null;
    }

    async findByOrganization(organizationId, filters = {}) {
        let query = 'SELECT * FROM campaigns WHERE organization_id = $1';
        const params = [organizationId];
        let idx = 2;

        if (filters.status) {
            query += ` AND status = $${idx++}`;
            params.push(filters.status);
        }
        if (filters.platform) {
            query += ` AND platform = $${idx++}`;
            params.push(filters.platform);
        }

        query += ' ORDER BY created_at DESC';

        if (filters.limit) {
            query += ` LIMIT $${idx++}`;
            params.push(filters.limit);
        }
        if (filters.offset) {
            query += ` OFFSET $${idx++}`;
            params.push(filters.offset);
        }

        const result = await this.pool.query(query, params);
        return result.rows.map(r => this._mapRow(r));
    }

    async save(campaign) {
        const result = await this.pool.query(
            `INSERT INTO campaigns (organization_id, name, platform, template_id, audience_filter, scheduled_at, status, stats, created_by)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
             ON CONFLICT (id)
             DO UPDATE SET name = EXCLUDED.name, platform = EXCLUDED.platform,
                           audience_filter = EXCLUDED.audience_filter, scheduled_at = EXCLUDED.scheduled_at,
                           status = EXCLUDED.status, stats = EXCLUDED.stats, updated_at = NOW()
             RETURNING *`,
            [
                campaign.organizationId, campaign.name, campaign.platform,
                campaign.templateId || null,
                JSON.stringify(campaign.audienceFilter),
                campaign.scheduledAt,
                campaign.status,
                JSON.stringify(campaign.stats),
                campaign.createdBy,
            ]
        );
        return this._mapRow(result.rows[0]);
    }

    async updateStatus(id, status, stats) {
        const result = await this.pool.query(
            `UPDATE campaigns SET status = $1, stats = COALESCE($2, stats), updated_at = NOW() WHERE id = $3 RETURNING *`,
            [status, stats ? JSON.stringify(stats) : null, id]
        );
        return result.rows[0] ? this._mapRow(result.rows[0]) : null;
    }

    async findDue(platform) {
        let query = `SELECT * FROM campaigns WHERE status = 'scheduled' AND scheduled_at <= NOW()`;
        const params = [];
        if (platform && platform !== 'all') {
            query += ` AND (platform = $1 OR platform = 'all')`;
            params.push(platform);
        }
        query += ' ORDER BY scheduled_at ASC LIMIT 50';
        const result = await this.pool.query(query, params);
        return result.rows.map(r => this._mapRow(r));
    }

    async saveCampaignMessage(msg) {
        const result = await this.pool.query(
            `INSERT INTO campaign_messages (campaign_id, organization_id, platform_conversation_id, platform, content, status, metadata)
             VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
            [
                msg.campaignId, msg.organizationId, msg.platformConversationId,
                msg.platform, msg.content, msg.status || 'pending',
                JSON.stringify(msg.metadata || {}),
            ]
        );
        return result.rows[0];
    }

    async getCampaignMessages(campaignId, filters = {}) {
        let query = 'SELECT * FROM campaign_messages WHERE campaign_id = $1';
        const params = [campaignId];
        let idx = 2;

        if (filters.status) {
            query += ` AND status = $${idx++}`;
            params.push(filters.status);
        }

        query += ' ORDER BY created_at ASC';

        if (filters.limit) {
            query += ` LIMIT $${idx++}`;
            params.push(filters.limit);
        }

        const result = await this.pool.query(query, params);
        return result.rows;
    }

    async updateCampaignMessageStatus(id, status, extra = {}) {
        const setClauses = ['status = $1'];
        const params = [status];
        let idx = 2;

        if (extra.sentAt) { setClauses.push(`sent_at = $${idx++}`); params.push(extra.sentAt); }
        if (extra.deliveredAt) { setClauses.push(`delivered_at = $${idx++}`); params.push(extra.deliveredAt); }
        if (extra.readAt) { setClauses.push(`read_at = $${idx++}`); params.push(extra.readAt); }
        if (extra.repliedAt) { setClauses.push(`replied_at = $${idx++}`); params.push(extra.repliedAt); }
        if (extra.error) { setClauses.push(`error = $${idx++}`); params.push(extra.error); }

        params.push(id);
        await this.pool.query(
            `UPDATE campaign_messages SET ${setClauses.join(', ')} WHERE id = $${idx}`,
            params
        );
    }

    async getStats(organizationId) {
        const result = await this.pool.query(
            `SELECT
                COUNT(*)::int AS total,
                COUNT(*) FILTER (WHERE status = 'draft')::int AS drafts,
                COUNT(*) FILTER (WHERE status = 'scheduled')::int AS scheduled,
                COUNT(*) FILTER (WHERE status = 'sending')::int AS sending,
                COUNT(*) FILTER (WHERE status = 'completed')::int AS completed,
                COUNT(*) FILTER (WHERE status = 'cancelled')::int AS cancelled,
                COUNT(*) FILTER (WHERE status = 'failed')::int AS failed,
                COALESCE(SUM((stats->>'sent')::int), 0)::int AS total_sent,
                COALESCE(SUM((stats->>'delivered')::int), 0)::int AS total_delivered,
                COALESCE(SUM((stats->>'read')::int), 0)::int AS total_read,
                COALESCE(SUM((stats->>'replied')::int), 0)::int AS total_replied
             FROM campaigns WHERE organization_id = $1`,
            [organizationId]
        );
        return result.rows[0];
    }

    _mapRow(r) {
        return new Campaign({
            id: r.id,
            organizationId: r.organization_id,
            name: r.name,
            platform: r.platform,
            templateId: r.template_id,
            audienceFilter: r.audience_filter || {},
            scheduledAt: r.scheduled_at,
            status: r.status,
            stats: typeof r.stats === 'string' ? JSON.parse(r.stats) : (r.stats || {}),
            createdBy: r.created_by,
            createdAt: r.created_at,
            updatedAt: r.updated_at,
        });
    }
}

module.exports = PostgresCampaignRepository;
