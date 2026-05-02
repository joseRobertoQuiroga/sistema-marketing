const { Pool } = require('pg');
const axios = require('axios');
const dotenv = require('dotenv');

dotenv.config();

const pool = new Pool({
    connectionString: process.env.DATABASE_URL
});

const OLLAMA_EMBED_URL = process.env.OLLAMA_EMBED_URL || 'http://localhost:11434/api/embeddings';

async function getEmbedding(text) {
    try {
        const response = await axios.post(OLLAMA_EMBED_URL, {
            model: "nomic-embed-text",
            prompt: text
        });
        return response.data.embedding;
    } catch (error) {
        console.warn('⚠️ No se pudo generar embedding para seeding.');
        return null;
    }
}

async function seed() {
    console.log('🌱 Iniciando Seeding...');
    
    try {
        // 1. Crear Organización
        const orgRes = await pool.query(
            "INSERT INTO organizations (name, plan) VALUES ($1, $2) RETURNING id",
            ['Tienda Moda SCZ', 'business']
        );
        const orgId = orgRes.rows[0].id;
        console.log(`✅ Org creada: ${orgId}`);

        // 2. Crear Configuración del Bot
        await pool.query(
            `INSERT INTO bot_configs (organization_id, business_name, tone, escalation_message)
             VALUES ($1, $2, $3, $4)`,
            [orgId, 'Tienda Moda SCZ', 'amigable', 'Lo siento, no tengo el dato exacto de ese producto. ¿Te gustaría hablar con un humano?']
        );
        console.log(`✅ Bot Config creada.`);

        // 3. Crear Conocimiento (Knowledge Chunks)
        const chunks = [
            "Nuestra tienda está ubicada en la Av. San Martín #123, Santa Cruz de la Sierra. Atendemos de Lunes a Sábado de 09:00 a 20:00.",
            "Aceptamos pagos en efectivo, transferencia bancaria (BUN, BCP) y tarjetas de crédito/débito.",
            "Realizamos envíos a todo Bolivia. En Santa Cruz el envío es gratis por compras mayores a Bs. 200.",
            "Políticas de cambio: Tienes 7 días para realizar cambios presentando tu recibo, siempre que la prenda esté con etiqueta y sin señales de uso.",
            "Producto: Vestido Rojo Gala. Precio: Bs. 180. Categoría: Vestidos. Tallas: S, M, L.",
            "Producto: Sandalias Plata. Precio: Bs. 120. Categoría: Calzado. Tallas: 36, 37, 38, 39."
        ];

        for (const content of chunks) {
            const embedding = await getEmbedding(content);
            if (embedding) {
                await pool.query(
                    `INSERT INTO knowledge_chunks (organization_id, source_type, source_name, content, embedding)
                     VALUES ($1, $2, $3, $4, $5)`,
                    [orgId, 'text', 'manual_seed', content, JSON.stringify(embedding)]
                );
            }
        }
        console.log(`✅ ${chunks.length} Fragmentos de conocimiento insertados.`);

        console.log('🚀 Seeding completado con éxito.');
        process.exit(0);
    } catch (error) {
        console.error('❌ Error en seeding:', error.message);
        process.exit(1);
    }
}

seed();
