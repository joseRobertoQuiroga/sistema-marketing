const { pool } = require('../../config/db');
const logger = require('../../infrastructure/utils/logger');

let redisClient = null;
try {
    const Redis = require('ioredis');
    redisClient = new Redis(process.env.REDIS_URL || 'redis://localhost:6379', {
        lazyConnect: true,
        maxRetriesPerRequest: 1,
        connectTimeout: 3000,
    });
} catch {}

class HealthController {
    static async check(req, res) {
        const checks = { db: false, redis: false, ollama: false };
        const start = Date.now();

        try {
            await pool.query('SELECT 1');
            checks.db = true;
        } catch (err) {
            logger.error({ err }, 'Health check DB failed');
        }

        if (redisClient) {
            try {
                await redisClient.ping();
                checks.redis = true;
            } catch (err) {
                logger.warn({ err }, 'Health check Redis failed');
            }
        } else {
            checks.redis = null;
        }

        if (process.env.OLLAMA_URL) {
            try {
                const axios = require('axios');
                await axios.post(process.env.OLLAMA_URL, {
                    model: 'mistral:instruct',
                    prompt: 'test',
                    stream: false,
                }, { timeout: 5000 });
                checks.ollama = true;
            } catch (err) {
                logger.warn({ err }, 'Health check Ollama failed');
            }
        } else {
            checks.ollama = null;
        }

        const allEssential = checks.db === true;
        const status = allEssential ? 'ok' : 'degraded';

        res.status(allEssential ? 200 : 503).json({
            status,
            timestamp: new Date().toISOString(),
            uptime: process.uptime(),
            checks,
            responseTime: Date.now() - start,
        });
    }
}

module.exports = HealthController;
