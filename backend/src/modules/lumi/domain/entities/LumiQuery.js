class LumiQuery {
    constructor({ id, organizationId, text, context, intent, createdAt }) {
        this.id = id;
        this.organizationId = organizationId;
        this.text = text;
        this.context = context || {};
        this.intent = intent || 'unknown';
        this.createdAt = createdAt || new Date();
    }
}

module.exports = LumiQuery;
