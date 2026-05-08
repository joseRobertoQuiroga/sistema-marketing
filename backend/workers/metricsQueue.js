require('dotenv').config();
const { Queue, Worker } = require('bullmq');
const IORedis = require('ioredis');

// Importar adaptadores de plataforma
const MetaAdapter = require('../adapters/metaAdapter');
const TikTokAdapter = require('../adapters/tiktokAdapter');
const LinkedInAdapter = require('../adapters/linkedinAdapter');

// ================================================================
// CONFIGURACIÓN DE REDIS
// ================================================================
const connection = new IORedis(process.env.REDIS_URL || 'redis://localhost:6379', {
    maxRetriesPerRequest: null,
    enableReadyCheck: false,
    lazyConnect: true
});

connection.on('connect', () => console.log('[Redis] Conectado correctamente.'));
connection.on('error', (err) => console.warn('[Redis] Error de conexión:', err.message));

// ================================================================
// COLA DE MÉTRICAS
// ================================================================
const metricsQueue = new Queue('metrics-sync', { connection });

// ================================================================
// WORKER: Procesamiento de sincronización
// ================================================================
const metricsWorker = new Worker('metrics-sync', async job => {
    const { organization_id, connections } = job.data;
    console.log(`\n[Worker] Sincronizando métricas para org: ${organization_id} (${new Date().toISOString()})`);

    const results = [];

    // Usar datos simulados si no hay conexiones reales en el job
    const activeConnections = connections || [
        { platform: 'facebook', access_token: null, account_id: 'mock_page_id' },
        { platform: 'instagram', access_token: null, account_id: 'mock_ig_id' },
        { platform: 'tiktok', access_token: null }
    ];

    for (const conn of activeConnections) {
        try {
            let data;
            if (conn.platform === 'facebook') {
                data = await MetaAdapter.fetchPageInsights(conn.account_id, conn.access_token);
            } else if (conn.platform === 'instagram') {
                data = await MetaAdapter.fetchInstagramInsights(conn.account_id, conn.access_token);
            } else if (conn.platform === 'tiktok') {
                data = await TikTokAdapter.fetchUserInfo(conn.access_token);
            } else if (conn.platform === 'linkedin') {
                data = await LinkedInAdapter.fetchOrganizationInsights(conn.account_id, conn.access_token);
            }

            if (data) {
                results.push(data);
                console.log(`[Worker] ✅ ${conn.platform}: datos extraídos.`);
                
                // En producción con DB real:
                // await db.query(
                //     `INSERT INTO account_metrics (organization_id, platform, date, followers, reach, engagement)
                //      VALUES ($1, $2, NOW()::date, $3, $4, $5)
                //      ON CONFLICT (organization_id, platform, date)
                //      DO UPDATE SET followers=$3, reach=$4, engagement=$5`,
                //     [organization_id, conn.platform, data.followers, data.reach, data.engagement]
                // );
            }
        } catch (err) {
            console.error(`[Worker] ❌ Error en ${conn.platform}:`, err.message);
        }
    }

    console.log(`[Worker] Sincronización completa. ${results.length}/${activeConnections.length} canales procesados.\n`);
    return { synced: results.length, timestamp: new Date().toISOString() };
}, { connection, concurrency: 1 });

metricsWorker.on('completed', (job, returnValue) => {
    console.log(`[BullMQ] ✅ Job ${job.id} completado:`, returnValue);
});

metricsWorker.on('failed', (job, err) => {
    console.error(`[BullMQ] ❌ Job ${job.id} falló:`, err.message);
});

// ================================================================
// CONFIGURAR CRON JOB: Cada 4 horas
// ================================================================
const setupCronJobs = async () => {
    await connection.connect();
    
    // Limpiar jobs repetitivos anteriores para evitar duplicados
    const repeatableJobs = await metricsQueue.getRepeatableJobs();
    for (const job of repeatableJobs) {
        await metricsQueue.removeRepeatableByKey(job.key);
    }

    // Registrar el job recurrente (cada 4 horas)
    await metricsQueue.add(
        'sync-all-orgs',
        { organization_id: 'global', connections: null },
        {
            repeat: { pattern: '0 */4 * * *' },
            removeOnComplete: 50,
            removeOnFail: 20
        }
    );

    // También ejecutar una sincronización inmediata al arrancar el servidor
    await metricsQueue.add(
        'sync-startup',
        { organization_id: 'global', connections: null },
        { delay: 5000 } // Esperar 5s para que la app esté lista
    );

    console.log('[BullMQ] 🕒 Cronjob de métricas registrado (cada 4 hrs + startup sync).');
};

module.exports = { metricsQueue, setupCronJobs };
