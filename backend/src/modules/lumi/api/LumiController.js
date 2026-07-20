const logger = require('../../../infrastructure/utils/logger-strategic');

class LumiController {
    constructor({ orchestrator, contextBuilder }) {
        this.orchestrator = orchestrator;
        this.contextBuilder = contextBuilder;
        this.log = logger.child({ controller: 'LumiController' });
    }

    async query(req, res) {
        try {
            const orgId = req.user?.orgId;
            if (!orgId) return res.status(401).json({ error: 'Autenticación requerida' });

            const { text } = req.body;
            if (!text || !text.trim()) {
                return res.status(400).json({ error: 'El campo text es requerido' });
            }

            const result = await this.orchestrator.processQuery({
                text: text.trim(),
                organizationId: orgId,
                userId: req.user?.id,
            });

            res.json(result);
        } catch (err) {
            this.log.error('error en query', { err: err.message });
            res.status(500).json({ error: 'Error procesando consulta' });
        }
    }

    async action(req, res) {
        try {
            const orgId = req.user?.orgId;
            if (!orgId) return res.status(401).json({ error: 'Autenticación requerida' });

            const { type, params } = req.body;
            if (!type) return res.status(400).json({ error: 'El campo type es requerido' });

            const result = await this.orchestrator.executeAction({
                type,
                params: params || {},
                organizationId: orgId,
                userId: req.user?.id,
            });

            res.json(result);
        } catch (err) {
            this.log.error('error en action', { err: err.message });
            res.status(500).json({ error: 'Error ejecutando acción' });
        }
    }

    async context(req, res) {
        try {
            const orgId = req.user?.orgId;
            if (!orgId) return res.status(401).json({ error: 'Autenticación requerida' });

            const context = await this.contextBuilder.getFullContext(orgId);
            res.json(context);
        } catch (err) {
            this.log.error('error obteniendo contexto', { err: err.message });
            res.status(500).json({ error: 'Error obteniendo contexto' });
        }
    }

    async health(req, res) {
        res.json({ status: 'ok', module: 'lumi', version: '1.0.0' });
    }
}

module.exports = LumiController;
