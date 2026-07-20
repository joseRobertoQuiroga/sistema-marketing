const { Router } = require('express');
const { authenticate } = require('../middleware/auth');

function createAnalyticsRoutes(analyticsController) {
    const router = Router();

    router.get('/overview', authenticate, (req, res) => analyticsController.overview(req, res));
    router.get('/meta/connect', authenticate, (req, res) => analyticsController.connectMeta(req, res));
    router.get('/meta/callback', (req, res) => analyticsController.metaCallback(req, res));

    return router;
}

module.exports = createAnalyticsRoutes;
