const LumiQuery = require('../domain/entities/LumiQuery');

class LumiOrchestrator {
    constructor({ intentClassifier, contextBuilder, analyticsUseCase, contentGenUseCase, actionUseCase, responseFormatter, log }) {
        this.intentClassifier = intentClassifier;
        this.contextBuilder = contextBuilder;
        this.analyticsUseCase = analyticsUseCase;
        this.contentGenUseCase = contentGenUseCase;
        this.actionUseCase = actionUseCase;
        this.responseFormatter = responseFormatter;
        this.log = log.child({ service: 'LumiOrchestrator' });
    }

    async processQuery({ text, organizationId, userId = null }) {
        const log = this.log.child({ orgId: organizationId });
        const startTotal = Date.now();
        log.info('▶ Lumi query', { text: text.slice(0, 80) });

        const query = new LumiQuery({
            organizationId,
            text,
            createdAt: new Date(),
        });

        try {
            // 1. Classify intent
            const step1 = Date.now();
            const classification = await this.intentClassifier.classify(text, { organizationId });
            query.intent = classification.intent;
            log.info('intención clasificada', {
                intent: classification.intent,
                subIntent: classification.subIntent,
                confidence: classification.confidence,
                durationMs: Date.now() - step1,
            });

            if (classification.intent === 'greeting') {
                const ctx = await this.contextBuilder.getFullContext(organizationId);
                const greeting = `¡Hola! Soy Lumi, tu asistente de negocio. Veo que tienes ${ctx.products.summary.active} productos activos y ${ctx.customers.summary.total_leads} leads. ¿En qué puedo ayudarte?`;
                return this.responseFormatter.format(greeting, { context: ctx }, { intent: 'greeting' });
            }

            // 2. Build context
            const step2 = Date.now();
            const context = await this.contextBuilder.getFullContext(organizationId);
            query.context = context;
            log.info('contexto construido', { durationMs: Date.now() - step2 });

            // 3. Route to appropriate use case
            const step3 = Date.now();
            let result;

            switch (classification.suggestedUseCase) {
                case 'analytics':
                    result = await this.analyticsUseCase.execute({
                        text,
                        organizationId,
                        context,
                        intent: classification,
                    });
                    break;
                case 'content':
                    result = await this.contentGenUseCase.execute({
                        text,
                        organizationId,
                        context,
                        intent: classification,
                    });
                    break;
                case 'action':
                    result = await this.actionUseCase.execute({
                        text,
                        organizationId,
                        context,
                        intent: classification,
                        userId,
                    });
                    break;
                default:
                    result = await this.analyticsUseCase.execute({
                        text, organizationId, context, intent: classification,
                    });
            }

            log.info('use case ejecutado', {
                useCase: classification.suggestedUseCase,
                durationMs: Date.now() - step3,
            });

            // 4. Format response
            const formatted = this.responseFormatter.format(
                result.text || result.message || 'Procesado correctamente.',
                result.data || {},
                { intent: classification.intent }
            );

            const totalDuration = Date.now() - startTotal;
            log.info('✅ Lumi query completada', {
                intent: classification.intent,
                totalDurationMs: totalDuration,
            });

            return {
                ...formatted,
                queryId: query.id,
                intent: classification.intent,
                subIntent: classification.subIntent,
                durationMs: totalDuration,
            };
        } catch (err) {
            log.error('❌ Lumi query error', { err: err.message });
            return this.responseFormatter.formatError(
                'Ocurrió un error al procesar tu consulta. Por favor intenta de nuevo.',
                { error: err.message }
            );
        }
    }

    async executeAction({ type, params, organizationId, userId }) {
        const log = this.log.child({ orgId: organizationId });
        log.info('▶ Lumi action', { type, params });

        try {
            const context = await this.contextBuilder.getFullContext(organizationId);
            const result = await this.actionUseCase.executeAction({ type, params, organizationId, context, userId });
            return this.responseFormatter.format(
                result.message || 'Acción ejecutada correctamente.',
                { actionResult: result },
                { intent: 'action' }
            );
        } catch (err) {
            log.error('❌ Lumi action error', { err: err.message });
            return this.responseFormatter.formatError(
                `Error ejecutando acción: ${err.message}`,
                { type, error: err.message }
            );
        }
    }
}

module.exports = LumiOrchestrator;
