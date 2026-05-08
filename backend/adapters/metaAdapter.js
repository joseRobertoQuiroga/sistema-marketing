require('dotenv').config();
const axios = require('axios');

class MetaAdapter {
    constructor() {
        this.graphBaseURL = 'https://graph.facebook.com/v19.0';
        this.appId = process.env.META_APP_ID;
        this.appSecret = process.env.META_APP_SECRET;
        this.redirectUri = process.env.META_REDIRECT_URI;
    }

    /**
     * Genera la URL para iniciar el flujo OAuth de Meta
     */
    getAuthUrl(state) {
        const params = new URLSearchParams({
            client_id: this.appId,
            redirect_uri: this.redirectUri,
            scope: 'pages_show_list,pages_read_engagement,instagram_basic,instagram_manage_insights',
            response_type: 'code',
            state
        });
        return `https://www.facebook.com/v19.0/dialog/oauth?${params.toString()}`;
    }

    /**
     * Intercambia el código de autorización por un token de corta duración,
     * luego lo extiende a un token de larga duración (60 días)
     */
    async exchangeCodeForLongLivedToken(code) {
        // 1. Obtener token de corta duración
        const shortTokenRes = await axios.get(`${this.graphBaseURL}/oauth/access_token`, {
            params: {
                client_id: this.appId,
                client_secret: this.appSecret,
                redirect_uri: this.redirectUri,
                code
            }
        });
        const shortToken = shortTokenRes.data.access_token;

        // 2. Extender a token de larga duración
        const longTokenRes = await axios.get(`${this.graphBaseURL}/oauth/access_token`, {
            params: {
                grant_type: 'fb_exchange_token',
                client_id: this.appId,
                client_secret: this.appSecret,
                fb_exchange_token: shortToken
            }
        });
        return longTokenRes.data; // { access_token, token_type, expires_in }
    }

    /**
     * Obtiene métricas de alcance e impresiones de una Página de Facebook
     */
    async fetchPageInsights(pageId, pageAccessToken, days = 30) {
        try {
            console.log(`[MetaAdapter] Solicitando insights para página ${pageId} (${days} días)`);
            // En producción con token real:
            // const response = await axios.get(`${this.graphBaseURL}/${pageId}/insights`, {
            //     params: {
            //         metric: 'page_impressions_unique,page_engaged_users,page_fan_adds',
            //         period: 'day',
            //         since: Math.floor((Date.now() - days * 86400000) / 1000),
            //         access_token: pageAccessToken
            //     }
            // });
            // return this._normalizeInsights(response.data.data);

            // Datos simulados mientras se configura el token:
            return {
                platform: 'facebook',
                followers: Math.floor(Math.random() * 15000) + 3000,
                reach: Math.floor(Math.random() * 50000) + 5000,
                engagement: Math.floor(Math.random() * 2000) + 200,
                new_fans: Math.floor(Math.random() * 100) + 10
            };
        } catch (error) {
            console.error('[MetaAdapter] Error al extraer page insights:', error.message);
            throw error;
        }
    }

    /**
     * Obtiene métricas de una cuenta de Instagram Business
     */
    async fetchInstagramInsights(igAccountId, pageAccessToken, days = 30) {
        try {
            console.log(`[MetaAdapter] Solicitando IG insights para cuenta ${igAccountId}`);
            // En producción:
            // const response = await axios.get(`${this.graphBaseURL}/${igAccountId}/insights`, {
            //     params: {
            //         metric: 'impressions,reach,profile_views,follower_count',
            //         period: 'day',
            //         access_token: pageAccessToken
            //     }
            // });
            return {
                platform: 'instagram',
                followers: Math.floor(Math.random() * 20000) + 5000,
                reach: Math.floor(Math.random() * 80000) + 10000,
                engagement_rate: (Math.random() * 4 + 2).toFixed(2),
                impressions: Math.floor(Math.random() * 120000) + 20000
            };
        } catch (error) {
            console.error('[MetaAdapter] Error al extraer IG insights:', error.message);
            throw error;
        }
    }

    /**
     * Obtiene métricas individuales de posts de Facebook
     */
    async fetchPostInsights(postId, accessToken) {
        try {
            // En producción: GET /{post_id}/insights con metrics=post_impressions,post_engaged_users
            return {
                platform: 'facebook',
                post_id: postId,
                likes: Math.floor(Math.random() * 500),
                comments: Math.floor(Math.random() * 50),
                shares: Math.floor(Math.random() * 80),
                reach: Math.floor(Math.random() * 5000)
            };
        } catch (error) {
            console.error('[MetaAdapter] Error al extraer post insights:', error.message);
            throw error;
        }
    }
}

module.exports = new MetaAdapter();
