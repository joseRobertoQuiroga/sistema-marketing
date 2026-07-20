const { Worker } = require('bullmq');
const Redis = require('ioredis');

/**
 * RAG Sync Worker — Sincroniza datos de la DB al vector store (pgvector)
 * 
 * SRP: Una sola responsabilidad — mantener el índice RAG actualizado
 * Cada worker procesa UN tipo de sync (productos, conocimiento, leads)
 *
 * Flujo:
 *   1. Obtener datos actualizados de la DB
 *   2. Generar embeddings con IA
 *   3. Indexar en pgvector
 *   4. Registrar métricas del sync
 *
 * Programación: BullMQ repeatable jobs (cada 30 min por defecto)
 */
class RAGSyncWorker {
    constructor({ pool, aiProvider, ragStore, log }) {
        this.pool = pool;
        this.aiProvider = aiProvider;
        this.ragStore = ragStore;
        this.log = log.child({ service: 'RAGSyncWorker' });

        this.connection = new Redis(process.env.REDIS_URL || 'redis://localhost:6379', {
            maxRetriesPerRequest: null,
            enableReadyCheck: false,
        });

        this.worker = new Worker('rag-sync', async (job) => {
            const { type, organizationId } = job.data;
            this.log.info('▶ INICIO sync RAG', { type, organizationId, jobId: job.id });

            const start = Date.now();
            try {
                switch (type) {
                    case 'products':
                        await this._syncProducts(organizationId);
                        break;
                    case 'knowledge':
                        await this._syncKnowledge(organizationId);
                        break;
                    case 'full':
                        await this._syncAll(organizationId);
                        break;
                    default:
                        this.log.warn('tipo de sync desconocido', { type });
                }

                const duration = Date.now() - start;
                this.log.info('✅ FIN sync RAG', { type, organizationId, durationMs: duration });
                return { success: true, type, durationMs: duration };
            } catch (err) {
                this.log.error('❌ ERROR sync RAG', {
                    type, organizationId, err: err.message, durationMs: Date.now() - start,
                });
                throw err;
            }
        }, {
            connection: this.connection,
            concurrency: 2,
            limiter: { max: 10, duration: 60000 }, // max 10 jobs per minute
        });

        this.worker.on('failed', (job, err) => {
            this.log.error('worker sync falló permanentemente', {
                jobId: job?.id, type: job?.data?.type, err: err.message,
            });
        });
    }

    async _syncProducts(organizationId) {
        const products = await this.pool.query(
            `SELECT id, name, description, category, price FROM products
             WHERE organization_id = $1 AND is_active = true
             AND (indexed_at IS NULL OR updated_at > indexed_at)`,
            [organizationId]
        );

        if (products.rows.length === 0) {
            this.log.debug('sin productos nuevos para indexar', { organizationId });
            return;
        }

        this.log.info('indexando productos', { count: products.rows.length, organizationId });

        for (const product of products.rows) {
            try {
                const text = `Producto: ${product.name}. Descripción: ${product.description || ''}. Categoría: ${product.category || ''}. Precio: ${product.price || ''}`;
                const embedding = await this.aiProvider.embed(text);

                // Upsert en knowledge_chunks como fuente 'product'
                await this.pool.query(
                    `INSERT INTO knowledge_chunks (organization_id, source_type, source_name, content, embedding, metadata)
                     VALUES ($1, 'product', $2, $3, $4, $5)
                     ON CONFLICT (organization_id, source_type, source_name) WHERE source_type = 'product'
                     DO UPDATE SET content = EXCLUDED.content, embedding = EXCLUDED.embedding, metadata = EXCLUDED.metadata,
                                   is_active = true, deleted_at = NULL, created_at = NOW()`,
                    [organizationId, product.name, text, JSON.stringify(embedding), JSON.stringify({
                        productId: product.id, price: product.price, category: product.category,
                    })]
                );

                // Marcar como indexado
                await this.pool.query(
                    'UPDATE products SET indexed_at = NOW() WHERE id = $1',
                    [product.id]
                );
            } catch (err) {
                this.log.warn('error indexando producto', { productId: product.id, err: err.message });
            }
        }
    }

    async _syncKnowledge(organizationId) {
        // Los chunks de knowledge ya están en knowledge_chunks con embeddings
        // Este sync regenera embeddings faltantes
        const chunks = await this.pool.query(
            `SELECT id, content FROM knowledge_chunks
             WHERE organization_id = $1 AND source_type = 'text' AND is_active = true AND embedding IS NULL`,
            [organizationId]
        );

        for (const chunk of chunks.rows) {
            try {
                const embedding = await this.aiProvider.embed(chunk.content);
                await this.pool.query(
                    'UPDATE knowledge_chunks SET embedding = $1 WHERE id = $2',
                    [JSON.stringify(embedding), chunk.id]
                );
            } catch (err) {
                this.log.warn('error indexando chunk', { chunkId: chunk.id });
            }
        }

        if (chunks.rows.length > 0) {
            this.log.info('chunks indexados', { count: chunks.rows.length, organizationId });
        }
    }

    async _syncAll(organizationId) {
        await Promise.all([
            this._syncProducts(organizationId),
            this._syncKnowledge(organizationId),
        ]);
    }

    async close() {
        await this.worker.close();
        await this.connection.quit();
    }
}

module.exports = RAGSyncWorker;
