class Lead {
    constructor({ id, organizationId, conversationId, name, contactInfo, source, status, score, capturedData, notes, createdAt, updatedAt }) {
        this.id = id;
        this.organizationId = organizationId;
        this.conversationId = conversationId;
        this.name = name || 'Usuario';
        this.contactInfo = contactInfo || {};
        this.source = source || 'telegram';
        this.status = status || 'new'; // 'new' | 'contacted' | 'qualified' | 'converted' | 'lost'
        this.score = score || 0;
        this.capturedData = capturedData || {};
        this.notes = notes || null;
        this.createdAt = createdAt || new Date();
        this.updatedAt = updatedAt || new Date();
    }

    get kpiCategory() {
        if (this.score >= 80) return 'Conversión';
        if (this.score >= 50) return 'Interés';
        return 'Consultas';
    }
}

module.exports = Lead;
