const pino = require('pino');

const logger = pino({
    level: process.env.LOG_LEVEL || (process.env.NODE_ENV === 'production' ? 'info' : 'debug'),
    transport: process.env.NODE_ENV !== 'production'
        ? { target: 'pino-pretty', options: { colorize: true, translateTime: 'HH:MM:ss' } }
        : undefined,
    redact: {
        paths: ['req.headers.authorization', 'req.headers.cookie', 'body.password', 'body.refreshToken'],
        censor: '[REDACTED]',
    },
    serializers: {
        req: (req) => ({
            method: req.method,
            url: req.url,
            headers: { 'user-agent': req.headers?.['user-agent'] },
        }),
        res: (res) => ({
            statusCode: res.statusCode,
        }),
        err: pino.stdSerializers.err,
    },
});

module.exports = logger;
