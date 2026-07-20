const jwt = require('jsonwebtoken');

function authenticate(req, res, next) {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({
            error: { code: 'UNAUTHORIZED', message: 'Token de acceso requerido' }
        });
    }

    const token = authHeader.split(' ')[1];
    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        req.user = {
            id: decoded.sub,
            orgId: decoded.org_id,
            orgSlug: decoded.org_slug,
            role: decoded.role,
            plan: decoded.plan,
            trialEndsAt: decoded.trial_ends_at ? new Date(decoded.trial_ends_at) : null,
        };
        next();
    } catch (err) {
        if (err.name === 'TokenExpiredError') {
            return res.status(401).json({
                error: { code: 'SESSION_EXPIRED', message: 'Token expirado. Refresca tu sesión.' }
            });
        }
        return res.status(401).json({
            error: { code: 'UNAUTHORIZED', message: 'Token inválido' }
        });
    }
}

function requireRole(...roles) {
    return (req, res, next) => {
        if (!req.user) {
            return res.status(401).json({
                error: { code: 'UNAUTHORIZED', message: 'Autenticación requerida' }
            });
        }
        if (!roles.includes(req.user.role)) {
            return res.status(403).json({
                error: { code: 'FORBIDDEN', message: `Se requiere rol: ${roles.join(' o ')}` }
            });
        }
        next();
    };
}

module.exports = { authenticate, requireRole };
