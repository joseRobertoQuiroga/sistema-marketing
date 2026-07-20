const crypto = require('crypto');
const logger = require('../../infrastructure/utils/logger');

class MetaWebhookController {
    constructor({ botQueue, platformConnRepo }) {
        this.botQueue = botQueue;
        this.platformConnRepo = platformConnRepo;
    }

    async verify(req, res) {
        const mode = req.query['hub.mode'];
        const token = req.query['hub.verify_token'];
        const challenge = req.query['hub.challenge'];

        if (mode === 'subscribe' && token === process.env.META_WEBHOOK_VERIFY_TOKEN) {
            logger.info('Meta webhook verificado correctamente');
            return res.status(200).send(challenge);
        }
        return res.status(403).send('Verificación fallida');
    }

    async receive(req, res) {
        try {
            const body = req.body;
            if (body.object !== 'whatsapp_business_account') {
                return res.sendStatus(400);
            }

            for (const entry of body.entry || []) {
                for (const change of entry.changes || []) {
                    if (change.field === 'messages') {
                        for (const msg of change.value.messages || []) {
                            const conversationId = msg.from;
                            const text = msg.text?.body || msg.caption || '';
                            const type = msg.type === 'voice' ? 'audio' : 'text';

                            const orgId = change.value.metadata?.phone_number_id
                                ? await this.resolveOrgId(msg.from)
                                : null;

                            if (!orgId) {
                                logger.warn({ conversationId }, 'Meta webhook: no se pudo resolver orgId, mensaje ignorado');
                                continue;
                            }
                            await this.botQueue.add('process_message', {
                                type, text: text || '[media]',
                                conversationId,
                                orgId,
                                platform: 'whatsapp',
                            });
                        }
                    }
                }
            }
            res.sendStatus(200);
        } catch (error) {
            logger.error({ err: error }, 'Error procesando webhook de Meta');
            res.sendStatus(200);
        }
    }

    async resolveOrgId(phoneNumber) {
        try {
            if (this.platformConnRepo) {
                const conn = await this.platformConnRepo.findByBotToken(`whatsapp:${phoneNumber}`);
                if (conn) return conn.organization_id;
            }
        } catch {}
        return null;
    }
}

module.exports = MetaWebhookController;
