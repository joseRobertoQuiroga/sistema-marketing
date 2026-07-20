const Campaign = require('../../../domain/entities/Campaign');

class CreateCampaignUseCase {
    constructor({ campaignRepo, log }) {
        this.campaignRepo = campaignRepo;
        this.log = log.child({ useCase: 'CreateCampaignUseCase' });
    }

    async execute({ organizationId, name, platform, templateId, audienceFilter, scheduledAt, createdBy }) {
        const log = this.log.child({ orgId: organizationId });

        if (!name || !name.trim()) {
            throw new Error('El nombre de la campaña es obligatorio');
        }

        const campaign = new Campaign({
            organizationId,
            name: name.trim(),
            platform: platform || 'all',
            templateId,
            audienceFilter: audienceFilter || {},
            scheduledAt: scheduledAt || null,
            status: 'draft',
            createdBy,
        });

        const saved = await this.campaignRepo.save(campaign);
        log.info('campaña creada', { campaignId: saved.id, name: saved.name });

        return saved;
    }
}

module.exports = CreateCampaignUseCase;
