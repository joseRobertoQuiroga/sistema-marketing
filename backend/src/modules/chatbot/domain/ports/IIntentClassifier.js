/**
 * Puerto: Clasificador de Intenciones
 * Abierto a extensión (OCP): nuevas estrategias de clasificación implementan esta interfaz
 */
class IIntentClassifier {
    /**
     * @param {string} message - Texto del mensaje
     * @param {Object} context - { orgId, platform, conversationHistory }
     * @returns {Promise<IntentClassification>}
     */
    async classify(message, context) { throw new Error('Not implemented'); }
}

module.exports = IIntentClassifier;
