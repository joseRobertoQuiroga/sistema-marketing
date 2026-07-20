class PlatformManager {
    constructor() {
        this.adapters = {};
    }

    registerAdapter(platformName, adapter) {
        this.adapters[platformName] = adapter;
    }

    async sendMessage(platformName, conversationId, text) {
        const logger = require('../../infrastructure/utils/logger');
        const adapter = this.adapters[platformName] || this.adapters['telegram'];
        if (!adapter) {
            logger.error({ platformName }, 'No adapter found');
            return false;
        }
        return await adapter.sendMessage(conversationId, text);
    }

    getAdapter(platformName) {
        return this.adapters[platformName];
    }

    getRegisteredPlatforms() {
        return Object.keys(this.adapters);
    }
}

module.exports = PlatformManager;
