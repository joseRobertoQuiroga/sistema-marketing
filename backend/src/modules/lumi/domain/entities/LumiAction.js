class LumiAction {
    constructor({ id, organizationId, type, params, status, result, error, createdBy, createdAt, completedAt }) {
        this.id = id;
        this.organizationId = organizationId;
        this.type = type; // 'generate_content' | 'bulk_products' | 'recommend'
        this.params = params || {};
        this.status = status || 'pending'; // pending | running | completed | failed
        this.result = result || null;
        this.error = error || null;
        this.createdBy = createdBy;
        this.createdAt = createdAt || new Date();
        this.completedAt = completedAt || null;
    }

    get isRunning() { return this.status === 'running'; }
    get isCompleted() { return this.status === 'completed'; }
    get isFailed() { return this.status === 'failed'; }
}

module.exports = LumiAction;
