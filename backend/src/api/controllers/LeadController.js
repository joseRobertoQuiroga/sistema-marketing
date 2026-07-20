class LeadController {
    constructor({ leadRepo }) {
        this.leadRepo = leadRepo;
    }

    async list(req, res) {
        try {
            if (!req.user?.orgId) {
                return res.status(401).json({ error: { code: 'UNAUTHORIZED', message: 'Autenticación requerida' } });
            }
            const { status, source, page = '1', limit = '50' } = req.query;
            const result = await this.leadRepo.findByOrganization(req.user.orgId, {
                status, source, page: parseInt(page), limit: parseInt(limit),
            });
            res.json(result);
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    }

    async update(req, res) {
        try {
            if (!req.user?.orgId) {
                return res.status(401).json({ error: { code: 'UNAUTHORIZED', message: 'Autenticación requerida' } });
            }
            const { id } = req.params;
            const { status, name, notes } = req.body;
            const result = await this.leadRepo.update(req.user.orgId, id, { status, name, notes });
            if (!result) return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Lead no encontrado' } });
            res.json(result);
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    }

    async delete(req, res) {
        try {
            if (!req.user?.orgId) {
                return res.status(401).json({ error: { code: 'UNAUTHORIZED', message: 'Autenticación requerida' } });
            }
            const { id } = req.params;
            const result = await this.leadRepo.delete(req.user.orgId, id);
            if (!result) return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Lead no encontrado' } });
            res.json({ success: true });
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    }
}

module.exports = LeadController;
