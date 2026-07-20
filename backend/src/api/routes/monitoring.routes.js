const { Router } = require('express');

function createMonitoringRoutes(monitoringController) {
    const router = Router();

    router.get('/overview', (req, res) => monitoringController.overview(req, res));
    router.get('/db', (req, res) => monitoringController.dbHealth(req, res));
    router.get('/modules', (req, res) => monitoringController.modules(req, res));
    router.get('/activity', (req, res) => monitoringController.activity(req, res));

    return router;
}

module.exports = createMonitoringRoutes;
