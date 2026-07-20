const REQUIRED_ENV_VARS = [
    'DATABASE_URL',
    'JWT_SECRET',
    'ALLOWED_ORIGINS',
];

function validateEnv() {
    const missing = REQUIRED_ENV_VARS.filter(v => !process.env[v]);
    if (missing.length > 0) {
        throw new Error(`Faltan variables de entorno requeridas: ${missing.join(', ')}`);
    }

    if (process.env.JWT_SECRET && process.env.JWT_SECRET.length < 64) {
        throw new Error('JWT_SECRET debe tener al menos 64 caracteres hex (32 bytes)');
    }

    if (process.env.TOKEN_ENCRYPTION_KEY && process.env.TOKEN_ENCRYPTION_KEY.length < 64) {
        throw new Error('TOKEN_ENCRYPTION_KEY debe tener al menos 64 caracteres hex (32 bytes)');
    }
}

function getAllowedOrigins() {
    return (process.env.ALLOWED_ORIGINS || 'http://localhost:5173').split(',').map(s => s.trim());
}

module.exports = { validateEnv, getAllowedOrigins };
