const crypto = require('crypto');

/**
 * 1. Verificación de Webhooks (Meta/Facebook/Instagram)
 * Según SKILL_01 §4
 */
function verifyMetaWebhook(req, res, next) {
    const signature = req.headers['x-hub-signature-256'];
    if (!signature) {
        console.warn('⚠️ Webhook sin firma detectado');
        return res.status(401).send('Falta firma');
    }

    const expectedSignature = crypto
        .createHmac('sha256', process.env.META_APP_SECRET || 'secret_mock')
        .update(req.rawBody) // Asume que el body crudo está disponible
        .digest('hex');

    const receivedSignature = signature.replace('sha256=', '');

    try {
        if (!crypto.timingSafeEqual(Buffer.from(expectedSignature, 'hex'), Buffer.from(receivedSignature, 'hex'))) {
            return res.status(401).send('Firma inválida');
        }
        next();
    } catch (e) {
        return res.status(401).send('Error de verificación');
    }
}

/**
 * 2. Sanitización de Mensajes (Anti Prompt Injection)
 * Según SKILL_05 §7 y SKILL_01 §14
 */
const INJECTION_PATTERNS = [
    /ignora (.*)instrucciones/i,
    /olvida (.*)(contexto|reglas|instrucciones)/i,
    /actúa como/i,
    /eres ahora/i,
    /nuevo (sistema|prompt|rol)/i,
    /\[SYSTEM\]/i,
    /\[INSTRUCCIÓN\]/i,
    /modo (developer|dev|admin|god)/i,
    /revela (.*)(prompt|system|instrucciones)/i,
    /ignore (.*)instructions/i,
];

function sanitizeUserMessage(message) {
    if (!message) return { sanitized: "", isInjectionAttempt: false };

    const isInjectionAttempt = INJECTION_PATTERNS.some(p => p.test(message));

    const sanitized = message
        .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '') // caracteres de control
        .replace(/<[^>]*>?/gm, '') // Eliminar tags HTML (mejorado)
        .replace(/javascript:/gi, '')
        .trim()
        .slice(0, 2000); // longitud máxima

    return { sanitized, isInjectionAttempt };
}

/**
 * 3. Aislamiento Multi-tenant (Middleware mock)
 * Según SKILL_01 §1
 */
function tenantIsolation(req, res, next) {
    // En producción, extraer del JWT
    const orgId = req.headers['x-org-id'] || '00000000-0000-0000-0000-000000000000';
    req.orgId = orgId;
    next();
}

module.exports = {
    verifyMetaWebhook,
    sanitizeUserMessage,
    tenantIsolation
};
