/**
 * AI Provider con Failover Automático
 * OCP: Nuevos proveedores se agregan como estrategias sin modificar el orquestador
 * DIP: Implementa IAIService del dominio
 *
 * Estrategia de failover (chain):
 *   1. Groq (más rápido, gratis)
 *   2. NVIDIA NIM (gratis, 100+ modelos)
 *   3. Gemini (gratis, 1M contexto)
 *   4. Ollama local (último recurso)
 *   5. Respuesta offline (fallback final)
 */
class AIProviderWithFailover {
    constructor({ providers, log }) {
        this.providers = providers; // Array de { name, provider: IAIService }
        this.log = log?.child({ service: 'AIProviderWithFailover' });
        this._metrics = { attempts: 0, failures: 0, fallbacks: 0 };
    }

    async generate(prompt, systemPrompt) {
        const start = Date.now();
        let lastError = null;

        for (const { name, provider } of this.providers) {
            try {
                this._metrics.attempts++;
                this.log?.debug(`intentando proveedor: ${name}`);
                const result = await provider.generate(prompt, systemPrompt);
                this.log?.info(`✅ IA generada con: ${name}`, { durationMs: Date.now() - start });
                return result;
            } catch (err) {
                this._metrics.failures++;
                this._metrics.fallbacks++;
                lastError = err;
                this.log?.warn(`⚠️ proveedor ${name} falló, failover → siguiente`, {
                    err: err.message,
                    failoverIndex: this.providers.indexOf({ name, provider }),
                });
            }
        }

        // Todos los proveedores fallaron
        this.log?.error('❌ TODOS los proveedores IA fallaron', {
            attempts: this._metrics.attempts,
            lastError: lastError?.message,
        });
        return this._getOfflineResponse(prompt);
    }

    async embed(text) {
        // Intentar con el primer proveedor que soporte embeddings
        for (const { name, provider } of this.providers) {
            if (typeof provider.embed === 'function') {
                try {
                    return await provider.embed(text);
                } catch {
                    this.log?.warn(`embedding falló en ${name}, siguiente`);
                }
            }
        }
        throw new Error('No hay proveedor de embeddings disponible');
    }

    _getOfflineResponse(prompt) {
        const offlineResponses = [
            'Estoy teniendo problemas de conexión con mis servicios de inteligencia artificial. Por favor, intenta de nuevo en unos momentos.',
            'Lo siento, no puedo procesar tu solicitud en este momento. Mis sistemas de IA están temporalmente no disponibles.',
            '¡Ups! Parece que mis circuitos están sobrecargados. ¿Puedes repetir tu mensaje en un minuto?',
        ];
        const idx = Math.floor(Math.random() * offlineResponses.length);
        return offlineResponses[idx];
    }

    getMetrics() {
        return { ...this._metrics, availableProviders: this.providers.map(p => p.name) };
    }
}

module.exports = AIProviderWithFailover;
