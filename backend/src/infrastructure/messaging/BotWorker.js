const { Worker } = require('bullmq');
const logger = require('../../infrastructure/utils/logger');

class BotWorker {
    constructor({ queue, processMessageUseCase, platformManager }) {
        this.worker = new Worker('bot-messages', async (job) => {
            const { type, text, conversationId, orgId, filePath, platform } = job.data;
            try {
                const result = await processMessageUseCase.execute({ type, text, conversationId, orgId, filePath, platform });
                if (result) {
                    await platformManager.sendMessage(platform || 'telegram', conversationId, result.response_text);
                }
            } catch (error) {
                logger.error({ err: error, jobId: job.id }, 'Error en worker');
            }
        }, {
            connection: {
                host: process.env.REDIS_HOST || 'redis',
                port: process.env.REDIS_PORT || 6379,
            },
        });

        logger.info('BotWorker iniciado y esperando tareas...');
    }
}

module.exports = BotWorker;
