class ConversationController {
    constructor({ messageRepo, processMessageUseCase, platformManager }) {
        this.messageRepo = messageRepo;
        this.processMessageUseCase = processMessageUseCase;
        this.platformManager = platformManager;
    }

    async list(req, res) {
        try {
            const orgId = req.user?.orgId;
            if (!orgId) return res.status(401).json({ error: { code: 'UNAUTHORIZED', message: 'Autenticación requerida' } });
            const conversations = await this.messageRepo.getConversations(orgId);
            res.json(conversations);
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    }

    async messages(req, res) {
        try {
            const { id } = req.params;
            const msgs = await this.messageRepo.findByConversation(id);
            res.json(msgs.map(m => ({
                type: (m.capturedData && m.capturedData.is_admin) ? 'admin' : (m.role === 'user' ? 'user' : 'bot'),
                content: m.content,
                time: m.createdAt,
            })));
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    }

    async reply(req, res) {
        try {
            const { id } = req.params;
            const { text, platform = 'telegram' } = req.body;
            this.processMessageUseCase.setPaused(id, true);
            await this.platformManager.sendMessage(platform, id, text);
            res.json({ success: true, message: 'Mensaje enviado' });
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    }

    async takeControl(req, res) {
        try {
            const { id } = req.params;
            this.processMessageUseCase.setPaused(id, true);
            res.json({ success: true, message: 'Bot pausado' });
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    }
}

module.exports = ConversationController;
