class Message {
    constructor({ id, organizationId, conversationId, role, content, intentScore, capturedData, createdAt }) {
        this.id = id;
        this.organizationId = organizationId;
        this.conversationId = conversationId;
        this.role = role; // 'user' | 'assistant' | 'admin'
        this.content = content;
        this.intentScore = intentScore || 0;
        this.capturedData = capturedData || {};
        this.createdAt = createdAt || new Date();
    }
}

module.exports = Message;
