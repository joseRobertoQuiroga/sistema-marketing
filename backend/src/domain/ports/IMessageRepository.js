class IMessageRepository {
    async save(message) { throw new Error('Not implemented'); }
    async findByConversation(conversationId, limit) { throw new Error('Not implemented'); }
    async getConversations(organizationId) { throw new Error('Not implemented'); }
}

module.exports = IMessageRepository;
