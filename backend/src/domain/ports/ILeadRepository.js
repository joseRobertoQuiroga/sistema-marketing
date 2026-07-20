class ILeadRepository {
    async save(lead) { throw new Error('Not implemented'); }
    async upsertByConversation(organizationId, conversationId, data) { throw new Error('Not implemented'); }
    async findByOrganization(organizationId, filters) { throw new Error('Not implemented'); }
    async update(organizationId, id, data) { throw new Error('Not implemented'); }
    async delete(organizationId, id) { throw new Error('Not implemented'); }
}

module.exports = ILeadRepository;
