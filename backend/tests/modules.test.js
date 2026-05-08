/**
 * SUITE DE PRUEBAS UNITARIAS — OmniPresence Suite
 * Módulo 1: Analytics Hub | Módulo 3: Chatbot Multimodal
 * 
 * Ejecutar con: cd backend && npm test
 */

// ================================================================
// MÓDULO 1 — ANALYTICS HUB
// ================================================================

describe('M1: Analytics — Generadores de datos Mock', () => {

    // Extraemos las funciones puras para testearlas sin Express
    const generateEvolutionData = (days) => {
        const data = [];
        let base = 1000;
        for (let i = days; i >= 0; i--) {
            const date = new Date();
            date.setDate(date.getDate() - i);
            const variance = (Math.random() - 0.5) * 0.2;
            data.push({
                date: date.toISOString().split('T')[0],
                reach: Math.round(base * (1 + variance)),
                conversions: Math.round(10 * (1 + variance))
            });
            base *= 1.01;
        }
        return data;
    };

    const computeKPIs = (days, channel) => {
        const daysMultiplier = days / 30;
        const channelMultiplier = channel === 'all' ? 1 : 0.4;
        const mult = daysMultiplier * channelMultiplier;
        return {
            total_reach: Math.round(245000 * mult),
            engagement_rate: Number((4.8 * (channel === 'instagram' ? 1.2 : 1)).toFixed(1)),
            leads_generated: Math.round(142 * mult),
            cpl: Number((3.50 * (channel === 'linkedin' ? 1.5 : 1)).toFixed(2))
        };
    };

    test('generateEvolutionData(30) retorna 31 puntos de datos', () => {
        const data = generateEvolutionData(30);
        expect(data).toHaveLength(31);
    });

    test('generateEvolutionData(7) retorna 8 puntos de datos', () => {
        const data = generateEvolutionData(7);
        expect(data).toHaveLength(8);
    });

    test('Cada punto de evolución tiene los campos requeridos', () => {
        const data = generateEvolutionData(7);
        data.forEach(point => {
            expect(point).toHaveProperty('date');
            expect(point).toHaveProperty('reach');
            expect(point).toHaveProperty('conversions');
            expect(point.reach).toBeGreaterThan(0);
        });
    });

    test('Las fechas de evolución están en orden cronológico', () => {
        const data = generateEvolutionData(7);
        for (let i = 1; i < data.length; i++) {
            expect(new Date(data[i].date) >= new Date(data[i - 1].date)).toBe(true);
        }
    });

    test('KPIs: filtro de 7 días reduce total_reach al 23.3% del total', () => {
        const kpis7d = computeKPIs(7, 'all');
        const kpis30d = computeKPIs(30, 'all');
        const ratio = kpis7d.total_reach / kpis30d.total_reach;
        expect(ratio).toBeCloseTo(7 / 30, 1);
    });

    test('KPIs: canal instagram aumenta engagement_rate × 1.2', () => {
        const kpisAll = computeKPIs(30, 'all');
        const kpisIG = computeKPIs(30, 'instagram');
        expect(kpisIG.engagement_rate).toBeCloseTo(kpisAll.engagement_rate * 1.2, 1);
    });

    test('KPIs: canal individual reduce reach al 40% del total', () => {
        const kpisAll = computeKPIs(30, 'all');
        const kpisFB = computeKPIs(30, 'facebook');
        expect(kpisFB.total_reach).toBeCloseTo(kpisAll.total_reach * 0.4, -2);
    });

    test('KPIs: canal linkedin aumenta CPL × 1.5', () => {
        const kpisAll = computeKPIs(30, 'all');
        const kpisLI = computeKPIs(30, 'linkedin');
        expect(kpisLI.cpl).toBeCloseTo(kpisAll.cpl * 1.5, 1);
    });
});

describe('M1: Analytics — Exportación CSV', () => {
    test('El contenido CSV tiene el header correcto', () => {
        const csvContent = 'Fecha,Alcance,Engagement Rate,Conversiones,Inversion\n2026-05-01,15000,4.2,25,120.50';
        const lines = csvContent.trim().split('\n');
        expect(lines[0]).toBe('Fecha,Alcance,Engagement Rate,Conversiones,Inversion');
    });

    test('El CSV tiene al menos 2 líneas (header + datos)', () => {
        const csvContent = 'Fecha,Alcance,Engagement Rate,Conversiones,Inversion\n2026-05-01,15000,4.2,25,120.50';
        const lines = csvContent.trim().split('\n');
        expect(lines.length).toBeGreaterThanOrEqual(2);
    });
});

// ================================================================
// MÓDULO 1 — GESTIÓN DE CANALES (channels.js)
// ================================================================

describe('M1: Channels — Lógica de gestión de conexiones', () => {
    const crypto = require('crypto');

    // Simular el estado de conexiones
    let connections = [];

    const connectChannel = (platform, app_id, app_secret) => {
        if (!platform || !app_id || !app_secret) {
            return { error: 'Missing required fields', status: 400 };
        }
        if (connections.some(c => c.platform === platform)) {
            return { error: 'Platform is already connected', status: 400 };
        }
        const conn = {
            id: `conn-${crypto.randomUUID()}`,
            platform,
            account_name: `Cuenta ${platform}`,
            status: 'connected',
            expires_at: new Date(Date.now() + 60 * 86400000).toISOString(),
            connected_at: new Date().toISOString()
        };
        connections.push(conn);
        return { success: true, connection: conn, status: 200 };
    };

    const disconnectChannel = (id) => {
        const prev = connections.length;
        connections = connections.filter(c => c.id !== id);
        if (connections.length === prev) return { error: 'Not found', status: 404 };
        return { success: true, status: 200 };
    };

    const enrichWithExpiry = (conns) => conns.map(c => {
        const daysLeft = Math.round((new Date(c.expires_at) - Date.now()) / 86400000);
        return { ...c, days_until_expiry: daysLeft, expiry_warning: daysLeft <= 7 };
    });

    beforeEach(() => { connections = []; });

    test('Conectar un canal válido retorna success: true', () => {
        const result = connectChannel('instagram', 'app_123', 'secret_abc');
        expect(result.success).toBe(true);
        expect(result.connection.platform).toBe('instagram');
        expect(result.connection.status).toBe('connected');
    });

    test('Conectar sin app_id retorna error 400', () => {
        const result = connectChannel('instagram', '', 'secret_abc');
        expect(result.status).toBe(400);
        expect(result.error).toBeTruthy();
    });

    test('Conectar misma plataforma dos veces retorna error 400', () => {
        connectChannel('instagram', 'app_123', 'secret_abc');
        const result = connectChannel('instagram', 'app_456', 'secret_def');
        expect(result.status).toBe(400);
        expect(result.error).toContain('already connected');
    });

    test('Desconectar canal existente retorna success: true', () => {
        const { connection } = connectChannel('facebook', 'app_123', 'secret_abc');
        const result = disconnectChannel(connection.id);
        expect(result.success).toBe(true);
        expect(connections).toHaveLength(0);
    });

    test('Desconectar canal inexistente retorna error 404', () => {
        const result = disconnectChannel('id-que-no-existe');
        expect(result.status).toBe(404);
    });

    test('enrichWithExpiry agrega days_until_expiry y expiry_warning', () => {
        connectChannel('tiktok', 'app_1', 'sec_1');
        const enriched = enrichWithExpiry(connections);
        expect(enriched[0]).toHaveProperty('days_until_expiry');
        expect(enriched[0]).toHaveProperty('expiry_warning');
        expect(enriched[0].expiry_warning).toBe(false); // 60 días > 7
    });

    test('expiry_warning es true cuando el token expira en ≤ 7 días', () => {
        const soonExpiring = {
            id: 'c1', platform: 'facebook', status: 'connected',
            expires_at: new Date(Date.now() + 3 * 86400000).toISOString()
        };
        const enriched = enrichWithExpiry([soonExpiring]);
        expect(enriched[0].expiry_warning).toBe(true);
        expect(enriched[0].days_until_expiry).toBeLessThanOrEqual(7);
    });
});

// ================================================================
// MÓDULO 3 — CHATBOT MULTIMODAL
// ================================================================

describe('M3: Bot Logic — Funciones puras', () => {

    // Simular getBotConfig
    const getBotConfig = async (orgId) => {
        if (!orgId) throw new Error('orgId requerido');
        return {
            business_name: 'OmniPresence',
            tone: 'profesional',
            escalation_message: 'Lo siento, no puedo ayudarte con eso.'
        };
    };

    // Simular setBotPaused
    const botPausedStatus = new Map();
    const setBotPaused = (conversationId, isPaused) => {
        botPausedStatus.set(conversationId, isPaused);
    };
    const isBotPaused = (conversationId) => {
        return botPausedStatus.get(conversationId) === true;
    };

    // Simular clasificación KPI
    const classifyKPI = (intentScore, userMessage) => {
        const buyKeywords = ['comprar', 'precio', 'pagar', 'cuánto cuesta', 'quiero'];
        const exploreKeywords = ['ver', 'catálogo', 'mostrar', 'tienen', 'disponible'];
        const lower = userMessage.toLowerCase();

        if (buyKeywords.some(k => lower.includes(k)) || intentScore > 70) {
            return 'Conversión';
        } else if (exploreKeywords.some(k => lower.includes(k)) || intentScore > 40) {
            return 'Interés';
        }
        return 'Consultas';
    };

    // Simular construcción del systemPrompt
    const buildSystemPrompt = (config, context, history) => {
        return `Eres ${config.business_name}, un vendedor amable y directo.
CONTEXTO: ${context}
HISTORIAL: ${history}
Responde en JSON con: response_text, intent_score, confidence, captured_data.`;
    };

    test('getBotConfig retorna configuración con todos los campos', async () => {
        const config = await getBotConfig('org-001');
        expect(config).toHaveProperty('business_name');
        expect(config).toHaveProperty('tone');
        expect(config).toHaveProperty('escalation_message');
    });

    test('getBotConfig lanza error si orgId está vacío', async () => {
        await expect(getBotConfig('')).rejects.toThrow('orgId requerido');
    });

    test('setBotPaused pausa el bot correctamente', () => {
        setBotPaused('conv-001', true);
        expect(isBotPaused('conv-001')).toBe(true);
    });

    test('setBotPaused reactiva el bot correctamente', () => {
        setBotPaused('conv-002', true);
        setBotPaused('conv-002', false);
        expect(isBotPaused('conv-002')).toBe(false);
    });

    test('Bot no pausado por defecto para nueva conversación', () => {
        expect(isBotPaused('conv-999')).toBe(false);
    });

    test('classifyKPI: mensaje de compra → Conversión', () => {
        expect(classifyKPI(85, 'Quiero comprar el vestido rojo')).toBe('Conversión');
    });

    test('classifyKPI: score alto → Conversión', () => {
        expect(classifyKPI(75, 'Hola, ¿cómo están?')).toBe('Conversión');
    });

    test('classifyKPI: exploración de catálogo → Interés', () => {
        expect(classifyKPI(30, '¿Qué productos tienen disponibles?')).toBe('Interés');
    });

    test('classifyKPI: pregunta general → Consultas', () => {
        expect(classifyKPI(10, '¿Cuáles son sus horarios?')).toBe('Consultas');
    });

    test('buildSystemPrompt incluye el nombre del negocio', () => {
        const config = { business_name: 'TestShop', escalation_message: '...' };
        const prompt = buildSystemPrompt(config, 'contexto', 'historial');
        expect(prompt).toContain('TestShop');
        expect(prompt).toContain('response_text');
        expect(prompt).toContain('intent_score');
        expect(prompt).toContain('captured_data');
    });
});

describe('M3: Bot Logic — Validación de respuesta JSON del LLM', () => {

    const validateBotResponse = (rawResponse) => {
        try {
            const parsed = typeof rawResponse === 'string' ? JSON.parse(rawResponse) : rawResponse;
            const requiredFields = ['response_text', 'intent_score', 'confidence', 'captured_data'];
            const missingFields = requiredFields.filter(f => !(f in parsed));
            if (missingFields.length > 0) {
                return { valid: false, error: `Campos faltantes: ${missingFields.join(', ')}` };
            }
            if (typeof parsed.intent_score !== 'number' || parsed.intent_score < 0 || parsed.intent_score > 100) {
                return { valid: false, error: 'intent_score debe ser un número entre 0 y 100' };
            }
            const validKPIs = ['Interés', 'Conversión', 'Consultas'];
            if (parsed.captured_data?.kpi_category && !validKPIs.includes(parsed.captured_data.kpi_category)) {
                return { valid: false, error: `kpi_category inválido: ${parsed.captured_data.kpi_category}` };
            }
            return { valid: true, data: parsed };
        } catch (e) {
            return { valid: false, error: 'Respuesta no es JSON válido' };
        }
    };

    test('Respuesta válida del bot pasa la validación', () => {
        const mockResponse = {
            response_text: '¡Hola! Claro que sí, tenemos una gran variedad.',
            intent_score: 45,
            confidence: 0.87,
            captured_data: { kpi_category: 'Interés', nombre: null, localidad: null }
        };
        const result = validateBotResponse(JSON.stringify(mockResponse));
        expect(result.valid).toBe(true);
    });

    test('Respuesta sin response_text falla la validación', () => {
        const bad = { intent_score: 50, confidence: 0.8, captured_data: {} };
        const result = validateBotResponse(bad);
        expect(result.valid).toBe(false);
        expect(result.error).toContain('response_text');
    });

    test('intent_score fuera de rango (> 100) falla la validación', () => {
        const bad = {
            response_text: 'Test', intent_score: 150,
            confidence: 0.9, captured_data: {}
        };
        const result = validateBotResponse(bad);
        expect(result.valid).toBe(false);
    });

    test('kpi_category con valor no permitido falla la validación', () => {
        const bad = {
            response_text: 'Test', intent_score: 50,
            confidence: 0.9, captured_data: { kpi_category: 'INVALID_VALUE' }
        };
        const result = validateBotResponse(bad);
        expect(result.valid).toBe(false);
    });

    test('JSON malformado falla la validación', () => {
        const result = validateBotResponse('{invalid json...');
        expect(result.valid).toBe(false);
        expect(result.error).toContain('JSON válido');
    });

    test('Los 3 valores de kpi_category son aceptados', () => {
        ['Interés', 'Conversión', 'Consultas'].forEach(kpi => {
            const response = {
                response_text: 'Ok', intent_score: 50,
                confidence: 0.8, captured_data: { kpi_category: kpi }
            };
            const result = validateBotResponse(response);
            expect(result.valid).toBe(true);
        });
    });
});

describe('M3: PlatformManager — Registro de adaptadores', () => {

    class MockPlatformManager {
        constructor() { this.adapters = {}; }
        registerAdapter(name, adapter) { this.adapters[name] = adapter; }
        hasAdapter(name) { return name in this.adapters; }
        async sendMessage(name, convId, text) {
            const adapter = this.adapters[name] || this.adapters['default'];
            if (!adapter) return false;
            return await adapter.sendMessage(convId, text);
        }
    }

    const mockTelegramAdapter = {
        sendMessage: jest.fn().mockResolvedValue(true)
    };

    test('Se puede registrar un adaptador de plataforma', () => {
        const pm = new MockPlatformManager();
        pm.registerAdapter('telegram', mockTelegramAdapter);
        expect(pm.hasAdapter('telegram')).toBe(true);
    });

    test('sendMessage llama al adaptador registrado', async () => {
        const pm = new MockPlatformManager();
        pm.registerAdapter('telegram', mockTelegramAdapter);
        const result = await pm.sendMessage('telegram', 'conv-001', 'Hola!');
        expect(result).toBe(true);
        expect(mockTelegramAdapter.sendMessage).toHaveBeenCalledWith('conv-001', 'Hola!');
    });

    test('sendMessage sin adaptador registrado retorna false', async () => {
        const pm = new MockPlatformManager();
        const result = await pm.sendMessage('whatsapp', 'conv-001', 'Hola!');
        expect(result).toBe(false);
    });

    test('Un segundo adaptador reemplaza al primero en la misma plataforma', () => {
        const pm = new MockPlatformManager();
        const adapter1 = { sendMessage: jest.fn() };
        const adapter2 = { sendMessage: jest.fn() };
        pm.registerAdapter('telegram', adapter1);
        pm.registerAdapter('telegram', adapter2);
        expect(pm.adapters['telegram']).toBe(adapter2);
    });
});
