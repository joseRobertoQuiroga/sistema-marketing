class PostgresSessionRepository {
    constructor(pool) {
        this.pool = pool;
    }

    async save({ userId, orgId, tokenHash }) {
        await this.pool.query(
            `INSERT INTO sessions (user_id, organization_id, token_hash, expires_at)
             VALUES ($1, $2, $3, NOW() + INTERVAL '7 days')`,
            [userId, orgId, tokenHash]
        );
    }

    async findActiveByHash(hash) {
        const result = await this.pool.query(`
            SELECT s.user_id, s.organization_id, u.name, u.email, m.role,
                   o.name as org_name, o.slug as org_slug, o.plan, o.trial_ends_at
            FROM sessions s
            JOIN users u ON u.id = s.user_id
            JOIN memberships m ON m.user_id = s.user_id AND m.organization_id = s.organization_id
            JOIN organizations o ON o.id = s.organization_id
            WHERE s.token_hash = $1 AND s.revoked_at IS NULL AND s.expires_at > NOW()
        `, [hash]);
        return result.rows[0] || null;
    }

    async revoke(hash) {
        await this.pool.query('UPDATE sessions SET revoked_at = NOW() WHERE token_hash = $1', [hash]);
    }
}

module.exports = PostgresSessionRepository;
