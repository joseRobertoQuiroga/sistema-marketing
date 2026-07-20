const { exec } = require('child_process');
const fs = require('fs');
const ITranscriptionService = require('../../domain/ports/ITranscriptionService');

class WhisperTranscriptionService extends ITranscriptionService {
    async transcribe(filePath) {
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
}

module.exports = WhisperTranscriptionService;
