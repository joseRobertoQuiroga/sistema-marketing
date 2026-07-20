const ILeadRepository = require('../../domain/ports/ILeadRepository');
const Lead = require('../../domain/entities/Lead');

class PostgresLeadRepository extends ILeadRepository {
    constructor(pool) {
        super();
        this.pool = pool;
    }

    async save(lead) {
        const result = await this.pool.query(
            `INSERT INTO leads (organization_id, conversation_id, name, contact_info, source, status, score, captured_data)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
            [lead.organizationId, lead.conversationId, lead.name, JSON.stringify(lead.contactInfo),
             lead.source, lead.status, lead.score, JSON.stringify(lead.capturedData)]
        );
        return result.rows[0];
    }

    async upsertByConversation(organizationId, conversationId, data) {
        const result = await this.pool.query(`
            INSERT INTO leads (organization_id, conversation_id, name, contact_info, source, status, score, captured_data)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
            ON CONFLICT (organization_id, conversation_id) DO UPDATE SET
                name = EXCLUDED.name,
                contact_info = COALESCE(leads.contact_info || EXCLUDED.contact_info, EXCLUDED.contact_info),
                source = EXCLUDED.source,
                status = CASE WHEN EXCLUDED.score > leads.score THEN EXCLUDED.status ELSE leads.status END,
                score = EXCLUDED.score,
                captured_data = COALESCE(leads.captured_data || EXCLUDED.captured_data, EXCLUDED.captured_data),
                updated_at = NOW()
            RETURNING *
        `, [organizationId, conversationId, data.name, JSON.stringify(data.contactInfo || {}),
            data.source, data.status, data.score, JSON.stringify(data.capturedData || {})]);
        return result.rows[0];
    }

    async findByOrganization(organizationId, filters = {}) {
        const conditions = ['organization_id = $1'];
        const values = [organizationId];
        let idx = 2;

        if (filters.status) {
            conditions.push(`status = $${idx++}`);
            values.push(filters.status);
        }
        if (filters.source) {
            conditions.push(`source = $${idx++}`);
            values.push(filters.source);
        }

        const page = filters.page || 1;
        const limit = Math.min(filters.limit || 50, 100);
        const offset = (page - 1) * limit;

        const countResult = await this.pool.query(
            `SELECT COUNT(*) FROM leads WHERE ${conditions.join(' AND ')}`, values
        );
        const total = parseInt(countResult.rows[0].count);

        conditions.push(`ORDER BY updated_at DESC LIMIT $${idx++} OFFSET $${idx++}`);
        values.push(limit, offset);

        const result = await this.pool.query(
            `SELECT * FROM leads WHERE ${conditions.join(' AND ')}`, values
        );
        return {
            rows: result.rows.map(r => new Lead({
                id: r.id, organizationId: r.organization_id, conversationId: r.conversation_id,
                name: r.name, contactInfo: r.contact_info, source: r.source, status: r.status,
                score: r.score, capturedData: r.captured_data, notes: r.notes,
                createdAt: r.created_at, updatedAt: r.updated_at,
            })),
            total, page, limit,
        };
    }

    async update(organizationId, id, data) {
        const sets = [];
        const values = [];
        let idx = 1;

        if (data.status !== undefined) { sets.push(`status = $${idx++}`); values.push(data.status); }
        if (data.name !== undefined) { sets.push(`name = $${idx++}`); values.push(data.name); }
        if (data.notes !== undefined) { sets.push(`notes = $${idx++}`); values.push(data.notes); }

        if (sets.length === 0) return null;

        sets.push('updated_at = NOW()');
        values.push(organizationId, id);

        const result = await this.pool.query(
            `UPDATE leads SET ${sets.join(', ')} WHERE organization_id = $${idx++} AND id = $${idx++} RETURNING *`,
            values
        );
        if (!result.rows.length) return null;
        const r = result.rows[0];
        return new Lead({
            id: r.id, organizationId: r.organization_id, conversationId: r.conversation_id,
            name: r.name, contactInfo: r.contact_info, source: r.source, status: r.status,
            score: r.score, capturedData: r.captured_data, notes: r.notes,
            createdAt: r.created_at, updatedAt: r.updated_at,
        });
    }

    async delete(organizationId, id) {
        const result = await this.pool.query(
            'DELETE FROM leads WHERE organization_id = $1 AND id = $2 RETURNING id',
            [organizationId, id]
        );
        return result.rows.length > 0;
    }
}

module.exports = PostgresLeadRepository;
