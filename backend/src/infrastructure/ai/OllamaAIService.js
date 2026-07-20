const axios = require('axios');
const IAIService = require('../../domain/ports/IAIService');

class OllamaAIService extends IAIService {
    constructor() {
        super();
        this.baseUrl = process.env.OLLAMA_URL || 'http://localhost:11434/api/generate';
        this.embedUrl = process.env.OLLAMA_EMBED_URL || 'http://localhost:11434/api/embeddings';
    }

    async generate(prompt, systemPrompt) {
        const response = await axios.post(this.baseUrl, {
            model: 'mistral:instruct',
            prompt: `SISTEMA: ${systemPrompt}\nUSUARIO: ${prompt}`,
            stream: false,
            format: 'json',
        });
        return JSON.parse(response.data.response);
    }

    async embed(text) {
        const response = await axios.post(this.embedUrl, {
            model: 'nomic-embed-text',
            prompt: text,
        });
        return response.data.embedding;
    }
}

module.exports = OllamaAIService;
