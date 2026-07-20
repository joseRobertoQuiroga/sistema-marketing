const logger = require('../../infrastructure/utils/logger-strategic');

class CampaignController {
    constructor({ createCampaign, scheduleCampaign, sendCampaign, cancelCampaign, getCampaignStats, campaignRepo, leadRepo }) {
        this.createCampaign = createCampaign;
        this.scheduleCampaign = scheduleCampaign;
        this.sendCampaign = sendCampaign;
        this.cancelCampaign = cancelCampaign;
        this.getCampaignStats = getCampaignStats;
        this.campaignRepo = campaignRepo;
        this.leadRepo = leadRepo;
        this.log = logger.child({ controller: 'CampaignController' });
    }

    async list(req, res) {
        try {
            const orgId = req.user?.orgId;
            if (!orgId) return res.status(401).json({ error: 'Autenticación requerida' });

            const { status, platform, limit, offset } = req.query;
            const campaigns = await this.campaignRepo.findByOrganization(orgId, { status, platform, limit, offset });

            res.json(campaigns);
        } catch (err) {
            this.log.error('error listando campañas', { err: err.message });
            res.status(500).json({ error: err.message });
        }
    }

    async getById(req, res) {
        try {
            const { id } = req.params;
            const campaign = await this.campaignRepo.findById(id);
            if (!campaign) return res.status(404).json({ error: 'Campaña no encontrada' });

            const messages = await this.campaignRepo.getCampaignMessages(id);
            res.json({ campaign, messages });
        } catch (err) {
            this.log.error('error obteniendo campaña', { err: err.message });
            res.status(500).json({ error: err.message });
        }
    }

    async create(req, res) {
        try {
            const orgId = req.user?.orgId;
            if (!orgId) return res.status(401).json({ error: 'Autenticación requerida' });

            const { name, platform, templateId, audienceFilter, scheduledAt } = req.body;
            const campaign = await this.createCampaign.execute({
                organizationId: orgId,
                name, platform, templateId, audienceFilter, scheduledAt,
                createdBy: req.user.id,
            });

            res.status(201).json(campaign);
        } catch (err) {
            this.log.error('error creando campaña', { err: err.message });
            res.status(400).json({ error: err.message });
        }
    }

    async schedule(req, res) {
        try {
            const { id } = req.params;
            const { scheduledAt } = req.body;

            const campaign = await this.scheduleCampaign.execute({ campaignId: id, scheduledAt });
            res.json(campaign);
        } catch (err) {
            this.log.error('error programando campaña', { err: err.message });
            res.status(400).json({ error: err.message });
        }
    }

    async sendNow(req, res) {
        try {
            const { id } = req.params;
            const stats = await this.sendCampaign.execute({ campaignId: id });
            res.json({ success: true, stats });
        } catch (err) {
            this.log.error('error enviando campaña', { err: err.message });
            res.status(400).json({ error: err.message });
        }
    }

    async cancel(req, res) {
        try {
            const { id } = req.params;
            const campaign = await this.cancelCampaign.execute({ campaignId: id });
            res.json(campaign);
        } catch (err) {
            this.log.error('error cancelando campaña', { err: err.message });
            res.status(400).json({ error: err.message });
        }
    }

    async stats(req, res) {
        try {
            const orgId = req.user?.orgId;
            if (!orgId) return res.status(401).json({ error: 'Autenticación requerida' });

            const { campaignId } = req.query;
            const result = await this.getCampaignStats.execute({ campaignId, organizationId: orgId });

            res.json(result);
        } catch (err) {
            this.log.error('error obteniendo estadísticas', { err: err.message });
            res.status(500).json({ error: err.message });
        }
    }

    async audiencePreview(req, res) {
        try {
            const orgId = req.user?.orgId;
            if (!orgId) return res.status(401).json({ error: 'Autenticación requerida' });

            const { audienceFilter } = req.body;
            const leads = await this.leadRepo.findByOrganization(orgId, audienceFilter || {});
            res.json({ total: leads.length, preview: leads.slice(0, 20) });
        } catch (err) {
            this.log.error('error previsualizando audiencia', { err: err.message });
            res.status(500).json({ error: err.message });
        }
    }
}

module.exports = CampaignController;
