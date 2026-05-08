require('dotenv').config();
const axios = require('axios');

class TikTokAdapter {
    constructor() {
        this.baseURL = 'https://open.tiktokapis.com/v2';
        this.appId = process.env.TIKTOK_APP_ID;
        this.appSecret = process.env.TIKTOK_APP_SECRET;
        this.redirectUri = process.env.TIKTOK_REDIRECT_URI;
    }

    /**
     * Genera la URL para iniciar el flujo OAuth de TikTok Business
     */
    getAuthUrl(state) {
        const params = new URLSearchParams({
            client_key: this.appId,
            redirect_uri: this.redirectUri,
            scope: 'user.info.basic,video.list',
            response_type: 'code',
            state
        });
        return `https://www.tiktok.com/v2/auth/authorize/?${params.toString()}`;
    }

    /**
     * Intercambia el código de autorización por un access_token
     */
    async exchangeCodeForToken(code) {
        const response = await axios.post(`${this.baseURL}/oauth/token/`, {
            client_key: this.appId,
            client_secret: this.appSecret,
            code,
            grant_type: 'authorization_code',
            redirect_uri: this.redirectUri
        });
        return response.data.data; // { access_token, refresh_token, open_id, expires_in }
    }

    /**
     * Obtiene el perfil e información de métricas del usuario
     */
    async fetchUserInfo(accessToken) {
        try {
            console.log(`[TikTokAdapter] Solicitando perfil del usuario`);
            // En producción:
            // const response = await axios.get(`${this.baseURL}/user/info/`, {
            //     headers: { Authorization: `Bearer ${accessToken}` },
            //     params: { fields: 'open_id,union_id,avatar_url,display_name,follower_count,following_count,likes_count,video_count' }
            // });
            // return response.data.data.user;
            
            return {
                platform: 'tiktok',
                display_name: 'Mi Marca TikTok',
                followers: Math.floor(Math.random() * 25000) + 5000,
                likes: Math.floor(Math.random() * 500000) + 50000,
                video_count: Math.floor(Math.random() * 200) + 20
            };
        } catch (error) {
            console.error('[TikTokAdapter] Error al extraer perfil:', error.message);
            throw error;
        }
    }

    /**
     * Obtiene métricas de los últimos videos del usuario
     */
    async fetchVideoInsights(accessToken) {
        try {
            console.log(`[TikTokAdapter] Solicitando métricas de videos`);
            // En producción:
            // const response = await axios.post(`${this.baseURL}/video/list/`, {
            //     fields: ['id', 'title', 'cover_image_url', 'video_description', 'duration', 'view_count', 'like_count', 'comment_count', 'share_count']
            // }, {
            //     headers: { Authorization: `Bearer ${accessToken}` }
            // });
            
            return Array.from({ length: 5 }, (_, i) => ({
                id: `video_${i + 1}`,
                platform: 'tiktok',
                title: `Video de contenido #${i + 1}`,
                views: Math.floor(Math.random() * 50000) + 1000,
                likes: Math.floor(Math.random() * 2000) + 50,
                comments: Math.floor(Math.random() * 200) + 5,
                shares: Math.floor(Math.random() * 500) + 10,
                engagement_rate: (Math.random() * 8 + 1).toFixed(2)
            }));
        } catch (error) {
            console.error('[TikTokAdapter] Error al extraer insights de videos:', error.message);
            throw error;
        }
    }
}

module.exports = new TikTokAdapter();
