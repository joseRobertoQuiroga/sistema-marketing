/**
 * Entidad Mensaje — Con trazabilidad completa
 */
class ChatMessage {
    constructor({ id, organizationId, conversationId, platform, role, content, contentType, intent, intentScore, capturedData, metadata, traceId, createdAt }) {
        this.id = id;
        this.organizationId = organizationId;
        this.conversationId = conversationId;
        this.platform = platform;
        this.role = role;               // user | assistant | admin | system
        this.content = content;
        this.contentType = contentType || 'text'; // text | image | voice | video | file
        this.intent = intent || null;     // product_inquiry | purchase | complaint | greeting | unknown
        this.intentScore = intentScore || 0;
        this.capturedData = capturedData || {};
        this.metadata = metadata || {};
        this.traceId = traceId || null;
        this.createdAt = createdAt || new Date();
    }

    get isFromUser() { return this.role === 'user'; }
    get isFromBot() { return this.role === 'assistant'; }
    get isFromAdmin() { return this.role === 'admin'; }

    /** Resumen para logging: primeros 80 chars */
    get contentPreview() {
        return this.content ? this.content.slice(0, 80).replace(/\n/g, ' ') : '(empty)';
    }
}

module.exports = ChatMessage;
