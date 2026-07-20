/**
 * Puerto: Repositorio de Campañas
 */
class ICampaignRepository {
    async findById(id) { throw new Error('Not implemented'); }
    async findByOrganization(organizationId, filters) { throw new Error('Not implemented'); }
    async save(campaign) { throw new Error('Not implemented'); }
    async updateStatus(id, status, stats) { throw new Error('Not implemented'); }
    async findDue(platform) { throw new Error('Not implemented'); }
}

module.exports = ICampaignRepository;
