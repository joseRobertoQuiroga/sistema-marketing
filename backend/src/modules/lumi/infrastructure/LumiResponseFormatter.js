class LumiResponseFormatter {
    constructor({ log }) {
        this.log = log?.child({ service: 'LumiResponseFormatter' });
    }

    format(text, data = {}, options = {}) {
        const response = {
            text,
            type: this._detectResponseType(text, data),
            data: this._sanitizeData(data),
            suggestions: this._generateSuggestions(data, options),
            timestamp: new Date().toISOString(),
        };
        return response;
    }

    _detectResponseType(text, data) {
        if (data.chartData) return 'chart';
        if (data.tableData) return 'table';
        if (data.listData) return 'list';
        if (data.actionResult) return 'action_result';
        return 'text';
    }

    _sanitizeData(data) {
        if (!data || Object.keys(data).length === 0) return null;
        const sanitized = {};
        for (const [key, val] of Object.entries(data)) {
            if (key === 'chartData' || key === 'tableData' || key === 'listData' || key === 'actionResult') {
                sanitized[key] = val;
            }
        }
        return sanitized;
    }

    _generateSuggestions(data, options = {}) {
        const suggestions = [];
        const intent = options.intent || '';

        if (intent === 'analytics' || !intent) {
            suggestions.push(
                { label: '¿Cómo van las ventas?', query: '¿Cómo van las ventas?' },
                { label: 'Productos más populares', query: '¿Cuáles son los productos más populares?' },
                { label: 'Estado de leads', query: '¿Cuántos leads tengo?' },
                { label: 'Rendimiento de campañas', query: '¿Cómo van mis campañas?' }
            );
        }
        if (intent === 'content' || !intent) {
            suggestions.push(
                { label: 'Generar descripción SEO', query: 'Genera una descripción SEO para un producto' },
            );
        }
        if (intent === 'action' || !intent) {
            suggestions.push(
                { label: 'Cargar productos', query: 'Quiero cargar productos masivamente' },
            );
        }

        return suggestions.slice(0, 4);
    }

    formatError(message, details = {}) {
        return {
            text: `⚠️ ${message}`,
            type: 'error',
            data: details,
            suggestions: [
                { label: 'Intentar de nuevo', query: message },
                { label: 'Hablar con soporte', query: 'Quiero hablar con un humano' },
            ],
            timestamp: new Date().toISOString(),
        };
    }
}

module.exports = LumiResponseFormatter;
