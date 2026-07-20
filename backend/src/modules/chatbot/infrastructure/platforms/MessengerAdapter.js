const axios = require('axios');
const IPlatformAdapter = require('../../domain/ports/IPlatformAdapter');

/**
 * Adaptador para Facebook Messenger (Graph API)
 * 
 * OCP: Implementa IPlatformAdapter — nuevo plugin sin modificar el núcleo
 * Documentación: https://developers.facebook.com/docs/messenger-platform
 * 
 * Config:
 *   MESSENGER_PAGE_ACCESS_TOKEN — Token de página de Facebook
 *   MESSENGER_VERIFY_TOKEN — Token de verificación de webhook
 *   META_API_VERSION — Versión de API (default: v21.0)
 */
class MessengerAdapter extends IPlatformAdapter {
    get name() { return 'messenger'; }
    get category() { return 'messaging'; }

    constructor() {
        super();
        this.pageToken = process.env.MESSENGER_PAGE_ACCESS_TOKEN;
        this.apiVersion = process.env.META_API_VERSION || 'v21.0';
        this.baseUrl = `https://graph.facebook.com/${this.apiVersion}/me`;
    }

    async sendMessage(conversationId, text, options = {}) {
        if (!this.pageToken) throw new Error('Messenger no configurado: falta MESSENGER_PAGE_ACCESS_TOKEN');

        const body = {
            recipient: { id: conversationId },
            message: { text },
            messaging_type: options.messagingType || 'RESPONSE',
        };

        if (options.quickReplies) {
            body.message.quick_replies = options.quickReplies;
        }

        const response = await axios.post(
            `${this.baseUrl}/messages?access_token=${this.pageToken}`,
            body,
            { timeout: 10000 }
        );
        return response.data;
    }

    async sendMedia(conversationId, mediaUrl, type, options = {}) {
        if (!this.pageToken) throw new Error('Messenger no configurado');

        const attachmentType = type === 'video' ? 'video' : type === 'audio' ? 'audio' : 'image';

        const response = await axios.post(
            `${this.baseUrl}/messages?access_token=${this.pageToken}`,
            {
                recipient: { id: conversationId },
                message: {
                    attachment: {
                        type: attachmentType,
                        payload: { url: mediaUrl, is_reusable: true },
                    },
                },
            },
            { timeout: 15000 }
        );
        return response.data;
    }

    async sendButtons(conversationId, text, buttons = []) {
        if (!this.pageToken) throw new Error('Messenger no configurado');

        const response = await axios.post(
            `${this.baseUrl}/messages?access_token=${this.pageToken}`,
            {
                recipient: { id: conversationId },
                message: {
                    attachment: {
                        type: 'template',
                        payload: {
                            template_type: 'button',
                            text,
                            buttons: buttons.map(b => ({
                                type: b.url ? 'web_url' : 'postback',
                                title: b.title,
                                ...(b.url ? { url: b.url } : { payload: b.payload || b.title }),
                            })),
                        },
                    },
                },
            },
            { timeout: 10000 }
        );
        return response.data;
    }

    async markRead(conversationId) {
        if (!this.pageToken) return;
        await axios.post(
            `${this.baseUrl}/messages?access_token=${this.pageToken}`,
            {
                recipient: { id: conversationId },
                sender_action: 'mark_seen',
            },
            { timeout: 5000 }
        );
    }

    async getUserInfo(userId) {
        if (!this.pageToken) return null;
        try {
            const response = await axios.get(
                `https://graph.facebook.com/${this.apiVersion}/${userId}?fields=first_name,last_name,profile_pic,locale&access_token=${this.pageToken}`,
                { timeout: 5000 }
            );
            return response.data;
        } catch {
            return null;
        }
    }

    async validateWebhook(signature, body) {
        const crypto = require('crypto');
        const appSecret = process.env.META_APP_SECRET;
        if (!appSecret || !signature) return false;
        const expectedSignature = crypto
            .createHmac('sha1', appSecret)
            .update(JSON.stringify(body))
            .digest('hex');
        return signature === `sha1=${expectedSignature}`;
    }

    /** Verificación de webhook para Messenger (hub.challenge) */
    verifyWebhook(query) {
        const mode = query['hub.mode'];
        const token = query['hub.verify_token'];
        const challenge = query['hub.challenge'];
        const verifyToken = process.env.MESSENGER_VERIFY_TOKEN || process.env.META_WEBHOOK_VERIFY_TOKEN;

        if (mode === 'subscribe' && token === verifyToken) {
            return { verified: true, challenge: parseInt(challenge, 10) };
        }
        return { verified: false };
    }
}

module.exports = MessengerAdapter;
