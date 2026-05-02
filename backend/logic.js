const { Pool } = require('pg');
const axios = require('axios');
const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');
const dotenv = require('dotenv');

dotenv.config();

const pool = new Pool({
    connectionString: process.env.DATABASE_URL
});

const OLLAMA_URL = process.env.OLLAMA_URL || 'http://localhost:11434/api/generate';
const OLLAMA_EMBED_URL = process.env.OLLAMA_EMBED_URL || 'http://localhost:11434/api/embeddings';

async function getBotConfig(orgId) {
    const res = await pool.query('SELECT * FROM bot_configs WHERE organization_id = $1', [orgId]);
    return res.rows[0] || { business_name: 'OmniPresence', tone: 'profesional', escalation_message: 'Lo siento, no puedo ayudarte con eso.' };
}

async function getConversationHistory(conversationId, limit = 5) {
    const res = await pool.query(
        'SELECT role, content FROM messages WHERE conversation_id = $1 ORDER BY created_at DESC LIMIT $2',
        [conversationId, limit]
    );
    return res.rows.reverse().map(m => `${m.role === 'user' ? 'Usuario' : 'Bot'}: ${m.content}`).join('\n');
}

async function saveMessage(orgId, conversationId, role, content, score = 0, capturedData = {}) {
    await pool.query(
        'INSERT INTO messages (organization_id, conversation_id, role, content, intent_score, captured_data) VALUES ($1, $2, $3, $4, $5, $6)',
        [orgId, conversationId, role, content, score, JSON.stringify(capturedData)]
    );
}

async function transcribe(filePath) {
    const whisperPath = process.env.WHISPER_PATH || './whisper.cpp/main';
    const modelPath = process.env.WHISPER_MODEL_PATH || './whisper.cpp/models/ggml-base.bin';
    return new Promise((resolve, reject) => {
        exec(`${whisperPath} -m ${modelPath} -f ${filePath} -otxt`, (error, stdout, stderr) => {
            if (error) return reject(error);
            const txtPath = `${filePath}.txt`;
            if (fs.existsSync(txtPath)) {
                const text = fs.readFileSync(txtPath, 'utf8');
                fs.unlinkSync(txtPath);
                resolve(text.trim());
            } else {
                resolve(stdout.trim());
            }
        });
    });
}

async function queryVision(filePath, prompt) {
    try {
        const imageBase64 = fs.readFileSync(filePath, { encoding: 'base64' });
        const response = await axios.post(process.env.VISION_API_URL, {
            model: "qwen-vl",
            messages: [{
                role: "user",
                content: [
                    { type: "text", text: prompt },
                    { type: "image_url", image_url: { url: `data:image/jpeg;base64,${imageBase64}` } }
                ]
            }]
        });
        return response.data.choices[0].message.content;
    } catch (error) {
        console.error('Error en Visión IA:', error.message);
        return "No pude analizar la imagen correctamente.";
    }
}

async function processBotResponse(orgId, conversationId, userMessage) {
    try {
        const botConfig = await getBotConfig(orgId);
        const history = await getConversationHistory(conversationId);
        
        const embeddingRes = await axios.post(OLLAMA_EMBED_URL, {
            model: "nomic-embed-text",
            prompt: userMessage
        });
        const embedding = embeddingRes.data.embedding;

        const knowledgeRes = await pool.query(
            `SELECT content FROM knowledge_chunks 
             WHERE organization_id = $1 
             ORDER BY embedding <=> $2 LIMIT 3`,
            [orgId, JSON.stringify(embedding)]
        );
        const context = knowledgeRes.rows.map(r => r.content).join('\n');

        const systemPrompt = `Eres ${botConfig.business_name}, un asistente inteligente con tono ${botConfig.tone}.
Usa el siguiente CONTEXTO para responder al usuario. Si no sabes la respuesta, usa el mensaje de escalado: "${botConfig.escalation_message}".

CONTEXTO:
${context}

HISTORIAL RECIENTE:
${history}

INSTRUCCIONES:
1. Responde en formato JSON.
2. Incluye "response_text", "intent_score" (0-100), "confidence" (0.0-1.0) y "captured_data" (objeto con datos como nombre, email, producto interesado).
3. Si el usuario parece muy interesado en comprar, pon intent_score > 80.`;

        const response = await axios.post(OLLAMA_URL, {
            model: "mistral:instruct",
            prompt: `SISTEMA: ${systemPrompt}\nUSUARIO: ${userMessage}`,
            stream: false,
            format: "json"
        });

        const result = JSON.parse(response.data.response);
        
        await saveMessage(orgId, conversationId, 'user', userMessage);
        await saveMessage(orgId, conversationId, 'assistant', result.response_text, result.intent_score, result.captured_data);

        return result;
    } catch (error) {
        console.error('❌ Error en processBotResponse:', error.message);
        return null;
    }
}

async function sendMessageToPlatform(conversationId, text, platform = 'telegram') {
    const { Telegraf } = require('telegraf');
    console.log(`📤 [PLATFORM RESPONSE] -> ${conversationId}: "${text}"`);
    if (platform === 'telegram' && process.env.TELEGRAM_TOKEN) {
        try {
            const bot = new Telegraf(process.env.TELEGRAM_TOKEN);
            await bot.telegram.sendMessage(conversationId, text);
            return true;
        } catch (error) {
            console.error('❌ Error enviando a Telegram:', error.message);
            return false;
        }
    }
    return true;
}

module.exports = {
    pool,
    getBotConfig,
    getConversationHistory,
    saveMessage,
    transcribe,
    queryVision,
    processBotResponse,
    sendMessageToPlatform
};
