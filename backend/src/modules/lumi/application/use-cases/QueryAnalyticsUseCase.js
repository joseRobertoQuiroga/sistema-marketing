class QueryAnalyticsUseCase {
    constructor({ aiProvider, pool, log }) {
        this.aiProvider = aiProvider;
        this.pool = pool;
        this.log = log.child({ useCase: 'QueryAnalyticsUseCase' });
    }

    async execute({ text, organizationId, context, intent }) {
        const log = this.log.child({ orgId: organizationId, intent: intent?.intent });

        const contextStr = this._buildContextString(context);

        const prompt = `Eres un analista de negocio. Responde la siguiente consulta basándote en los datos proporcionados.

DATOS DEL NEGOCIO:
${contextStr}

CONSULTA: "${text}"

INSTRUCCIONES:
- Responde en español, de forma clara y concisa
- Usa datos numéricos específicos de los datos proporcionados
- Si no tienes datos precisos, indica claramente que son datos simulados
- Incluye recomendaciones accionables
- NO inventes datos que no estén en el contexto

RESPUESTA:`;

        try {
            const response = await this.aiProvider.generate(
                prompt,
                'Eres Lumi, un asistente de inteligencia de negocio para e-commerce. Analizas datos y das respuestas claras con datos específicos.'
            );

            log.info('analítica generada');

            return {
                text: response,
                data: {
                    chartData: this._buildChartData(context),
                    tableData: this._buildTableData(context, intent),
                },
            };
        } catch (err) {
            log.error('error en analytics', { err: err.message });
            throw err;
        }
    }

    _buildContextString(context) {
        if (!context) return 'Sin datos disponibles.';
        const { sales, products, customers, campaigns } = context;
        return `
--- VENTAS Y MENSAJES ---
Total mensajes: ${sales?.messages?.total_messages || 0}
Mensajes de usuarios: ${sales?.messages?.user_messages || 0}
Mensajes del bot: ${sales?.messages?.bot_messages || 0}
Score de intención promedio: ${(sales?.messages?.avg_intent_score || 0).toFixed(2)}
Mensajes de alta intención: ${sales?.messages?.high_intent_count || 0}
Productos totales: ${sales?.products?.total || 0}
Productos activos: ${sales?.products?.active || 0}

--- PRODUCTOS ---
Total productos: ${products?.summary?.total || 0}
Activos: ${products?.summary?.active || 0}
Inactivos: ${products?.summary?.inactive || 0}
Precio promedio: ${(products?.summary?.avg_price || 0).toFixed(2)}
Rango de precios: ${(products?.summary?.min_price || 0).toFixed(2)} - ${(products?.summary?.max_price || 0).toFixed(2)}
Categorías: ${(products?.categories || []).map(c => `${c.category} (${c.count})`).join(', ') || 'Sin categorías'}

--- CLIENTES Y LEADS ---
Total leads: ${customers?.summary?.total_leads || 0}
Nuevos: ${customers?.summary?.new_leads || 0}
Contactados: ${customers?.summary?.contacted || 0}
Convertidos: ${customers?.summary?.converted || 0}
Score promedio: ${(customers?.summary?.avg_score || 0).toFixed(2)}
Fuentes: ${(customers?.sources || []).map(s => `${s.source} (${s.count})`).join(', ') || 'Sin fuentes'}

--- CAMPAÑAS ---
Total campañas: ${campaigns?.total || 0}
Completadas: ${campaigns?.completed || 0}
Activas: ${campaigns?.active || 0}
Programadas: ${campaigns?.scheduled || 0}
Total enviados: ${campaigns?.total_sent || 0}
`;
    }

    _buildChartData(context) {
        if (!context) return null;
        const categories = context.products?.categories || [];
        if (categories.length === 0) return null;

        return {
            type: 'bar',
            labels: categories.map(c => c.category),
            datasets: [{
                label: 'Productos por categoría',
                data: categories.map(c => c.count),
            }],
        };
    }

    _buildTableData(context, intent) {
        if (!context) return null;

        if (intent?.subIntent === 'customers' || intent?.subIntent === 'leads') {
            const sources = context.customers?.sources || [];
            if (sources.length === 0) return null;
            return {
                columns: ['Fuente', 'Cantidad'],
                rows: sources.map(s => [s.source || 'desconocida', s.count]),
            };
        }

        if (intent?.subIntent === 'campaigns') {
            const c = context.campaigns;
            if (!c) return null;
            return {
                columns: ['Estado', 'Cantidad'],
                rows: [
                    ['Completadas', c.completed || 0],
                    ['Activas', c.active || 0],
                    ['Programadas', c.scheduled || 0],
                    ['Total enviados', c.total_sent || 0],
                ],
            };
        }

        return null;
    }
}

module.exports = QueryAnalyticsUseCase;
