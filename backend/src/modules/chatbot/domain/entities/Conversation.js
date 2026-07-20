/**
 * Entidad Conversación — Núcleo del módulo chatbot
 * Value Object: inmmutable, se compara por valor
 */
class Conversation {
    constructor({ id, organizationId, platform, platformConversationId, contactName, contactInfo, status, metadata, createdAt, updatedAt }) {
        this.id = id;
        this.organizationId = organizationId;
        this.platform = platform;
        this.platformConversationId = platformConversationId;
        this.contactName = contactName || 'Usuario';
        this.contactInfo = contactInfo || {};
        this.status = status || 'active'; // active | paused | closed | escalated
        this.metadata = metadata || {};
        this.createdAt = createdAt || new Date();
        this.updatedAt = updatedAt || new Date();
    }

    get isActive() { return this.status === 'active'; }
    get isPaused() { return this.status === 'paused'; }
    get isEscalated() { return this.status === 'escalated'; }
}

module.exports = Conversation;
