const { Router } = require('express');
const { authenticate } = require('../middleware/auth');

function createContentRoutes(contentController) {
    const router = Router();

    router.post('/assets/upload', authenticate, (req, res) => contentController.uploadAsset(req, res));
    router.get('/assets', authenticate, (req, res) => contentController.listAssets(req, res));
    router.delete('/assets/:id', authenticate, (req, res) => contentController.deleteAsset(req, res));
    router.post('/posts', authenticate, (req, res) => contentController.createPost(req, res));
    router.get('/posts', authenticate, (req, res) => contentController.listPosts(req, res));

    return router;
}

module.exports = createContentRoutes;
