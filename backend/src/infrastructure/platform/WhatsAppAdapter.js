const IPlatformAdapter = require('../../domain/ports/IPlatformAdapter');
const axios = require('axios');

const logger = require('../../infrastructure/utils/logger');

class WhatsAppAdapter extends IPlatformAdapter {
    get name() { return 'whatsapp'; }

    async sendMessage(conversationId, text) {
        const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
        const token = process.env.META_APP_ID
            ? `${process.env.META_APP_ID}|${process.env.META_APP_SECRET}`
            : null;
        if (!phoneNumberId || !token) {
            logger.warn('WhatsApp no configurado: falta WHATSAPP_PHONE_NUMBER_ID o META_APP_ID/SECRET');
            return false;
        }
        try {
            await axios.post(
                `https://graph.facebook.com/${process.env.META_API_VERSION || 'v21.0'}/${phoneNumberId}/messages`,
                {
                    messaging_product: 'whatsapp',
                    recipient_type: 'individual',
                    to: conversationId,
                    type: 'text',
                    text: { body: text },
                },
                { headers: { Authorization: `Bearer ${token}` } }
            );
            return true;
        } catch (error) {
            logger.error({ err: error }, 'Error enviando a WhatsApp');
            return false;
        }
    }
}

module.exports = WhatsAppAdapter;
