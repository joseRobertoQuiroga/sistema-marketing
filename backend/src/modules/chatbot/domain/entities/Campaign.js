/**
 * Entidad Campaña — Para el modo campañas masivas
 */
class Campaign {
    constructor({ id, organizationId, name, platform, templateId, audienceFilter, scheduledAt, status, stats, createdBy, createdAt, updatedAt }) {
        this.id = id;
        this.organizationId = organizationId;
        this.name = name;
        this.platform = platform || 'all'; // telegram | whatsapp | messenger | tiktok | all
        this.templateId = templateId;
        this.audienceFilter = audienceFilter || {}; // { status: 'new', minScore: 50, productInterest: '...' }
        this.scheduledAt = scheduledAt ? new Date(scheduledAt) : null;
        this.status = status || 'draft'; // draft | scheduled | sending | completed | cancelled | failed
        this.stats = stats || { total: 0, sent: 0, delivered: 0, read: 0, replied: 0, failed: 0 };
        this.createdBy = createdBy;
        this.createdAt = createdAt || new Date();
        this.updatedAt = updatedAt || new Date();
    }

    get isDraft() { return this.status === 'draft'; }
    get isScheduled() { return this.status === 'scheduled'; }
    get isSending() { return this.status === 'sending'; }
    get isCompleted() { return this.status === 'completed'; }
    get progress() {
        if (this.stats.total === 0) return 0;
        return Math.round((this.stats.sent / this.stats.total) * 100);
    }
}

module.exports = Campaign;
