class GenerateContentUseCase {
    constructor({ aiProvider, pool, log }) {
        this.aiProvider = aiProvider;
        this.pool = pool;
        this.log = log.child({ useCase: 'GenerateContentUseCase' });
    }

    async execute({ text, organizationId, context, intent }) {
        const log = this.log.child({ orgId: organizationId });

        // Detect if they want description for a specific product
        const productName = await this._extractProductName(text, organizationId);

        if (productName) {
            const product = await this._getProduct(organizationId, productName);
            if (product) {
                return this._generateProductDescription(product, text);
            }
        }

        // Generic content generation
        const prompt = `Genera contenido de marketing basado en el siguiente contexto y solicitud.

CONTEXTO DEL NEGOCIO:
- Productos activos: ${context?.products?.summary?.active || 0}
- Categorías: ${(context?.products?.categories || []).map(c => c.category).join(', ') || 'variadas'}
- Leads totales: ${context?.customers?.summary?.total_leads || 0}

SOLICITUD: "${text}"

INSTRUCCIONES:
- Genera contenido profesional listo para usar
- Incluye palabras clave SEO relevantes
- Mantén un tono profesional pero accesible
- Si es descripción de producto, incluye: características, beneficios, llamada a la acción
- Extensión: 100-200 palabras

RESPUESTA:`;

        try {
            const response = await this.aiProvider.generate(
                prompt,
                'Eres Lumi, un experto en marketing de contenidos y redacción SEO para e-commerce. Generas contenido efectivo y persuasivo.'
            );

            log.info('contenido generado');
            return { text: response, data: { contentType: 'seo_description' } };
        } catch (err) {
            log.error('error generando contenido', { err: err.message });
            throw err;
        }
    }

    async _extractProductName(text, organizationId) {
        const prompt = `Extrae el nombre del producto mencionado en el texto. Si no hay producto específico, responde SOLO "null".

Texto: "${text}"

Producto:`;

        try {
            const result = await this.aiProvider.generate(
                prompt,
                'Eres un extractor de nombres de productos. Responde solo con el nombre o null.'
            );
            const cleaned = result.trim();
            return cleaned.toLowerCase() === 'null' || cleaned === '' ? null : cleaned;
        } catch {
            return null;
        }
    }

    async _getProduct(organizationId, productName) {
        const result = await this.pool.query(
            `SELECT id, name, description, price, category, currency
             FROM products
             WHERE organization_id = $1 AND is_active = true
             AND (LOWER(name) LIKE $2 OR LOWER(name) = $3)
             LIMIT 1`,
            [organizationId, `%${productName.toLowerCase()}%`, productName.toLowerCase()]
        );
        return result.rows[0] || null;
    }

    async _generateProductDescription(product, userRequest) {
        const prompt = `Genera una descripción SEO optimizada para el siguiente producto:

NOMBRE: ${product.name}
DESCRIPCIÓN ACTUAL: ${product.description || 'Sin descripción'}
PRECIO: ${product.currency || 'Bs.'} ${product.price || '0'}
CATEGORÍA: ${product.category || 'General'}

SOLICITUD DEL USUARIO: "${userRequest}"

INSTRUCCIONES:
- Descripción persuasiva de 100-150 palabras
- Incluye 3-5 palabras clave SEO relevantes
- Destaca beneficios, no solo características
- Incluye llamada a la acción
- Tono profesional y atractivo

DESCRIPCIÓN SEO:`;

        try {
            const description = await this.aiProvider.generate(
                prompt,
                'Eres un redactor SEO experto en e-commerce. Creas descripciones que venden.'
            );

            return {
                text: description,
                data: {
                    contentType: 'product_description',
                    productId: product.id,
                    productName: product.name,
                },
            };
        } catch (err) {
            return {
                text: `Descripción para ${product.name}: ${product.description || 'Producto de alta calidad.'}`,
                data: { contentType: 'fallback', productId: product.id },
            };
        }
    }
}

module.exports = GenerateContentUseCase;
