const LumiIntentClassification = require('../domain/value-objects/LumiIntentClassification');

class LumiIntentClassifier {
    constructor({ aiProvider, log }) {
        this.aiProvider = aiProvider;
        this.log = log?.child({ service: 'LumiIntentClassifier' });
    }

    async classify(text, context = {}) {
        const prompt = `Clasifica la siguiente consulta de negocio. Responde SOLO con: intent|subintent|confidence

Categorías:
- analytics/sales → consultas sobre ventas, ingresos, facturación
- analytics/products → consultas sobre productos, stock, precios
- analytics/customers → consultas sobre clientes, leads, segmentación
- analytics/campaigns → consultas sobre campañas, envíos
- content/description → generar/mejorar descripciones de productos
- content/post → generar contenido para redes sociales
- action/bulk_products → cargar productos masivamente
- action/recommend → recomendar productos
- greeting → saludo
- unknown → no clasificable

Consulta: "${text}"

Respuesta:`;

        try {
            const result = await this.aiProvider.generate(
                prompt,
                'Eres un clasificador de intenciones de negocio. Responde SOLO con formato: intent|subintent|confidence(0-1)'
            );
            const cleaned = result.trim().toLowerCase();
            const parts = cleaned.split('|').map(s => s.trim());
            const intentStr = parts[0] || 'unknown';
            const subIntent = parts[1] || null;
            const confidence = parseFloat(parts[2]) || 0.6;

            const validIntents = ['analytics', 'content', 'action', 'greeting', 'unknown'];
            const intent = validIntents.includes(intentStr) ? intentStr : 'unknown';

            const useCaseMap = {
                'analytics': 'analytics',
                'content': 'content',
                'action': 'action',
                'greeting': 'analytics',
            };

            return new LumiIntentClassification({
                intent,
                subIntent: subIntent || (intent === 'analytics' ? 'sales' : null),
                confidence,
                suggestedUseCase: useCaseMap[intent] || 'analytics',
            });
        } catch (err) {
            this.log?.error('error clasificando intent Lumi', { err: err.message });
            return new LumiIntentClassification({
                intent: 'unknown', confidence: 0, suggestedUseCase: 'analytics',
            });
        }
    }
}

module.exports = LumiIntentClassifier;
