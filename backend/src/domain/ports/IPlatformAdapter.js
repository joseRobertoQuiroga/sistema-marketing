class IPlatformAdapter {
    get name() { throw new Error('Not implemented'); }
    async sendMessage(conversationId, text) { throw new Error('Not implemented'); }
}

module.exports = IPlatformAdapter;
