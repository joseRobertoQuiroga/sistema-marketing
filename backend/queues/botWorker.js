const { Worker } = require('bullmq');
const { processBotResponse, transcribe, queryVision } = require('../logic');
const PlatformManager = require('../platforms/PlatformManager');
const fs = require('fs');

console.log('🚀 Worker de Bot iniciado y esperando tareas...');

const botWorker = new Worker('bot-messages', async (job) => {
    const { type, text, conversationId, orgId, filePath, platform } = job.data;
    
    console.log(`👷 Procesando mensaje [${type}] para ${conversationId} en ${platform}`);

    try {
        let inputContent = text;

        if (type === 'audio' && filePath) {
            console.log(`🎤 Transcribiendo audio: ${filePath}`);
            inputContent = await transcribe(filePath);
            if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
        }

        if (type === 'image' && filePath) {
            console.log(`📸 Analizando imagen: ${filePath}`);
            inputContent = await queryVision(filePath, "Describe esta imagen.");
            if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
        }

        const botResult = await processBotResponse(orgId, conversationId, inputContent);

        if (botResult) {
            console.log(`🤖 Respuesta generada: ${botResult.response_text.slice(0, 50)}...`);
            await PlatformManager.sendMessage(platform || 'telegram', conversationId, botResult.response_text);
        }
    } catch (error) {
        console.error(`❌ Error en worker:`, error.message);
    }
}, {
    connection: {
        host: process.env.REDIS_HOST || 'redis',
        port: process.env.REDIS_PORT || 6379
    }
});

module.exports = botWorker;
