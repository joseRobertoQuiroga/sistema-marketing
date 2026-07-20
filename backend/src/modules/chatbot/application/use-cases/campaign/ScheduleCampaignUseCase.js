class ScheduleCampaignUseCase {
    constructor({ campaignRepo, log }) {
        this.campaignRepo = campaignRepo;
        this.log = log.child({ useCase: 'ScheduleCampaignUseCase' });
    }

    async execute({ campaignId, scheduledAt }) {
        const log = this.log.child({ campaignId });

        const campaign = await this.campaignRepo.findById(campaignId);
        if (!campaign) {
            throw new Error('Campaña no encontrada');
        }
        if (!campaign.isDraft) {
            throw new Error(`Solo se pueden programar campañas en estado draft (estado actual: ${campaign.status})`);
        }

        const scheduleDate = scheduledAt ? new Date(scheduledAt) : new Date(Date.now() + 3600000);

        campaign.scheduledAt = scheduleDate;
        campaign.status = 'scheduled';

        const saved = await this.campaignRepo.save(campaign);
        log.info('campaña programada', { scheduledAt: scheduleDate.toISOString() });

        return saved;
    }
}

module.exports = ScheduleCampaignUseCase;
