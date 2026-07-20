const { Router } = require('express');
const rateLimit = require('express-rate-limit');

function createAuthRoutes(authController) {
    const router = Router();

    const authLimiter = rateLimit({
        windowMs: 15 * 60 * 1000,
        max: 20,
        message: { error: { code: 'RATE_LIMIT', message: 'Demasiados intentos. Intenta de nuevo en 15 minutos.' } },
        standardHeaders: true,
        legacyHeaders: false,
    });

    router.post('/register', authLimiter, (req, res) => authController.handleRegister(req, res));
    router.post('/login', authLimiter, (req, res) => authController.handleLogin(req, res));
    router.post('/refresh', (req, res) => authController.handleRefresh(req, res));
    router.post('/logout', (req, res) => authController.handleLogout(req, res));

    return router;
}

module.exports = createAuthRoutes;
