const logger = require('../../infrastructure/utils/logger');

class AuthController {
    constructor({ authenticateUseCase }) {
        this.authenticateUseCase = authenticateUseCase;
    }

    async handleRegister(req, res) {
        try {
            const { email, password, name, orgName, industry, timezone } = req.body;
            if (!email || !password || !name || !orgName) {
                return res.status(400).json({
                    error: { code: 'VALIDATION_ERROR', message: 'email, password, name y orgName son requeridos' }
                });
            }
            if (password.length < 6) {
                return res.status(400).json({
                    error: { code: 'VALIDATION_ERROR', message: 'La contraseña debe tener al menos 6 caracteres' }
                });
            }
            const result = await this.authenticateUseCase.register({ email, password, name, orgName, industry, timezone });
            res.status(201).json(result);
        } catch (err) {
            if (err.message === 'EMAIL_TAKEN') {
                return res.status(409).json({
                    error: { code: 'VALIDATION_ERROR', message: 'Este email ya está registrado' }
                });
            }
            logger.error({ err }, 'Error en register');
            res.status(500).json({
                error: { code: 'INTERNAL_ERROR', message: 'Error al crear la cuenta' }
            });
        }
    }

    async handleLogin(req, res) {
        try {
            const { email, password } = req.body;
            if (!email || !password) {
                return res.status(400).json({
                    error: { code: 'VALIDATION_ERROR', message: 'email y password son requeridos' }
                });
            }
            const result = await this.authenticateUseCase.login({ email, password });
            res.json(result);
        } catch (err) {
            if (err.message === 'INVALID_CREDENTIALS') {
                return res.status(401).json({
                    error: { code: 'UNAUTHORIZED', message: 'Email o contraseña incorrectos' }
                });
            }
            logger.error({ err }, 'Error en login');
            res.status(500).json({
                error: { code: 'INTERNAL_ERROR', message: 'Error al iniciar sesión' }
            });
        }
    }

    async handleRefresh(req, res) {
        try {
            const { refreshToken } = req.body;
            if (!refreshToken) {
                return res.status(400).json({
                    error: { code: 'VALIDATION_ERROR', message: 'refreshToken es requerido' }
                });
            }
            const result = await this.authenticateUseCase.refresh(refreshToken);
            res.json(result);
        } catch (err) {
            if (err.message === 'INVALID_REFRESH_TOKEN') {
                return res.status(401).json({
                    error: { code: 'SESSION_EXPIRED', message: 'Sesión expirada. Inicia sesión nuevamente.' }
                });
            }
            logger.error({ err }, 'Error en refresh');
            res.status(500).json({
                error: { code: 'INTERNAL_ERROR', message: 'Error al refrescar sesión' }
            });
        }
    }

    async handleLogout(req, res) {
        try {
            const { refreshToken } = req.body;
            await this.authenticateUseCase.logout(refreshToken);
            res.json({ success: true });
        } catch (err) {
            logger.error({ err }, 'Error en logout');
            res.json({ success: true });
        }
    }
}

module.exports = AuthController;
