const IProductRepository = require('../../domain/ports/IProductRepository');

class PostgresProductRepository extends IProductRepository {
    constructor(pool) {
        super();
        this.pool = pool;
    }

    async findByOrganization(organizationId) {
        const result = await this.pool.query(
            'SELECT * FROM products WHERE organization_id = $1 AND is_active = true ORDER BY created_at DESC',
            [organizationId]
        );
        return result.rows;
    }
}

module.exports = PostgresProductRepository;
