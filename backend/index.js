const express = require('express');
const cors = require('cors');
const http = require('http');
const socketIo = require('socket.io');
const multer = require('multer');
const fs = require('fs');
const path = require('path');
const axios = require('axios');
const dotenv = require('dotenv');
const { 
    pool, processBotResponse, sendMessageToPlatform, saveMessage 
} = require('./logic');
const { botQueue } = require('./queues/botQueue');

dotenv.config();

const app = express();
const server = http.createServer(app);
const io = socketIo(server, { cors: { origin: "*" } });

app.use(cors());
app.use(express.json());
const upload = multer({ dest: 'uploads/' });

if (!fs.existsSync('uploads')) {
    fs.mkdirSync('uploads');
}

// Iniciar Worker
require('./queues/botWorker');

/**
 * 5. Integración con Telegram (Polling Manual)
 */
const TELEGRAM_TOKEN = process.env.TELEGRAM_TOKEN;
const TEST_ORG_ID = '369344ae-f39e-4eaa-a684-4e63c5a3a48a'; // ID Real de la Organización del Seeding

if (TELEGRAM_TOKEN) {
    const API_URL = `https://api.telegram.org/bot${TELEGRAM_TOKEN}`;
    let lastUpdateId = 0;

    async function pollTelegram() {
        try {
            const res = await axios.get(`${API_URL}/getUpdates?offset=${lastUpdateId + 1}&timeout=30`);
            if (res.data.ok && res.data.result.length > 0) {
                for (const update of res.data.result) {
                    lastUpdateId = update.update_id;
                    
                    if (update.message) {
                        const chatId = update.message.chat.id.toString();
                        
                        if (update.message.text) {
                            const text = update.message.text;
                            console.log(`📩 [TELEGRAM] Mensaje de ${chatId}: ${text}`);
                            await botQueue.add('process_message', {
                                type: 'text',
                                text: text,
                                conversationId: chatId,
                                orgId: TEST_ORG_ID,
                                platform: 'telegram'
                            });
                            io.emit('new_message', { conversationId: chatId, role: 'user', content: text });
                        } else if (update.message.voice) {
                            console.log(`🎙️ [TELEGRAM] Audio de ${chatId}`);
                            const fileId = update.message.voice.file_id;
                            const fileRes = await axios.get(`${API_URL}/getFile?file_id=${fileId}`);
                            const filePathOnTg = fileRes.data.result.file_path;
                            const downloadUrl = `https://api.telegram.org/file/bot${TELEGRAM_TOKEN}/${filePathOnTg}`;
                            
                            const localPath = path.join(__dirname, 'uploads', `${fileId}.oga`);
                            const writer = fs.createWriteStream(localPath);
                            const response = await axios({ url: downloadUrl, responseType: 'stream' });
                            response.data.pipe(writer);
                            
                            await new Promise((resolve) => writer.on('finish', resolve));

                            await botQueue.add('process_message', {
                                type: 'audio',
                                conversationId: chatId,
                                orgId: TEST_ORG_ID,
                                filePath: localPath,
                                platform: 'telegram'
                            });
                        }
                    }
                }
            }
            setTimeout(pollTelegram, 500);
        } catch (error) {
            console.error('❌ Error en Polling Telegram:', error.message);
            setTimeout(pollTelegram, 5000);
        }
    }

    console.log('📡 Iniciando Polling Manual de Telegram...');
    pollTelegram();
}

app.post('/webhook', upload.single('media'), async (req, res) => {
    const { type, text, conversationId = 'default' } = req.body;
    await botQueue.add('process_message', {
        type: type || 'text',
        text,
        conversationId,
        orgId: TEST_ORG_ID,
        filePath: req.file ? req.file.path : null
    });
    res.status(200).json({ message: 'Procesando en background' });
});

app.get('/api/conversations', async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT conversation_id as id, MAX(created_at) as last_activity,
            (SELECT content FROM messages WHERE conversation_id = m.conversation_id ORDER BY created_at DESC LIMIT 1) as last_msg,
            MAX(intent_score) as score
            FROM messages m GROUP BY conversation_id ORDER BY last_activity DESC
        `);
        res.json(result.rows);
    } catch (error) { res.status(500).json({ error: error.message }); }
});

app.get('/api/conversations/:id/messages', async (req, res) => {
    try {
        const result = await pool.query('SELECT role as type, content, intent_score, created_at as time FROM messages WHERE conversation_id = $1 ORDER BY created_at ASC', [req.params.id]);
        res.json(result.rows);
    } catch (error) { res.status(500).json({ error: error.message }); }
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`🚀 API en puerto ${PORT}`));
