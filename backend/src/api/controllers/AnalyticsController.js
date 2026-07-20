const { encrypt, decrypt } = require('../../infrastructure/utils/crypto');
const logger = require('../../infrastructure/utils/logger');

class AnalyticsController {
    constructor({ pool }) {
        this.pool = pool;
    }

    async connectMeta(req, res) {
        const orgId = req.user.orgId;
        const state = encrypt(JSON.stringify({ orgId, timestamp: Date.now() }));
        const appId = process.env.META_APP_ID;
        const redirectUri = `${process.env.DOMAIN_URL || 'http://localhost:3000'}/api/analytics/meta/callback`;
        const scope = 'instagram_basic,instagram_manage_insights,pages_read_engagement,pages_show_list';

        const url = `https://www.facebook.com/v${process.env.META_API_VERSION || '21.0'}/dialog/oauth?client_id=${appId}&redirect_uri=${encodeURIComponent(redirectUri)}&state=${state}&scope=${scope}`;

        res.json({ url });
    }

    async metaCallback(req, res) {
        const { code, state } = req.query;

        if (!code || !state) {
            return res.redirect(`${process.env.FRONTEND_URL}/settings?error=oauth_failed`);
        }

        try {
            const stateData = JSON.parse(decrypt(state));
            const orgId = stateData.orgId;

            const appId = process.env.META_APP_ID;
            const appSecret = process.env.META_APP_SECRET;
            const redirectUri = `${process.env.DOMAIN_URL || 'http://localhost:3000'}/api/analytics/meta/callback`;

            const axios = require('axios');
            const tokenRes = await axios.get('https://graph.facebook.com/v21.0/oauth/access_token', {
                params: {
                    client_id: appId,
                    client_secret: appSecret,
                    redirect_uri: redirectUri,
                    code,
                }
            });

            const accessToken = tokenRes.data.access_token;

            const accountsRes = await axios.get('https://graph.facebook.com/v21.0/me/accounts', {
                params: { access_token: accessToken }
            });

            for (const page of accountsRes.data.data || []) {
                const encryptedToken = encrypt(page.access_token);
                await this.pool.query(`
                    INSERT INTO social_connections (organization_id, platform, platform_account_id, platform_account_name, access_token, token_expires_at)
                    VALUES ($1, 'facebook', $2, $3, $4, NOW() + INTERVAL '60 days')
                    ON CONFLICT (organization_id, platform, platform_account_id) DO UPDATE SET
                        access_token = EXCLUDED.access_token,
                        platform_account_name = EXCLUDED.platform_account_name,
                        updated_at = NOW()
                `, [orgId, page.id, page.name, encryptedToken]);
            }

            res.redirect(`${process.env.FRONTEND_URL}/settings?connection=success`);
        } catch (err) {
            logger.error({ err }, 'Meta OAuth callback failed');
            res.redirect(`${process.env.FRONTEND_URL}/settings?error=oauth_failed`);
        }
    }

    async overview(req, res) {
        const orgId = req.user.orgId;

        const connectionsResult = await this.pool.query(
            'SELECT id, platform, platform_account_name, platform_account_avatar, is_active FROM social_connections WHERE organization_id = $1',
            [orgId]
        );

        const metricsResult = await this.pool.query(`
            SELECT COALESCE(SUM(followers), 0) as total_followers,
                   COALESCE(SUM(likes), 0) as total_likes,
                   COALESCE(SUM(comments), 0) as total_comments,
                   COALESCE(SUM(shares), 0) as total_shares,
                   COALESCE(SUM(views), 0) as total_views,
                   COALESCE(AVG(engagement_rate), 0) as avg_engagement
            FROM account_metrics
            WHERE organization_id = $1
              AND metric_date >= NOW() - INTERVAL '30 days'
        `, [orgId]);

        const trendResult = await this.pool.query(`
            SELECT metric_date, SUM(followers) as followers, SUM(likes) as likes, SUM(comments) as comments
            FROM account_metrics
            WHERE organization_id = $1
              AND metric_date >= NOW() - INTERVAL '30 days'
            GROUP BY metric_date
            ORDER BY metric_date ASC
        `, [orgId]);

        res.json({
            connections: connectionsResult.rows,
            metrics: metricsResult.rows[0] || {},
            trend: trendResult.rows,
        });
    }
}

module.exports = AnalyticsController;
