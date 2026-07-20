class CancelCampaignUseCase {
    constructor({ campaignRepo, log }) {
        this.campaignRepo = campaignRepo;
        this.log = log.child({ useCase: 'CancelCampaignUseCase' });
    }

    async execute({ campaignId }) {
        const log = this.log.child({ campaignId });

        const campaign = await this.campaignRepo.findById(campaignId);
        if (!campaign) {
            throw new Error('Campaña no encontrada');
        }

        if (campaign.isCompleted || campaign.isDraft) {
            throw new Error(`No se puede cancelar una campaña en estado ${campaign.status}`);
        }

        const saved = await this.campaignRepo.updateStatus(campaignId, 'cancelled');
        log.info('campaña cancelada', { previousStatus: campaign.status });

        return saved;
    }
}

module.exports = CancelCampaignUseCase;
