const IntentClassification = require('../../../domain/value-objects/IntentClassification');

/**
 * Use Case: Clasificar Intención de Mensaje
 * SRP: Una sola responsabilidad — determinar el propósito del mensaje
 * DIP: Depende de la interfaz IIntentClassifier, no de implementación concreta
 */
class ClassifyIntentUseCase {
    constructor({ intentClassifier, log }) {
        this.classifier = intentClassifier;
        this.log = log.child({ useCase: 'ClassifyIntentUseCase' });
    }

    async execute(message, context = {}) {
        this.log.debug('clasificando intención', {
            contentPreview: (message || '').slice(0, 60),
            platform: context.platform,
        });

        const start = Date.now();
        try {
            const result = await this.classifier.classify(message, context);
            this.log.info('intención clasificada', {
                intent: result.intent,
                score: result.score,
                action: result.suggestedAction,
                durationMs: Date.now() - start,
                highConfidence: result.isHighConfidence,
            });
            return result;
        } catch (err) {
            this.log.error('error clasificando intención', {
                err: err.message,
                durationMs: Date.now() - start,
            });
            // Fallback seguro: clasificar como desconocido
            return new IntentClassification({
                intent: IntentClassification.intents.UNKNOWN,
                score: 0,
                suggestedAction: 'respond',
            });
        }
    }
}

module.exports = ClassifyIntentUseCase;
