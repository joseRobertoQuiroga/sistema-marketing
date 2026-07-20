/**
 * Value Object: Intención de mensaje
 * Inmutable — evalúa clasificación de propósito del mensaje
 */
class IntentClassification {
    constructor({ intent, score, subIntent, entities, suggestedAction }) {
        this.intent = intent;           // product_inquiry | purchase | complaint | greeting | spam | unknown
        this.score = score;             // 0.0 - 1.0
        this.subIntent = subIntent || null;
        this.entities = entities || {}; // { product, price, color, size, ... }
        this.suggestedAction = suggestedAction || 'respond'; // respond | escalate | ignore | transfer
        Object.freeze(this);
    }

    get isHighConfidence() { return this.score >= 0.7; }
    get isMediumConfidence() { return this.score >= 0.4 && this.score < 0.7; }
    get isLowConfidence() { return this.score < 0.4; }
    get shouldEscalate() { return this.suggestedAction === 'escalate'; }

    static intents = {
        PRODUCT_INQUIRY: 'product_inquiry',
        PURCHASE: 'purchase',
        COMPLAINT: 'complaint',
        GREETING: 'greeting',
        SPAM: 'spam',
        ESCALATION: 'escalation',
        UNKNOWN: 'unknown',
    };
}

module.exports = IntentClassification;
