const { Pool } = require('pg');
const dotenv = require('dotenv');
dotenv.config();

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    max: 20,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 5000,
});

const logger = require('../infrastructure/utils/logger');

pool.on('error', (err) => {
    logger.error({ err }, 'Error inesperado en el pool de PostgreSQL');
});

async function query(text, params) {
    const start = Date.now();
    const result = await pool.query(text, params);
    const duration = Date.now() - start;
    if (process.env.NODE_ENV === 'development' && duration > 100) {
        logger.warn({ duration, query: text.substring(0, 100) }, 'Query lenta');
    }
    return result;
}

async function getClient() {
    const client = await pool.connect();
    return client;
}

module.exports = { pool, query, getClient };
