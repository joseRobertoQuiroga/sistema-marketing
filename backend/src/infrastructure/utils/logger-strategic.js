const pino = require('pino');

/**
 * Logger Estratégico — Sistema de trazabilidad completa
 *
 * Niveles: error (50), warn (40), info (30), debug (20), trace (10)
 * 
 * Uso:
 *   const log = require('./logger-strategic')({ 
 *     orgId: 'org-123', conversationId: 'conv-456', platform: 'telegram' 
 *   });
 *   log.info('mensaje procesado', { intentScore: 0.85, durationMs: 450 });
 *
 * Cada log incluye automáticamente: traceId, timestamp, servicio, y contexto
 */
const LOG_LEVELS = { error: 50, warn: 40, info: 30, debug: 20, trace: 10 };

class StrategicLogger {
    constructor(baseContext = {}) {
        this.baseLogger = pino({
            level: process.env.LOG_LEVEL || (process.env.NODE_ENV === 'production' ? 'info' : 'debug'),
            transport: process.env.NODE_ENV !== 'production'
                ? { target: 'pino-pretty', options: { colorize: true, translateTime: 'HH:MM:ss:l' } }
                : undefined,
            redact: {
                paths: [
                    'req.headers.authorization', 'req.headers.cookie',
                    'body.password', 'body.refreshToken', 'body.accessToken',
                    '*.bot_token', '*.token', '*.secret',
                ],
                censor: '[REDACTED]'
            },
            serializers: {
                err: pino.stdSerializers.err,
            },
        });
        this.baseContext = baseContext;
        this._childCache = new Map();
    }

    /**
     * Crea un logger hijo con contexto adicional
     * @param {Object} ctx - { orgId?, conversationId?, platform?, traceId?, useCase? }
     */
    child(ctx = {}) {
        const traceId = ctx.traceId || crypto.randomUUID().slice(0, 8);
        const merged = { ...this.baseContext, ...ctx, traceId: ctx.traceId || traceId };
        const key = JSON.stringify(merged);
        if (this._childCache.has(key)) return this._childCache.get(key);
        const child = new ChildLogger(this.baseLogger, merged);
        this._childCache.set(key, child);
        return child;
    }
}

class ChildLogger {
    constructor(baseLogger, context) {
        this._logger = baseLogger;
        this._ctx = context;
    }

    _emit(level, msg, extra = {}) {
        const entry = {
            ...this._ctx,
            ...extra,
            ts: new Date().toISOString(),
        };
        // Limpiar undefineds
        Object.keys(entry).forEach(k => entry[k] === undefined && delete entry[k]);
        this._logger[level](entry, msg);
    }

    error(msg, extra = {}) { this._emit('error', msg, extra); }
    warn(msg, extra = {})  { this._emit('warn', msg, extra); }
    info(msg, extra = {})  { this._emit('info', msg, extra); }
    debug(msg, extra = {}) { this._emit('debug', msg, extra); }
    trace(msg, extra = {}) { this._emit('trace', msg, extra); }

    /** Mide tiempo de ejecución de una función async */
    async timed(name, fn, extra = {}) {
        const start = Date.now();
        try {
            const result = await fn();
            this.info(`${name} OK`, { ...extra, durationMs: Date.now() - start, status: 'success' });
            return result;
        } catch (err) {
            this.error(`${name} FAIL`, { ...extra, durationMs: Date.now() - start, status: 'error', err: err.message });
            throw err;
        }
    }

    /** Crea un child con contexto adicional */
    child(ctx = {}) {
        const merged = { ...this._ctx, ...ctx };
        return new ChildLogger(this._logger, merged);
    }
}

const crypto = require('crypto');
const rootLogger = new StrategicLogger({ service: 'omnipresence' });

module.exports = rootLogger;
