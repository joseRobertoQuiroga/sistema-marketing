class SendCampaignUseCase {
    constructor({ campaignRepo, segmentService, platformFactory, platformManager, log }) {
        this.campaignRepo = campaignRepo;
        this.segmentService = segmentService;
        this.platformFactory = platformFactory;
        this.platformManager = platformManager;
        this.log = log.child({ useCase: 'SendCampaignUseCase' });
    }

    async execute({ campaignId }) {
        const log = this.log.child({ campaignId });
        log.info('▶ iniciando envío de campaña');

        const campaign = await this.campaignRepo.findById(campaignId);
        if (!campaign) {
            throw new Error('Campaña no encontrada');
        }

        if (!campaign.isScheduled && !campaign.isDraft) {
            throw new Error(`Estado inválido para envío: ${campaign.status}`);
        }

        await this.campaignRepo.updateStatus(campaignId, 'sending');

        try {
            const audience = await this.segmentService.getAudience(
                campaign.organizationId,
                campaign.audienceFilter
            );

            if (audience.length === 0) {
                log.warn('audiencia vacía — cancelando campaña');
                await this.campaignRepo.updateStatus(campaignId, 'completed', {
                    total: 0, sent: 0, delivered: 0, read: 0, replied: 0, failed: 0,
                });
                return { sent: 0, failed: 0, total: 0 };
            }

            log.info('enviando mensajes', { total: audience.length });

            let sent = 0;
            let failed = 0;

            for (const member of audience) {
                try {
                    const targetPlatform = campaign.platform === 'all' ? member.platform : campaign.platform;

                    await this.platformManager.sendMessage(targetPlatform, member.platformConversationId, campaign.templateId || '');

                    await this.campaignRepo.saveCampaignMessage({
                        campaignId,
                        organizationId: campaign.organizationId,
                        platformConversationId: member.platformConversationId,
                        platform: targetPlatform,
                        content: campaign.templateId || '',
                        status: 'sent',
                        metadata: { contactName: member.contactName, leadId: member.leadId },
                    });
                    sent++;
                } catch (err) {
                    failed++;
                    await this.campaignRepo.saveCampaignMessage({
                        campaignId,
                        organizationId: campaign.organizationId,
                        platformConversationId: member.platformConversationId,
                        platform: member.platform,
                        content: campaign.templateId || '',
                        status: 'failed',
                        metadata: { error: err.message, contactName: member.contactName },
                    });
                }
            }

            const stats = {
                total: audience.length,
                sent,
                delivered: 0,
                read: 0,
                replied: 0,
                failed,
            };

            await this.campaignRepo.updateStatus(campaignId, 'completed', stats);

            log.info('✅ campaña completada', stats);
            return stats;
        } catch (err) {
            log.error('❌ error enviando campaña', { err: err.message });
            await this.campaignRepo.updateStatus(campaignId, 'failed');
            throw err;
        }
    }
}

module.exports = SendCampaignUseCase;
