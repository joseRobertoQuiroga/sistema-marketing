class LumiContextBuilder {
    constructor({ pool, log }) {
        this.pool = pool;
        this.log = log?.child({ service: 'LumiContextBuilder' });
    }

    async getFullContext(organizationId) {
        const start = Date.now();
        this.log?.info('construyendo contexto Lumi', { orgId: organizationId });

        const [sales, products, customers, campaigns] = await Promise.all([
            this.getSalesSummary(organizationId),
            this.getProductStats(organizationId),
            this.getCustomerStats(organizationId),
            this.getCampaignSummary(organizationId),
        ]);

        const context = { sales, products, customers, campaigns };
        this.log?.info('contexto Lumi construido', { durationMs: Date.now() - start });

        return context;
    }

    async getSalesSummary(organizationId, period = 'month') {
        const dateFilter = period === 'month'
            ? "AND created_at >= date_trunc('month', NOW())"
            : period === 'week'
            ? "AND created_at >= date_trunc('week', NOW())"
            : '';

        const result = await this.pool.query(`
            SELECT
                COUNT(*)::int AS total_messages,
                COUNT(*) FILTER (WHERE role = 'user')::int AS user_messages,
                COUNT(*) FILTER (WHERE role = 'assistant')::int AS bot_messages,
                COALESCE(AVG(intent_score), 0)::float AS avg_intent_score,
                COUNT(*) FILTER (WHERE intent_score >= 7)::int AS high_intent_count
            FROM messages
            WHERE organization_id = $1 ${dateFilter}
        `, [organizationId]);

        const productSales = await this.pool.query(`
            SELECT COUNT(*)::int AS total, COUNT(*) FILTER (WHERE is_active = true)::int AS active
            FROM products WHERE organization_id = $1
        `, [organizationId]);

        return {
            messages: result.rows[0] || { total_messages: 0, user_messages: 0, bot_messages: 0, avg_intent_score: 0, high_intent_count: 0 },
            products: productSales.rows[0] || { total: 0, active: 0 },
            period,
        };
    }

    async getProductStats(organizationId) {
        const result = await this.pool.query(`
            SELECT
                COUNT(*)::int AS total,
                COUNT(*) FILTER (WHERE is_active = true)::int AS active,
                COUNT(*) FILTER (WHERE is_active = false OR is_active IS NULL)::int AS inactive,
                COALESCE(MIN(price), 0)::float AS min_price,
                COALESCE(MAX(price), 0)::float AS max_price,
                COALESCE(AVG(price), 0)::float AS avg_price
            FROM products WHERE organization_id = $1
        `, [organizationId]);

        const categories = await this.pool.query(`
            SELECT category, COUNT(*)::int AS count
            FROM products WHERE organization_id = $1 AND category IS NOT NULL
            GROUP BY category ORDER BY count DESC LIMIT 10
        `, [organizationId]);

        return {
            summary: result.rows[0] || { total: 0, active: 0, inactive: 0, min_price: 0, max_price: 0, avg_price: 0 },
            categories: categories.rows,
        };
    }

    async getCustomerStats(organizationId) {
        const result = await this.pool.query(`
            SELECT
                COUNT(*)::int AS total_leads,
                COUNT(*) FILTER (WHERE status = 'new')::int AS new_leads,
                COUNT(*) FILTER (WHERE status = 'contacted')::int AS contacted,
                COUNT(*) FILTER (WHERE status = 'converted')::int AS converted,
                COALESCE(AVG(score), 0)::float AS avg_score
            FROM leads WHERE organization_id = $1
        `, [organizationId]);

        const sources = await this.pool.query(`
            SELECT source, COUNT(*)::int AS count
            FROM leads WHERE organization_id = $1 AND source IS NOT NULL
            GROUP BY source ORDER BY count DESC
        `, [organizationId]);

        return {
            summary: result.rows[0] || { total_leads: 0, new_leads: 0, contacted: 0, converted: 0, avg_score: 0 },
            sources: sources.rows,
        };
    }

    async getCampaignSummary(organizationId) {
        const result = await this.pool.query(`
            SELECT
                COUNT(*)::int AS total,
                COUNT(*) FILTER (WHERE status = 'completed')::int AS completed,
                COUNT(*) FILTER (WHERE status = 'sending')::int AS active,
                COUNT(*) FILTER (WHERE status = 'scheduled')::int AS scheduled,
                COALESCE(SUM((stats->>'sent')::int), 0)::int AS total_sent
            FROM campaigns WHERE organization_id = $1
        `, [organizationId]);

        return result.rows[0] || { total: 0, completed: 0, active: 0, scheduled: 0, total_sent: 0 };
    }
}

module.exports = LumiContextBuilder;
