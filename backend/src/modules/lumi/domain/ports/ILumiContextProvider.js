class ILumiContextProvider {
    async getSalesSummary(organizationId, period) { throw new Error('Not implemented'); }
    async getProductStats(organizationId) { throw new Error('Not implemented'); }
    async getCustomerStats(organizationId) { throw new Error('Not implemented'); }
    async getCampaignSummary(organizationId) { throw new Error('Not implemented'); }
    async getFullContext(organizationId) { throw new Error('Not implemented'); }
}

module.exports = ILumiContextProvider;
