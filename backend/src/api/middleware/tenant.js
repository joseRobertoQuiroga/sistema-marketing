const logger = require('../../infrastructure/utils/logger');
const { getClient } = require('../../config/db');

async function tenantContext(req, res, next) {
    if (!req.user || !req.user.orgId) {
        return res.status(401).json({
            error: { code: 'UNAUTHORIZED', message: 'Contexto de organización requerido' }
        });
    }

    let client;
    try {
        client = await getClient();
        await client.query('SET LOCAL app.current_org = $1', [req.user.orgId]);
        req.dbClient = client;
        next();
    } catch (err) {
        if (client) client.release();
        logger.error({ err }, 'Error en tenantContext');
        return res.status(500).json({
            error: { code: 'INTERNAL_ERROR', message: 'Error al establecer contexto de organización' }
        });
    }
}

function releaseDbClient(req, res, next) {
    res.on('finish', () => {
        if (req.dbClient) {
            req.dbClient.release();
        }
    });
    next();
}

module.exports = { tenantContext, releaseDbClient };
