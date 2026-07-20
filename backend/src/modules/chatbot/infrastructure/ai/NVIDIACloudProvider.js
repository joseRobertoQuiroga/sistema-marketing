const axios = require('axios');

/**
 * Proveedor IA: NVIDIA NIM
 * Implementa IAIService
 * Gratis: 1,000-5,000 créditos, 40 RPM
 * Endpoint: https://integrate.api.nvidia.com/v1/chat/completions
 * OpenAI-compatible SDK
 */
class NVIDIACloudProvider {
    constructor() {
        this.apiKey = process.env.NVIDIA_API_KEY;
        this.baseUrl = 'https://integrate.api.nvidia.com/v1/chat/completions';
        this.model = process.env.NVIDIA_MODEL || 'meta/llama-3.3-70b-instruct';
    }

    async generate(prompt, systemPrompt = 'Eres un asistente útil.') {
        const response = await axios.post(this.baseUrl, {
            model: this.model,
            messages: [
                { role: 'system', content: systemPrompt },
                { role: 'user', content: prompt },
            ],
            temperature: 0.5,
            max_tokens: 1024,
        }, {
            headers: {
                'Authorization': `Bearer ${this.apiKey}`,
                'Content-Type': 'application/json',
            },
            timeout: 20000,
        });
        return response.data.choices[0].message.content;
    }

    async embed(text) {
        // NVIDIA tiene modelos de embeddings: nvidia/nv-embed-qa-4
        const response = await axios.post('https://integrate.api.nvidia.com/v1/embeddings', {
            model: 'nvidia/nv-embed-qa-4',
            input: text,
        }, {
            headers: {
                'Authorization': `Bearer ${this.apiKey}`,
                'Content-Type': 'application/json',
            },
            timeout: 10000,
        });
        return response.data.data[0].embedding;
    }
}

module.exports = NVIDIACloudProvider;
