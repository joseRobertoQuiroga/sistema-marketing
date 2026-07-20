const { Router } = require('express');

function createProductRoutes(productController) {
    const router = Router();
    router.get('/', (req, res) => productController.list(req, res));
    return router;
}

module.exports = createProductRoutes;
