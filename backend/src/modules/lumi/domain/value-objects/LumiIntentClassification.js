class LumiIntentClassification {
    constructor({ intent, subIntent, confidence, suggestedUseCase }) {
        this.intent = intent;
        this.subIntent = subIntent || null;
        this.confidence = confidence || 0;
        this.suggestedUseCase = suggestedUseCase || this._defaultUseCase(intent);
    }

    _defaultUseCase(intent) {
        const map = { analytics: 'analytics', content: 'content', action: 'action', greeting: 'analytics' };
        return map[intent] || 'analytics';
    }

    get isAnalytics() { return this.intent === 'analytics'; }
    get isContent() { return this.intent === 'content'; }
    get isAction() { return this.intent === 'action'; }
    get isHighConfidence() { return this.confidence >= 0.7; }

    static intents = {
        SALES_QUERY: 'analytics',
        PRODUCT_QUERY: 'analytics',
        CUSTOMER_QUERY: 'analytics',
        CAMPAIGN_QUERY: 'analytics',
        GENERATE_DESCRIPTION: 'content',
        GENERATE_CONTENT: 'content',
        BULK_PRODUCTS: 'action',
        RECOMMEND: 'action',
        GREETING: 'greeting',
        UNKNOWN: 'unknown',
    };
}

module.exports = LumiIntentClassification;
