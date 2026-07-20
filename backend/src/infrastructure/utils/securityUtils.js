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
    if (!message) return { sanitized: '', isInjectionAttempt: false };

    const isInjectionAttempt = INJECTION_PATTERNS.some(p => p.test(message));

    const sanitized = message
        .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '')
        .replace(/<[^>]*>?/gm, '')
        .replace(/javascript:/gi, '')
        .trim()
        .slice(0, 2000);

    return { sanitized, isInjectionAttempt };
}

module.exports = { sanitizeUserMessage };
