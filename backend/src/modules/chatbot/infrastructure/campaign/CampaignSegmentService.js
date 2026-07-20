class CampaignSegmentService {
    constructor({ leadRepo, log }) {
        this.leadRepo = leadRepo;
        this.log = log?.child({ service: 'CampaignSegmentService' });
    }

    async getAudience(organizationId, audienceFilter = {}) {
        const start = Date.now();
        this.log?.info('segmentando audiencia', { organizationId, filter: audienceFilter });

        const result = await this.leadRepo.findByOrganization(organizationId, audienceFilter);
        const leads = result.rows || result;

        const audience = leads
            .filter(lead => lead.conversationId || lead.contactInfo)
            .map(lead => ({
                platformConversationId: lead.conversationId || lead.contactInfo?.phone || String(lead.id),
                platform: lead.source || 'telegram',
                contactName: lead.name || 'Usuario',
                leadId: lead.id,
            }));

        this.log?.info('audiencia segmentada', {
            total: audience.length,
            durationMs: Date.now() - start,
        });

        return audience;
    }
}

module.exports = CampaignSegmentService;
