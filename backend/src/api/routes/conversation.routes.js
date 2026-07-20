const { Router } = require('express');

function createConversationRoutes(conversationController) {
    const router = Router();

    router.get('/', (req, res) => conversationController.list(req, res));
    router.get('/:id/messages', (req, res) => conversationController.messages(req, res));
    router.post('/:id/reply', (req, res) => conversationController.reply(req, res));
    router.post('/:id/take-control', (req, res) => conversationController.takeControl(req, res));

    return router;
}

module.exports = createConversationRoutes;
