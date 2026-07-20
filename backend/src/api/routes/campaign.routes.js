const { Router } = require('express');

function createCampaignRoutes(campaignController) {
    const router = Router();

    router.get('/', (req, res) => campaignController.list(req, res));
    router.get('/stats', (req, res) => campaignController.stats(req, res));
    router.post('/audience-preview', (req, res) => campaignController.audiencePreview(req, res));
    router.get('/:id', (req, res) => campaignController.getById(req, res));
    router.post('/', (req, res) => campaignController.create(req, res));
    router.post('/:id/schedule', (req, res) => campaignController.schedule(req, res));
    router.post('/:id/send', (req, res) => campaignController.sendNow(req, res));
    router.post('/:id/cancel', (req, res) => campaignController.cancel(req, res));

    return router;
}

module.exports = createCampaignRoutes;
