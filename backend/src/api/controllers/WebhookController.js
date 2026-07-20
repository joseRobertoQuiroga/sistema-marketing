class WebhookController {
    constructor({ botQueue, platformConnRepo }) {
        this.botQueue = botQueue;
        this.platformConnRepo = platformConnRepo;
    }

    async receive(req, res) {
        const { type, text, conversationId = 'default', platform = 'telegram', orgId } = req.body;
        let resolvedOrgId = orgId;
        if (!resolvedOrgId && this.platformConnRepo) {
            try {
                const conn = await this.platformConnRepo.findByBotToken(process.env.TELEGRAM_TOKEN);
                if (conn) resolvedOrgId = conn.organization_id;
            } catch {}
        }
        await this.botQueue.add('process_message', {
            type: type || 'text',
            text,
            conversationId,
            orgId: resolvedOrgId,
            platform,
            filePath: req.file ? req.file.path : null,
        });
        res.status(200).json({ message: 'Procesando en background' });
    }
}

module.exports = WebhookController;
