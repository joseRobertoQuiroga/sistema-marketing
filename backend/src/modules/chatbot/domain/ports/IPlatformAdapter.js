/**
 * Puerto: Adaptador de Plataforma — Interfaz completa para plugins
 * ISP: Segregada en interfaces pequeñas
 * OCP: Nuevas plataformas implementan esta interfaz sin modificar el núcleo
 */
class IPlatformAdapter {
    /** Nombre único de la plataforma (telegram, whatsapp, messenger, tiktok) */
    get name() { throw new Error('Not implemented'); }

    /** Enviar mensaje de texto */
    async sendMessage(conversationId, text, options) { throw new Error('Not implemented'); }

    /** Enviar mensaje con medios (imagen, video, audio) */
    async sendMedia(conversationId, mediaUrl, type, options) { throw new Error('Not implemented'); }

    /** Enviar botones interactivos */
    async sendButtons(conversationId, text, buttons) { throw new Error('Not implemented'); }

    /** Marcar mensaje como leído */
    async markRead(conversationId) { throw new Error('Not implemented'); }

    /** Obtener información del usuario en la plataforma */
    async getUserInfo(userId) { throw new Error('Not implemented'); }

    /** Validar firma de webhook entrante */
    async validateWebhook(signature, body) { throw new Error('Not implemented'); }

    /** Tipo de plataforma: 'messaging' | 'social' | 'custom' */
    get category() { return 'messaging'; }
}

module.exports = IPlatformAdapter;
