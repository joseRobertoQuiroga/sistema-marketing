const logger = require('../../infrastructure/utils/logger-strategic');
const { pool } = require('../../config/db');

class MonitoringController {
    constructor() {
        this.log = logger.child({ controller: 'MonitoringController' });
        this._moduleRefs = {};
    }

    setModuleRefs(refs) {
        this._moduleRefs = refs;
    }

    async overview(req, res) {
        try {
            const orgId = req.user?.orgId;
            const isAdmin = req.user?.role === 'owner' || req.user?.role === 'admin';

            const [entityCounts, campaignStats, moduleHealth, recentActivity] = await Promise.all([
                this._getEntityCounts(orgId),
                this._getCampaignStats(orgId),
                this._getModuleHealth(),
                this._getRecentActivity(orgId),
            ]);

            res.json({
                modules: moduleHealth,
                entities: entityCounts,
                campaigns: campaignStats,
                activity: recentActivity,
                timestamp: new Date().toISOString(),
                uptime: process.uptime(),
                memory: process.memoryUsage(),
            });
        } catch (err) {
            this.log.error('error en monitoring overview', { err: err.message });
            res.status(500).json({ error: 'Error obteniendo monitoreo' });
        }
    }

    async dbHealth(req, res) {
        try {
            const start = Date.now();
            await pool.query('SELECT 1');
            const dbLatency = Date.now() - start;

            const tableCounts = await pool.query(`
                SELECT schemaname, tablename, n_live_tup::int AS row_count
                FROM pg_stat_user_tables
                WHERE schemaname = 'public'
                ORDER BY tablename
            `);

            const dbSize = await pool.query(`
                SELECT pg_database_size(current_database()) / 1024 / 1024 AS size_mb
            `);

            res.json({
                status: 'ok',
                latencyMs: dbLatency,
                tables: tableCounts.rows,
                sizeMb: dbSize.rows[0]?.size_mb || 0,
            });
        } catch (err) {
            res.status(503).json({ status: 'error', error: err.message });
        }
    }

    async modules(req, res) {
        res.json(this._getModuleHealthSync());
    }

    async activity(req, res) {
        try {
            const orgId = req.user?.orgId;
            const { limit = 20 } = req.query;
            const activity = await this._getRecentActivity(orgId, parseInt(limit));
            res.json(activity);
        } catch (err) {
            res.status(500).json({ error: err.message });
        }
    }

    async _getEntityCounts(orgId) {
        if (!orgId) return {};

        const queries = {
            products: `SELECT COUNT(*)::int AS count FROM products WHERE organization_id = $1`,
            active_products: `SELECT COUNT(*)::int AS count FROM products WHERE organization_id = $1 AND is_active = true`,
            leads: `SELECT COUNT(*)::int AS count FROM leads WHERE organization_id = $1`,
            conversations: `SELECT COUNT(*)::int AS count FROM conversations WHERE organization_id = $1`,
            active_conversations: `SELECT COUNT(*)::int AS count FROM conversations WHERE organization_id = $1 AND status = 'active'`,
            messages: `SELECT COUNT(*)::int AS count FROM messages WHERE organization_id = $1`,
            user_messages: `SELECT COUNT(*)::int AS count FROM messages WHERE organization_id = $1 AND role = 'user'`,
            campaigns: `SELECT COUNT(*)::int AS count FROM campaigns WHERE organization_id = $1`,
        };

        const entries = await Promise.all(
            Object.entries(queries).map(async ([key, sql]) => {
                try {
                    const result = await pool.query(sql, [orgId]);
                    return [key, result.rows[0].count];
                } catch {
                    return [key, 0];
                }
            })
        );

        return Object.fromEntries(entries);
    }

    async _getCampaignStats(orgId) {
        if (!orgId) return {};
        try {
            const result = await pool.query(`
                SELECT
                    COUNT(*)::int AS total,
                    COUNT(*) FILTER (WHERE status = 'draft')::int AS draft,
                    COUNT(*) FILTER (WHERE status = 'scheduled')::int AS scheduled,
                    COUNT(*) FILTER (WHERE status = 'sending')::int AS sending,
                    COUNT(*) FILTER (WHERE status = 'completed')::int AS completed,
                    COUNT(*) FILTER (WHERE status = 'failed')::int AS failed,
                    COALESCE(SUM((stats->>'sent')::int), 0)::int AS total_sent,
                    COALESCE(SUM((stats->>'delivered')::int), 0)::int AS total_delivered
                FROM campaigns WHERE organization_id = $1
            `, [orgId]);
            return result.rows[0];
        } catch {
            return {};
        }
    }

    async _getModuleHealth() {
        const chatbot = this._moduleRefs.chatbotComponents;
        const lumi = this._moduleRefs.lumiComponents;
        const campaignScheduler = this._moduleRefs.campaignScheduler;

        return {
            chatbot: {
                status: chatbot?.processMessage ? 'ok' : 'inactive',
                platforms: chatbot?.platformFactory?.getRegistered() || [],
                aiProviders: chatbot?.aiProvider?.getMetrics?.() || { availableProviders: [] },
                conversations: chatbot?.conversationRepo ? 'connected' : 'not_loaded',
            },
            lumi: {
                status: lumi?.orchestrator ? 'ok' : 'inactive',
                contextBuilder: lumi?.contextBuilder ? 'connected' : 'not_loaded',
            },
            campaigns: {
                status: campaignScheduler ? 'ok' : 'inactive',
                scheduler: campaignScheduler?.constructor?.name || 'not_loaded',
            },
        };
    }

    _getModuleHealthSync() {
        const chatbot = this._moduleRefs.chatbotComponents;
        const lumi = this._moduleRefs.lumiComponents;

        return {
            chatbot: {
                status: chatbot?.processMessage ? 'ok' : 'inactive',
                platforms: chatbot?.platformFactory?.getRegistered() || [],
                aiProviders: chatbot?.aiProvider?.getMetrics?.() || { availableProviders: [] },
                initialized: !!chatbot?.processMessage,
            },
            lumi: {
                status: lumi?.orchestrator ? 'ok' : 'inactive',
                initialized: !!lumi?.orchestrator,
            },
            campaigns: {
                status: this._moduleRefs.campaignScheduler ? 'ok' : 'inactive',
                schedulerRunning: !!this._moduleRefs.campaignScheduler,
            },
        };
    }

    async _getRecentActivity(orgId, limit = 20) {
        if (!orgId) return [];
        try {
            const messages = await pool.query(`
                SELECT 'message' AS type, id, role, content, created_at AS timestamp
                FROM messages WHERE organization_id = $1
                ORDER BY created_at DESC LIMIT $2
            `, [orgId, limit]);

            const campaigns = await pool.query(`
                SELECT 'campaign' AS type, id::text, name AS content, status AS role, updated_at AS timestamp
                FROM campaigns WHERE organization_id = $1
                ORDER BY updated_at DESC LIMIT $2
            `, [orgId, limit]);

            const combined = [...messages.rows, ...campaigns.rows]
                .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
                .slice(0, limit);

            return combined.map(r => ({
                type: r.type,
                id: r.id,
                summary: r.type === 'message'
                    ? `${r.role === 'user' ? '📩' : '🤖'} ${(r.content || '').slice(0, 60)}`
                    : `📊 Campaña: ${r.content || 'sin nombre'} (${r.role})`,
                timestamp: r.timestamp,
            }));
        } catch {
            return [];
        }
    }
}

module.exports = MonitoringController;
