process.env.JWT_SECRET = 'test-secret-64-chars-minimum-for-testing-purposes-only!!!!!!!';
process.env.ALLOWED_ORIGINS = 'http://localhost:5173,http://localhost:3000';

const { authenticate, requireRole } = require('../../src/api/middleware/auth');
const { getAllowedOrigins } = require('../../src/config/env');

describe('FASE 0 — Seguridad', () => {

    describe('SEC-0.4: authenticate sin JWT retorna 401', () => {
        test('sin header Authorization', () => {
            const req = { headers: {} };
            const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
            authenticate(req, res, jest.fn());
            expect(res.status).toHaveBeenCalledWith(401);
            expect(res.json).toHaveBeenCalledWith(
                expect.objectContaining({ error: expect.objectContaining({ code: 'UNAUTHORIZED' }) })
            );
        });

        test('header sin formato Bearer', () => {
            const req = { headers: { authorization: 'Basic xyz' } };
            const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
            authenticate(req, res, jest.fn());
            expect(res.status).toHaveBeenCalledWith(401);
        });
    });

    describe('SEC-0.5: JWT inválido retorna 401', () => {
        test('token alterado (firma inválida)', () => {
            const req = { headers: { authorization: 'Bearer eyJhbGciOiJIUzI1NiJ9.bW9ja2Vk.mocked' } };
            const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
            authenticate(req, res, jest.fn());
            expect(res.status).toHaveBeenCalledWith(401);
        });
    });

    describe('SEC-0.8: CORS origenes permitidos', () => {
        test('getAllowedOrigins retorna lista', () => {
            const origins = getAllowedOrigins();
            expect(origins).toContain('http://localhost:5173');
            expect(origins).toContain('http://localhost:3000');
        });

        test('fallback default si no hay variable', () => {
            delete process.env.ALLOWED_ORIGINS;
            const origins = getAllowedOrigins();
            expect(origins).toEqual(['http://localhost:5173']);
            process.env.ALLOWED_ORIGINS = 'http://localhost:5173,http://localhost:3000';
        });
    });

    describe('requireRole', () => {
        test('permite acceso si rol es correcto', () => {
            const req = { user: { role: 'admin' } };
            const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
            const next = jest.fn();
            requireRole('admin', 'owner')(req, res, next);
            expect(next).toHaveBeenCalled();
        });

        test('bloquea acceso si rol no está en lista', () => {
            const req = { user: { role: 'viewer' } };
            const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
            requireRole('admin', 'owner')(req, res, jest.fn());
            expect(res.status).toHaveBeenCalledWith(403);
        });

        test('bloquea si no hay user (no autenticado)', () => {
            const req = {};
            const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
            requireRole('admin')(req, res, jest.fn());
            expect(res.status).toHaveBeenCalledWith(401);
        });
    });
});
