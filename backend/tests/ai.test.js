jest.mock('axios');
const axios = require('axios');
const OllamaAIService = require('../src/infrastructure/ai/OllamaAIService');

describe('AI Service: Ollama', () => {
    let aiService;

    beforeAll(() => {
        aiService = new OllamaAIService();
    });

    beforeEach(() => {
        axios.post.mockReset();
    });

    test('embed retorna vector desde Ollama', async () => {
        axios.post.mockResolvedValue({ data: { embedding: [0.1, 0.2, 0.3] } });
        const result = await aiService.embed('test query');
        expect(Array.isArray(result)).toBe(true);
        expect(result).toEqual([0.1, 0.2, 0.3]);
    });

    test('generate retorna objeto parseado desde Ollama', async () => {
        const mockResponse = { response_text: 'Hola', intent_score: 50, captured_data: {} };
        axios.post.mockResolvedValue({ data: { response: JSON.stringify(mockResponse) } });
        const result = await aiService.generate('Hola', 'System prompt');
        expect(result.response_text).toBe('Hola');
        expect(result.intent_score).toBe(50);
    });
});
