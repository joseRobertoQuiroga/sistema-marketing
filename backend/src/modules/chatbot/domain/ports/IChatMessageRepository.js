/**
 * Puerto: Repositorio de Mensajes del Chatbot
 */
class IChatMessageRepository {
    async save(message) { throw new Error('Not implemented'); }
    async findByConversation(conversationId, limit, offset) { throw new Error('Not implemented'); }
    async findById(id) { throw new Error('Not implemented'); }
    async countByOrganization(organizationId, filters) { throw new Error('Not implemented'); }
    async getPlatformSummary(organizationId) { throw new Error('Not implemented'); }
}

module.exports = IChatMessageRepository;
