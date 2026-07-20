class CampaignScheduler {
    constructor({ sendCampaignUseCase, campaignRepo, log }) {
        this.sendCampaign = sendCampaignUseCase;
        this.campaignRepo = campaignRepo;
        this.log = log.child({ service: 'CampaignScheduler' });
        this._interval = null;
        this._running = false;
    }

    start(intervalMs = 30000) {
        if (this._interval) return;
        this.log.info('▶ scheduler iniciado', { intervalMs });

        this._interval = setInterval(async () => {
            if (this._running) return;
            this._running = true;

            try {
                const due = await this.campaignRepo.findDue();
                for (const campaign of due) {
                    this.log.info('enviando campaña programada', {
                        campaignId: campaign.id,
                        name: campaign.name,
                        scheduledAt: campaign.scheduledAt,
                    });
                    try {
                        await this.sendCampaign.execute({ campaignId: campaign.id });
                    } catch (err) {
                        this.log.error('error en campaña programada', {
                            campaignId: campaign.id,
                            err: err.message,
                        });
                    }
                }
            } catch (err) {
                this.log.error('error en ciclo de scheduler', { err: err.message });
            } finally {
                this._running = false;
            }
        }, intervalMs);
    }

    stop() {
        if (this._interval) {
            clearInterval(this._interval);
            this._interval = null;
            this.log.info('⏹ scheduler detenido');
        }
    }
}

module.exports = CampaignScheduler;
