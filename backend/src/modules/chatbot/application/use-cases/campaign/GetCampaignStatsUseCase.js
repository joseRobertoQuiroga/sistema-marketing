class GetCampaignStatsUseCase {
    constructor({ campaignRepo, log }) {
        this.campaignRepo = campaignRepo;
        this.log = log.child({ useCase: 'GetCampaignStatsUseCase' });
    }

    async execute({ campaignId, organizationId }) {
        const log = this.log.child({ campaignId, orgId: organizationId });

        let campaign = null;
        if (campaignId) {
            campaign = await this.campaignRepo.findById(campaignId);
            if (!campaign) {
                throw new Error('Campaña no encontrada');
            }
        }

        const globalStats = await this.campaignRepo.getStats(organizationId);

        log.info('estadísticas obtenidas', {
            campaignId: campaignId || 'all',
            ...globalStats,
        });

        return {
            global: globalStats,
            campaign: campaign || null,
            messages: campaignId ? await this.campaignRepo.getCampaignMessages(campaignId) : [],
        };
    }
}

module.exports = GetCampaignStatsUseCase;
