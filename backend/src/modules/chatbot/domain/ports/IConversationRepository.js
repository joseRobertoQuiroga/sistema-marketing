/**
 * Puerto: Repositorio de Conversaciones
 */
class IConversationRepository {
    async findById(id) { throw new Error('Not implemented'); }
    async findByPlatform(organizationId, platform, platformConversationId) { throw new Error('Not implemented'); }
    async findByOrganization(organizationId, filters) { throw new Error('Not implemented'); }
    async save(conversation) { throw new Error('Not implemented'); }
    async updateStatus(id, status) { throw new Error('Not implemented'); }
}

module.exports = IConversationRepository;
