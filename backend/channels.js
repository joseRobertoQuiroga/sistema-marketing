require('dotenv').config();
const express = require('express');
const router = express.Router();
const crypto = require('crypto');

// Importar adaptadores de plataforma
const MetaAdapter = require('./adapters/metaAdapter');
const TikTokAdapter = require('./adapters/tiktokAdapter');
const LinkedInAdapter = require('./adapters/linkedinAdapter');

// ================================================================
// ALMACENAMIENTO EN MEMORIA (Reemplazar por DB en producción real)
// Para migrar a PostgreSQL: usar la tabla `social_connections`
// ================================================================
let connections = [
    {
        id: 'conn-1',
        platform: 'instagram',
        account_name: '@tienda_oficial',
        status: 'connected',
        expires_at: new Date(Date.now() + 50 * 86400000).toISOString(), // 50 días
        connected_at: new Date().toISOString()
    },
    {
        id: 'conn-2',
        platform: 'facebook',
        account_name: 'Tienda Oficial FB',
        status: 'connected',
        expires_at: new Date(Date.now() + 3 * 86400000).toISOString(), // 3 días (simula token próximo a expirar)
        connected_at: new Date().toISOString()
    }
];

// ================================================================
// ENDPOINTS DE GESTIÓN DE CANALES
// ================================================================

/** Lista todos los canales conectados + alerta si algún token expira pronto */
router.get('/', (req, res) => {
    const enriched = connections.map(conn => {
        const expiresAt = new Date(conn.expires_at);
        const daysLeft = Math.round((expiresAt - Date.now()) / 86400000);
        return {
            ...conn,
            days_until_expiry: daysLeft,
            expiry_warning: daysLeft <= 7
        };
    });
    res.json({ channels: enriched });
});

/** Conexión manual via App ID / App Secret (modo fallback para desarrollo) */
router.post('/connect', (req, res) => {
    const { platform, app_id, app_secret } = req.body;

    if (!platform || !app_id || !app_secret) {
        return res.status(400).json({ error: 'Se requieren: platform, app_id, app_secret' });
    }
    if (connections.some(c => c.platform === platform)) {
        return res.status(400).json({ error: `La plataforma '${platform}' ya está conectada.` });
    }

    const newConnection = {
        id: `conn-${crypto.randomUUID()}`,
        platform,
        account_name: `Cuenta ${platform.charAt(0).toUpperCase() + platform.slice(1)}`,
        status: 'connected',
        expires_at: new Date(Date.now() + 60 * 86400000).toISOString(),
        connected_at: new Date().toISOString()
    };

    connections.push(newConnection);
    res.json({ success: true, connection: newConnection });
});

/** Desconectar un canal */
router.delete('/:id', (req, res) => {
    const { id } = req.params;
    const prev = connections.length;
    connections = connections.filter(c => c.id !== id);
    if (connections.length === prev) {
        return res.status(404).json({ error: 'Conexión no encontrada.' });
    }
    res.json({ success: true });
});

// ================================================================
// FLUJOS OAUTH REALES (Activados cuando el .env tiene credenciales)
// ================================================================

/** Inicia el flujo OAuth para una plataforma */
router.get('/oauth/:platform/init', (req, res) => {
    const { platform } = req.params;
    const state = crypto.randomBytes(16).toString('hex');
    let authUrl;

    try {
        if (platform === 'meta') authUrl = MetaAdapter.getAuthUrl(state);
        else if (platform === 'tiktok') authUrl = TikTokAdapter.getAuthUrl(state);
        else if (platform === 'linkedin') authUrl = LinkedInAdapter.getAuthUrl(state);
        else return res.status(400).json({ error: `Plataforma '${platform}' no soportada.` });

        // Verificar si hay credenciales configuradas
        if (!authUrl || authUrl.includes('undefined')) {
            return res.status(503).json({
                error: 'Credenciales no configuradas.',
                message: `Agrega META_APP_ID, META_APP_SECRET etc. al archivo .env para activar el OAuth de ${platform}.`
            });
        }

        res.json({ auth_url: authUrl, state });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

/** Recibe el callback de OAuth y guarda el token */
router.get('/oauth/meta/callback', async (req, res) => {
    const { code, error } = req.query;
    if (error) return res.status(400).json({ error });

    try {
        const tokenData = await MetaAdapter.exchangeCodeForLongLivedToken(code);
        const newConnection = {
            id: `conn-${crypto.randomUUID()}`,
            platform: 'meta',
            account_name: 'Cuenta Meta (Autenticada)',
            // access_token: tokenData.access_token, // ⚠️ En producción: cifrar y guardar en BD
            status: 'connected',
            expires_at: new Date(Date.now() + (tokenData.expires_in * 1000)).toISOString(),
            connected_at: new Date().toISOString()
        };
        connections.push(newConnection);
        res.redirect('http://localhost:5173/settings?connected=meta');
    } catch (err) {
        console.error('[OAuth/Meta] Error en callback:', err.message);
        res.status(500).json({ error: 'Error al intercambiar token con Meta API.' });
    }
});

router.get('/oauth/tiktok/callback', async (req, res) => {
    const { code, error } = req.query;
    if (error) return res.status(400).json({ error });

    try {
        const tokenData = await TikTokAdapter.exchangeCodeForToken(code);
        const newConnection = {
            id: `conn-${crypto.randomUUID()}`,
            platform: 'tiktok',
            account_name: 'Cuenta TikTok (Autenticada)',
            status: 'connected',
            expires_at: new Date(Date.now() + (tokenData.expires_in * 1000)).toISOString(),
            connected_at: new Date().toISOString()
        };
        connections.push(newConnection);
        res.redirect('http://localhost:5173/settings?connected=tiktok');
    } catch (err) {
        console.error('[OAuth/TikTok] Error en callback:', err.message);
        res.status(500).json({ error: 'Error al intercambiar token con TikTok API.' });
    }
});

router.get('/oauth/linkedin/callback', async (req, res) => {
    const { code, error } = req.query;
    if (error) return res.status(400).json({ error });

    try {
        const tokenData = await LinkedInAdapter.exchangeCodeForToken(code);
        const newConnection = {
            id: `conn-${crypto.randomUUID()}`,
            platform: 'linkedin',
            account_name: 'Página LinkedIn (Autenticada)',
            status: 'connected',
            expires_at: new Date(Date.now() + (tokenData.expires_in * 1000)).toISOString(),
            connected_at: new Date().toISOString()
        };
        connections.push(newConnection);
        res.redirect('http://localhost:5173/settings?connected=linkedin');
    } catch (err) {
        console.error('[OAuth/LinkedIn] Error en callback:', err.message);
        res.status(500).json({ error: 'Error al intercambiar token con LinkedIn API.' });
    }
});

module.exports = router;
