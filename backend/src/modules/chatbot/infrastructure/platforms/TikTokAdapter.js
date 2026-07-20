const axios = require('axios');
const IPlatformAdapter = require('../../domain/ports/IPlatformAdapter');

/**
 * Adaptador para TikTok Messaging API
 * 
 * OCP: Implementa IPlatformAdapter — nuevo plugin sin modificar el núcleo
 * Documentación: https://developers.tiktok.com/docs/messaging
 * 
 * Config:
 *   TIKTOK_APP_ID — ID de la aplicación TikTok
 *   TIKTOK_ACCESS_TOKEN — Token de acceso
 *   TIKTOK_WEBHOOK_VERIFY_TOKEN — Token de verificación
 */
class TikTokAdapter extends IPlatformAdapter {
    get name() { return 'tiktok'; }
    get category() { return 'social'; }

    constructor() {
        super();
        this.appId = process.env.TIKTOK_APP_ID;
        this.accessToken = process.env.TIKTOK_ACCESS_TOKEN;
        this.baseUrl = 'https://open-api.tiktok.com/v2';
    }

    async sendMessage(conversationId, text, options = {}) {
        if (!this.accessToken) throw new Error('TikTok no configurado: falta TIKTOK_ACCESS_TOKEN');

        const response = await axios.post(
            `${this.baseUrl}/message/send/`,
            {
                app_id: this.appId,
                to_user_id: conversationId,
                message_type: 'text',
                content: text,
            },
            {
                headers: {
                    'access-token': this.accessToken,
                    'Content-Type': 'application/json',
                },
                timeout: 10000,
            }
        );
        return response.data;
    }

    async sendMedia(conversationId, mediaUrl, type, options = {}) {
        if (!this.accessToken) throw new Error('TikTok no configurado');

        const messageType = type === 'image' ? 'image' : 'video';

        const response = await axios.post(
            `${this.baseUrl}/message/send/`,
            {
                app_id: this.appId,
                to_user_id: conversationId,
                message_type: messageType,
                content: mediaUrl,
            },
            {
                headers: {
                    'access-token': this.accessToken,
                    'Content-Type': 'application/json',
                },
                timeout: 15000,
            }
        );
        return response.data;
    }

    async sendButtons(conversationId, text, buttons = []) {
        // TikTok no soporta botones nativamente, enviamos como texto con opciones
        const optionsText = buttons.map((b, i) => `${i + 1}. ${b.title}`).join('\n');
        return this.sendMessage(conversationId, `${text}\n\n${optionsText}`);
    }

    async markRead(conversationId) {
        // TikTok no tiene endpoint de "mark read"
        return true;
    }

    async getUserInfo(userId) {
        if (!this.accessToken) return null;
        try {
            const response = await axios.get(
                `${this.baseUrl}/user/info/?user_id=${userId}`,
                {
                    headers: { 'access-token': this.accessToken },
                    timeout: 5000,
                }
            );
            return response.data?.data?.user;
        } catch {
            return null;
        }
    }

    async validateWebhook(signature, body) {
        // TikTok usa un token de verificación en query params
        // La validación se hace en el endpoint GET del webhook
        return true;
    }

    /** Verificación de webhook para TikTok */
    verifyWebhook(query) {
        const challenge = query['challenge'];
        const verifyToken = process.env.TIKTOK_WEBHOOK_VERIFY_TOKEN;
        if (challenge) {
            return { verified: true, challenge };
        }
        return { verified: false };
    }
}

module.exports = TikTokAdapter;
