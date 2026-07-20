const IPlatformAdapter = require('../../domain/ports/IPlatformAdapter');

class TelegramAdapter extends IPlatformAdapter {
    get name() { return 'telegram'; }

    async sendMessage(conversationId, text) {
        const { Telegraf } = require('telegraf');
        const logger = require('../../infrastructure/utils/logger');
        if (process.env.TELEGRAM_TOKEN) {
            try {
                const bot = new Telegraf(process.env.TELEGRAM_TOKEN);
                await bot.telegram.sendMessage(conversationId, text);
                return true;
            } catch (error) {
                logger.error({ err: error }, 'Error enviando a Telegram');
                return false;
            }
        }
        return true;
    }
}

module.exports = TelegramAdapter;
