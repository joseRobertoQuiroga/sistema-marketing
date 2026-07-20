const { Queue } = require('bullmq');
const Redis = require('ioredis');

class BotQueue {
    constructor(redisUrl) {
        this.connection = new Redis(redisUrl || process.env.REDIS_URL || 'redis://localhost:6379');
        this.queue = new Queue('bot-messages', {
            connection: this.connection,
            defaultJobOptions: {
                attempts: 3,
                backoff: { type: 'exponential', delay: 5000 },
                removeOnComplete: true,
                removeOnFail: 1000,
            },
        });
    }

    async add(type, data) {
        return await this.queue.add(type, data);
    }

    getQueue() {
        return this.queue;
    }

    async close() {
        await this.queue.close();
        await this.connection.quit();
    }
}

module.exports = BotQueue;
