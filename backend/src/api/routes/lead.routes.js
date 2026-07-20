const { Router } = require('express');

function createLeadRoutes(leadController) {
    const router = Router();
    router.get('/', (req, res) => leadController.list(req, res));
    router.patch('/:id', (req, res) => leadController.update(req, res));
    router.delete('/:id', (req, res) => leadController.delete(req, res));
    return router;
}

module.exports = createLeadRoutes;
