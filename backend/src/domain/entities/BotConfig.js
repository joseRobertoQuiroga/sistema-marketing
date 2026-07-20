class BotConfig {
    constructor({ id, organizationId, businessName, tone, escalationMessage, welcomeMessage, updatedAt }) {
        this.id = id;
        this.organizationId = organizationId;
        this.businessName = businessName || 'OmniPresence';
        this.tone = tone || 'profesional';
        this.escalationMessage = escalationMessage || 'Lo siento, no puedo ayudarte con eso.';
        this.welcomeMessage = welcomeMessage || '¡Hola! Soy el asistente virtual. ¿En qué puedo ayudarte?';
        this.updatedAt = updatedAt || new Date();
    }
}

module.exports = BotConfig;
