class PostgresUserRepository {
    constructor(pool) {
        this.pool = pool;
    }

    async findByEmail(email) {
        const result = await this.pool.query('SELECT * FROM users WHERE email = $1', [email]);
        return result.rows[0] || null;
    }

    async findById(id) {
        const result = await this.pool.query('SELECT * FROM users WHERE id = $1', [id]);
        return result.rows[0] || null;
    }

    async findWithOrg(email) {
        const result = await this.pool.query(`
            SELECT u.id, u.email, u.name, u.password_hash, m.role, m.organization_id,
                   o.name as org_name, o.slug as org_slug, o.plan, o.trial_ends_at, o.onboarding_step
            FROM users u
            JOIN memberships m ON m.user_id = u.id
            JOIN organizations o ON o.id = m.organization_id
            WHERE u.email = $1
        `, [email]);
        if (!result.rows[0]) return null;
        const r = result.rows[0];
        return {
            id: r.id, email: r.email, name: r.name, passwordHash: r.password_hash,
            role: r.role, organizationId: r.organization_id, orgName: r.org_name,
            orgSlug: r.org_slug, plan: r.plan, trialEndsAt: r.trial_ends_at,
            onboardingStep: r.onboarding_step,
        };
    }

    async save(user) {
        const result = await this.pool.query(
            `INSERT INTO users (email, password_hash, name) VALUES ($1, $2, $3) RETURNING id, email, name, created_at`,
            [user.email, user.passwordHash, user.name]
        );
        return result.rows[0];
    }
}

module.exports = PostgresUserRepository;
