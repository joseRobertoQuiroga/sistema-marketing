class ExecuteActionUseCase {
    constructor({ aiProvider, pool, log }) {
        this.aiProvider = aiProvider;
        this.pool = pool;
        this.log = log.child({ useCase: 'ExecuteActionUseCase' });
    }

    async execute({ text, organizationId, context, intent, userId }) {
        const log = this.log.child({ orgId: organizationId });

        const actionType = await this._detectActionType(text);
        log.info('tipo de acción detectada', { actionType });

        switch (actionType) {
            case 'bulk_products':
                return this._bulkProducts({ text, organizationId, userId, log });
            case 'recommend':
                return this._recommendProducts({ text, organizationId, context, log });
            default:
                return {
                    text: `No reconozco la acción "${actionType}". Puedo ayudarte a cargar productos masivamente o recomendar productos.`,
                    data: { actionType: 'unknown' },
                };
        }
    }

    async executeAction({ type, params, organizationId, context, userId }) {
        const log = this.log.child({ orgId: organizationId, actionType: type });
        log.info('ejecutando acción directa', { params });

        switch (type) {
            case 'bulk_products':
                return this._bulkProductsDirect(params, organizationId, userId, log);
            default:
                throw new Error(`Tipo de acción no soportada: ${type}`);
        }
    }

    async _detectActionType(text) {
        const prompt = `Clasifica la siguiente solicitud en el tipo de acción. Responde SOLO con el tipo.

Tipos:
- bulk_products: cargar productos masivamente, importar catálogo, agregar productos en lote
- recommend: recomendar productos, sugerir productos, "qué me recomiendas"
- unknown: no es una acción ejecutable

Solicitud: "${text}"

Tipo:`;

        try {
            const result = await this.aiProvider.generate(
                prompt,
                'Eres un clasificador de acciones. Responde solo con el nombre del tipo.'
            );
            const cleaned = result.trim().toLowerCase();
            return ['bulk_products', 'recommend'].includes(cleaned) ? cleaned : 'unknown';
        } catch {
            return 'unknown';
        }
    }

    async _bulkProducts({ text, organizationId, userId, log }) {
        // Extract product data from the text
        const prompt = `Extrae productos del siguiente texto. Responde SOLO con JSON array.
Cada producto debe tener: name (requerido), description, price (número), category.

Texto: "${text}"

JSON:`;

        try {
            const result = await this.aiProvider.generate(
                prompt,
                'Eres un extractor de datos de productos. Responde ÚNICAMENTE con JSON array válido.'
            );
            const jsonStr = result.replace(/```json/g, '').replace(/```/g, '').trim();
            const products = JSON.parse(jsonStr);

            if (!Array.isArray(products) || products.length === 0) {
                return {
                    text: 'No pude identificar productos en tu mensaje. Por favor, proporciona los datos en formato: nombre, precio, categoría.',
                    data: { actionType: 'bulk_products', status: 'error' },
                };
            }

            if (products.length > 20) {
                return {
                    text: `Puedo procesar hasta 20 productos a la vez. Tienes ${products.length}. Por favor, divide en lotes más pequeños.`,
                    data: { actionType: 'bulk_products', status: 'error', count: products.length },
                };
            }

            let inserted = 0;
            let failed = 0;
            const errors = [];

            for (const product of products) {
                if (!product.name || !product.name.trim()) {
                    failed++;
                    errors.push({ name: '(sin nombre)', reason: 'Nombre requerido' });
                    continue;
                }
                try {
                    await this.pool.query(
                        `INSERT INTO products (organization_id, name, description, price, category)
                         VALUES ($1, $2, $3, $4, $5)`,
                        [
                            organizationId,
                            product.name.trim(),
                            product.description || '',
                            product.price ? parseFloat(product.price) : 0,
                            product.category || 'General',
                        ]
                    );
                    inserted++;
                } catch (err) {
                    failed++;
                    errors.push({ name: product.name, reason: err.message });
                }
            }

            log.info('productos insertados', { inserted, failed });

            return {
                text: `✅ Productos procesados: ${inserted} insertados, ${failed} fallidos.`,
                data: {
                    actionType: 'bulk_products',
                    status: 'completed',
                    inserted,
                    failed,
                    errors: errors.length > 0 ? errors.slice(0, 5) : [],
                },
            };
        } catch (err) {
            log.error('error en bulk products', { err: err.message });
            return {
                text: 'Error procesando productos. Asegúrate de enviar los datos en formato válido.',
                data: { actionType: 'bulk_products', status: 'error', error: err.message },
            };
        }
    }

    async _bulkProductsDirect(params, organizationId, userId, log) {
        const products = params.products || [];
        if (!Array.isArray(products) || products.length === 0) {
            throw new Error('No se proporcionaron productos');
        }
        if (products.length > 20) {
            throw new Error(`Máximo 20 productos por lote. Tienes ${products.length}.`);
        }

        let inserted = 0;
        let failed = 0;
        const errors = [];

        for (const product of products) {
            if (!product.name) { failed++; errors.push({ name: '(sin nombre)', reason: 'Nombre requerido' }); continue; }
            try {
                await this.pool.query(
                    `INSERT INTO products (organization_id, name, description, price, category)
                     VALUES ($1, $2, $3, $4, $5)`,
                    [organizationId, product.name, product.description || '', product.price || 0, product.category || 'General']
                );
                inserted++;
            } catch (err) {
                failed++;
                errors.push({ name: product.name, reason: err.message });
            }
        }

        return {
            message: `✅ ${inserted} productos insertados${failed > 0 ? `, ${failed} fallidos` : ''}`,
            data: { inserted, failed, errors: errors.slice(0, 5) },
        };
    }

    async _recommendProducts({ text, organizationId, context, log }) {
        const products = await this.pool.query(
            `SELECT id, name, description, price, category, currency
             FROM products WHERE organization_id = $1 AND is_active = true
             ORDER BY RANDOM() LIMIT 5`,
            [organizationId]
        );

        if (products.rows.length === 0) {
            return {
                text: 'No tengo productos activos para recomendar. ¿Quieres agregar algunos productos primero?',
                data: { actionType: 'recommend', count: 0 },
            };
        }

        const productList = products.rows.map(p =>
            `- ${p.name} (${p.currency || 'Bs.'}${p.price || '0'})${p.category ? ` — ${p.category}` : ''}`
        ).join('\n');

        const prompt = `Basado en la solicitud del usuario, recomienda productos de la siguiente lista.

PRODUCTOS DISPONIBLES:
${productList}

SOLICITUD: "${text}"

INSTRUCCIONES:
- Recomienda 2-3 productos relevantes
- Explica por qué cada recomendación es adecuada
- Sé persuasivo pero honesto

RECOMENDACIÓN:`;

        try {
            const recommendation = await this.aiProvider.generate(
                prompt,
                'Eres un vendedor experto que recomienda productos basados en las necesidades del cliente.'
            );

            return {
                text: recommendation,
                data: {
                    actionType: 'recommend',
                    products: products.rows.map(p => ({
                        id: p.id, name: p.name, price: p.price, category: p.category,
                    })),
                },
            };
        } catch {
            return {
                text: `Te recomiendo estos productos:\n${productList}`,
                data: { actionType: 'recommend', products: products.rows },
            };
        }
    }
}

module.exports = ExecuteActionUseCase;
