const axios = require('axios');

/**
 * Proveedor IA: Groq (más rápido, LPU hardware)
 * Implementa IAIService
 * Gratis: 30 RPM, 1,000 req/día, 0 costo
 * Endpoint: https://api.groq.com/openai/v1/chat/completions
 */
class GroqProvider {
    constructor() {
        this.apiKey = process.env.GROQ_API_KEY;
        this.baseUrl = 'https://api.groq.com/openai/v1/chat/completions';
        this.model = process.env.GROQ_MODEL || 'llama-3.3-70b-versatile';
    }

    async generate(prompt, systemPrompt = 'Eres un asistente útil.') {
        const response = await axios.post(this.baseUrl, {
            model: this.model,
            messages: [
                { role: 'system', content: systemPrompt },
                { role: 'user', content: prompt },
            ],
            temperature: 0.7,
            max_tokens: 1024,
        }, {
            headers: {
                'Authorization': `Bearer ${this.apiKey}`,
                'Content-Type': 'application/json',
            },
            timeout: 15000,
        });
        return response.data.choices[0].message.content;
    }

    async embed(text) {
        throw new Error('Groq no soporta embeddings');
    }
}

module.exports = GroqProvider;
