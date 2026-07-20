const { Router } = require('express');

function createLumiRoutes(lumiController) {
    const router = Router();

    router.post('/query', (req, res) => lumiController.query(req, res));
    router.post('/action', (req, res) => lumiController.action(req, res));
    router.get('/context', (req, res) => lumiController.context(req, res));
    router.get('/health', (req, res) => lumiController.health(req, res));

    return router;
}

module.exports = createLumiRoutes;
