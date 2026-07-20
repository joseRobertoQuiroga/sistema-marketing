/**
 * Puerto: Extractor de Datos Estructurados
 * Extrae entidades como nombre, email, teléfono, producto de mensajes
 */
class IDataExtractor {
    /**
     * @param {string} message - Texto del mensaje
     * @param {Object} context - { orgId, platform, existingData }
     * @returns {Promise<Object>} { name, email, phone, productInterest, ... }
     */
    async extract(message, context) { throw new Error('Not implemented'); }
}

module.exports = IDataExtractor;
