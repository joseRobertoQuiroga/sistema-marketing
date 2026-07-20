const axios = require('axios');

/**
 * Proveedor IA: Google Gemini
 * Implementa IAIService
 * Gratis: 15 RPM, 1,500 req/día, contexto 1M tokens
 * Endpoint: https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent
 */
class GeminiProvider {
    constructor() {
        this.apiKey = process.env.GEMINI_API_KEY;
        this.model = process.env.GEMINI_MODEL || 'gemini-2.0-flash';
        this.baseUrl = 'https://generativelanguage.googleapis.com/v1beta/models';
    }

    async generate(prompt, systemPrompt = 'Eres un asistente útil.') {
        const url = `${this.baseUrl}/${this.model}:generateContent?key=${this.apiKey}`;
        const response = await axios.post(url, {
            contents: [{ role: 'user', parts: [{ text: prompt }] }],
            systemInstruction: { role: 'user', parts: [{ text: systemPrompt }] },
            generationConfig: { temperature: 0.7, maxOutputTokens: 1024 },
        }, { timeout: 20000 });
        return response.data.candidates[0].content.parts[0].text;
    }

    async embed(text) {
        const url = `${this.baseUrl}/${this.model}:embedContent?key=${this.apiKey}`;
        const response = await axios.post(url, {
            content: { parts: [{ text }] },
        }, { timeout: 10000 });
        return response.data.embedding.values;
    }
}

module.exports = GeminiProvider;
