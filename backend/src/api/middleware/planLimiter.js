const logger = require('../../infrastructure/utils/logger');

const PLAN_LIMITS = {
    free: { messagesPerMonth: 500, platforms: 1, products: 10, teamMembers: 1 },
    pro: { messagesPerMonth: 5000, platforms: 2, products: 50, teamMembers: 5 },
    business: { messagesPerMonth: 50000, platforms: 5, products: 200, teamMembers: 15 },
    agency: { messagesPerMonth: -1, platforms: 10, products: -1, teamMembers: -1 },
};

function planLimiter(resource) {
    return async (req, res, next) => {
        try {
            if (!req.user?.plan) return next();

            const plan = req.user.plan;
            const limits = PLAN_LIMITS[plan];

            if (!limits) return next();

            if (limits[resource] === -1) return next();

            if (resource === 'platforms') {
                const { pool } = require('../config/db');
                const result = await pool.query(
                    'SELECT COUNT(*) FROM platform_connections WHERE organization_id = $1 AND is_active = true',
                    [req.user.orgId]
                );
                const current = parseInt(result.rows[0].count);
                if (current >= limits[resource]) {
                    return res.status(403).json({
                        error: { code: 'PLAN_LIMIT', message: `Límite de ${resource} (${limits[resource]}) alcanzado. Actualiza tu plan.` }
                    });
                }
            }

            if (resource === 'products') {
                const { pool } = require('../config/db');
                const result = await pool.query(
                    'SELECT COUNT(*) FROM products WHERE organization_id = $1 AND is_active = true',
                    [req.user.orgId]
                );
                const current = parseInt(result.rows[0].count);
                if (current >= limits[resource]) {
                    return res.status(403).json({
                        error: { code: 'PLAN_LIMIT', message: `Límite de ${resource} (${limits[resource]}) alcanzado. Actualiza tu plan.` }
                    });
                }
            }

            next();
        } catch (error) {
            logger.error({ err: error }, 'Plan limiter error');
            next();
        }
    };
}

module.exports = { planLimiter, PLAN_LIMITS };
