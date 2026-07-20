const { Worker } = require('bullmq');
const Redis = require('ioredis');
const axios = require('axios');
const logger = require('../../infrastructure/utils/logger');

class MetricSyncWorker {
    constructor({ pool, queue }) {
        this.pool = pool;
        this.connection = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');

        this.worker = new Worker('metric-sync', async (job) => {
            await this.syncMetrics(job.data.connectionId);
        }, {
            connection: this.connection,
            concurrency: 2,
        });

        this.worker.on('completed', (job) => {
            logger.info({ jobId: job.id, connectionId: job.data.connectionId }, 'Metric sync completed');
        });

        this.worker.on('failed', (job, err) => {
            logger.error({ jobId: job.id, connectionId: job.data.connectionId, err }, 'Metric sync failed');
        });
    }

    async syncMetrics(connectionId) {
        const conn = await this.pool.query(
            'SELECT * FROM social_connections WHERE id = $1 AND is_active = true',
            [connectionId]
        );
        if (!conn.rows.length) return;

        const connection = conn.rows[0];
        const token = connection.access_token;

        if (connection.platform === 'instagram' || connection.platform === 'facebook') {
            await this.syncMetaMetrics(connection, token);
        }
    }

    async syncMetaMetrics(connection, token) {
        try {
            const igId = connection.platform_account_id;
            const version = process.env.META_API_VERSION || 'v21.0';
            const fields = 'followers_count,media_count,insights.metric(impressions,reach,profile_views,website_clicks)';

            const res = await axios.get(`https://graph.facebook.com/${version}/${igId}`, {
                params: { fields, access_token: token }
            });

            const data = res.data;
            const today = new Date().toISOString().split('T')[0];

            await this.pool.query(`
                INSERT INTO account_metrics (organization_id, social_connection_id, metric_date, followers, posts_count, views, reach)
                VALUES ($1, $2, $3, $4, $5, $6, $7)
                ON CONFLICT (organization_id, social_connection_id, metric_date) DO UPDATE SET
                    followers = EXCLUDED.followers,
                    posts_count = EXCLUDED.posts_count,
                    views = EXCLUDED.views,
                    reach = EXCLUDED.reach
            `, [
                connection.organization_id, connection.id, today,
                data.followers_count || 0, data.media_count || 0,
                data.insights?.data?.[2]?.values?.[0]?.value || 0,
                data.insights?.data?.[1]?.values?.[0]?.value || 0,
            ]);
        } catch (err) {
            logger.error({ err, connectionId: connection.id }, 'Failed to sync Meta metrics');
        }
    }

    async close() {
        await this.worker.close();
        await this.connection.quit();
    }
}

module.exports = MetricSyncWorker;
