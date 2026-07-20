class IPlatformConnectionRepository {
    async findByBotToken(botToken) { throw new Error('Not implemented'); }
    async findByOrganization(organizationId) { throw new Error('Not implemented'); }
    async save(connection) { throw new Error('Not implemented'); }
}

module.exports = IPlatformConnectionRepository;
