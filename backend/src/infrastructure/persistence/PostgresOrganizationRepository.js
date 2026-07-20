class PostgresOrganizationRepository {
    constructor(pool) {
        this.pool = pool;
    }

    async save(org) {
        const result = await this.pool.query(
            `INSERT INTO organizations (name, slug, plan, trial_ends_at, settings, onboarding_step)
             VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
            [org.name, org.slug, org.plan, org.trialEndsAt, JSON.stringify(org.settings), org.onboardingStep]
        );
        return this._mapRow(result.rows[0]);
    }

    async findById(id) {
        const result = await this.pool.query('SELECT * FROM organizations WHERE id = $1', [id]);
        return result.rows[0] ? this._mapRow(result.rows[0]) : null;
    }

    async addMember(userId, orgId, role) {
        await this.pool.query(
            'INSERT INTO memberships (user_id, organization_id, role) VALUES ($1, $2, $3)',
            [userId, orgId, role]
        );
    }

    _mapRow(r) {
        return {
            id: r.id,
            name: r.name,
            slug: r.slug,
            plan: r.plan || 'free',
            settings: r.settings || {},
            trialEndsAt: r.trial_ends_at ? new Date(r.trial_ends_at) : null,
            onboardingStep: r.onboarding_step || 0,
            stripeCustomerId: r.stripe_customer_id || null,
            billingEmail: r.billing_email || null,
            createdAt: r.created_at || new Date(),
        };
    }
}

module.exports = PostgresOrganizationRepository;
