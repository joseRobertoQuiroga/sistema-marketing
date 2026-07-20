/**
 * Factory de Adaptadores de Plataforma
 * OCP: Nuevas plataformas se registran sin modificar esta clase
 * SRP: Una sola responsabilidad — gestionar el ciclo de vida de adaptadores
 *
 * Uso:
 *   const factory = new PlatformAdapterFactory({ log });
 *   factory.register('telegram', TelegramAdapter);
 *   factory.register('whatsapp', WhatsAppAdapter);
 *   const adapter = factory.get('telegram');
 *   await adapter.sendMessage('123', 'Hola');
 */
class PlatformAdapterFactory {
    constructor({ log } = {}) {
        this._registry = new Map();
        this._instances = new Map();
        this.log = log?.child({ service: 'PlatformAdapterFactory' });
    }

    /**
     * Registra un adaptador de plataforma
     * @param {string} name - Nombre único (telegram, whatsapp, messenger, tiktok)
     * @param {Class} AdapterClass - Clase que implementa IPlatformAdapter
     * @param {Object} [options] - Opciones de configuración del adaptador
     */
    register(name, AdapterClass, options = {}) {
        if (this._registry.has(name)) {
            this.log?.warn(`plataforma "${name}" ya registrada — sobrescribiendo`);
        }
        this._registry.set(name, { AdapterClass, options });
        this.log?.info(`✅ plataforma registrada: ${name}`);
        return this;
    }

    /**
     * Obtiene una instancia del adaptador (singleton por nombre)
     */
    get(name) {
        if (this._instances.has(name)) {
            return this._instances.get(name);
        }
        const entry = this._registry.get(name);
        if (!entry) {
            throw new Error(`Adaptador no encontrado para plataforma: "${name}". Registradas: ${this.getRegistered().join(', ')}`);
        }
        const instance = new entry.AdapterClass(entry.options);
        this._instances.set(name, instance);
        return instance;
    }

    /** Lista de plataformas registradas */
    getRegistered() {
        return Array.from(this._registry.keys());
    }

    /** Envía mensaje a través del adaptador correspondiente */
    async sendMessage(platform, conversationId, text, options = {}) {
        const adapter = this.get(platform);
        const start = Date.now();
        try {
            const result = await adapter.sendMessage(conversationId, text, options);
            this.log?.info('mensaje enviado', { platform, durationMs: Date.now() - start });
            return result;
        } catch (err) {
            this.log?.error('error enviando mensaje', { platform, err: err.message, durationMs: Date.now() - start });
            throw err;
        }
    }

    /** Envía mensaje a través de TODAS las plataformas registradas */
    async broadcast(conversationId, text, options = {}) {
        const results = [];
        for (const name of this.getRegistered()) {
            try {
                await this.sendMessage(name, conversationId, text, options);
                results.push({ platform: name, success: true });
            } catch {
                results.push({ platform: name, success: false });
            }
        }
        return results;
    }
}

module.exports = PlatformAdapterFactory;
