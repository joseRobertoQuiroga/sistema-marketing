class PlatformManager {
    static adapters = {};

    static registerAdapter(platformName, adapter) {
        this.adapters[platformName] = adapter;
    }

    static async sendMessage(platformName, conversationId, text) {
        const adapter = this.adapters[platformName] || this.adapters['telegram'];
        if (!adapter) {
            console.error(`❌ No adapter found for platform: ${platformName}`);
            return false;
        }
        return await adapter.sendMessage(conversationId, text);
    }
}

class TelegramAdapter {
    static async sendMessage(conversationId, text) {
        const { Telegraf } = require('telegraf');
        console.log(`📤 [TELEGRAM RESPONSE] Intentando enviar a ${conversationId}: "${text}"`);
        
        if (process.env.TELEGRAM_TOKEN) {
            try {
                const bot = new Telegraf(process.env.TELEGRAM_TOKEN);
                // Telegram requiere el ID como número o string con formato específico,
                // forzamos a número si parece un ID de chat.
                const targetId = isNaN(conversationId) ? conversationId : parseInt(conversationId);
                await bot.telegram.sendMessage(targetId, text);
                console.log(`✅ [TELEGRAM SUCCESS] Mensaje enviado a ${targetId}`);
                return true;
            } catch (error) {
                console.error('❌ Error enviando a Telegram:', error.message);
                return false;
            }
        } else {
            console.warn('⚠️ No hay TELEGRAM_TOKEN, simulando envío (Manual Mode)');
        }
        return true;
    }
}

// Registro inicial de adaptadores
PlatformManager.registerAdapter('telegram', TelegramAdapter);

module.exports = PlatformManager;
