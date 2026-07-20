process.env.JWT_SECRET = 'test-jwt-secret-64-chars-minimum-for-testing-purposes-only!';
process.env.JWT_EXPIRES_IN = '15m';
process.env.REFRESH_TOKEN_EXPIRES_IN_DAYS = '7';
process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/test';

const jwt = require('jsonwebtoken');
const crypto = require('crypto');
jest.mock('bcryptjs');
const bcrypt = require('bcryptjs');

const mockUserRepo = { findByEmail: jest.fn(), findById: jest.fn(), findWithOrg: jest.fn(), save: jest.fn() };
const mockOrgRepo = { save: jest.fn(), findById: jest.fn(), addMember: jest.fn() };
const mockSessionRepo = { save: jest.fn(), findActiveByHash: jest.fn(), revoke: jest.fn() };

const AuthenticateUserUseCase = require('../../src/application/use-cases/AuthenticateUserUseCase');
const authService = new AuthenticateUserUseCase({ userRepo: mockUserRepo, orgRepo: mockOrgRepo, sessionRepo: mockSessionRepo });

describe('FASE 0 — Auth Use Case', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe('generateTokens — claims correctos en JWT', () => {
        test('UT-0.3: Payload contiene todos los claims requeridos', () => {
            const user = { id: 'u-1', role: 'owner' };
            const org = { id: 'o-1', slug: 'test-org', plan: 'free', trialEndsAt: '2026-06-22T00:00:00Z' };
            const tokens = authService.generateTokens(user, org);
            const decoded = jwt.verify(tokens.accessToken, process.env.JWT_SECRET);
            expect(decoded.sub).toBe('u-1');
            expect(decoded.org_id).toBe('o-1');
            expect(decoded.org_slug).toBe('test-org');
            expect(decoded.role).toBe('owner');
            expect(decoded.plan).toBe('free');
            expect(decoded.trial_ends_at).toBe('2026-06-22T00:00:00Z');
        });

        test('UT-0.4: JWT expira en 15 minutos', () => {
            const user = { id: 'u-1', role: 'member' };
            const org = { id: 'o-1', slug: 'test', plan: 'free' };
            const tokens = authService.generateTokens(user, org);
            const decoded = jwt.verify(tokens.accessToken, process.env.JWT_SECRET);
            const duration = decoded.exp - decoded.iat;
            expect(duration).toBe(900);
        });

        test('UT-0.5: refresh token es SHA-256 en DB', () => {
            const user = { id: 'u-1', role: 'member' };
            const org = { id: 'o-1', slug: 'test', plan: 'free' };
            const tokens = authService.generateTokens(user, org);
            const expectedHash = crypto.createHash('sha256').update(tokens.refreshToken).digest('hex');
            expect(tokens.refreshTokenHash).toBe(expectedHash);
            expect(tokens.refreshTokenHash.length).toBe(64);
        });

        test('UT-0.6: refresh token es único cada vez', () => {
            const user = { id: 'u-1', role: 'member' };
            const org = { id: 'o-1', slug: 'test', plan: 'free' };
            const t1 = authService.generateTokens(user, org);
            const t2 = authService.generateTokens(user, org);
            expect(t1.refreshToken).not.toBe(t2.refreshToken);
        });
    });

    describe('register — crea usuario y org', () => {
        const validInput = {
            email: 'test@test.com',
            password: 'password123',
            name: 'Test User',
            orgName: 'Test Org',
            industry: 'retail',
            timezone: 'America/La_Paz',
        };

        test('UT-0.1: registra con datos válidos', async () => {
            bcrypt.hash.mockResolvedValue('hashed_password_123');
            mockUserRepo.findByEmail.mockResolvedValue(null);
            mockUserRepo.save.mockResolvedValue({ id: 'u-1', email: 'test@test.com', name: 'Test User', createdAt: new Date() });
            mockOrgRepo.save.mockResolvedValue({ id: 'o-1', name: 'Test Org', slug: 'test-org-abc', plan: 'free', trialEndsAt: new Date(Date.now() + 14 * 86400000) });
            mockOrgRepo.addMember.mockResolvedValue();
            mockSessionRepo.save.mockResolvedValue();

            const result = await authService.register(validInput);
            expect(result.user.email).toBe('test@test.com');
            expect(result.org.plan).toBe('free');
            expect(result.accessToken).toBeDefined();
            expect(result.refreshToken).toBeDefined();
            expect(result.onboardingStep).toBe(0);
        });

        test('UT-0.2: rechaza email duplicado', async () => {
            bcrypt.hash.mockResolvedValue('hashed_password_123');
            mockUserRepo.findByEmail.mockResolvedValue({ id: 'existing', email: 'test@test.com' });

            await expect(authService.register(validInput)).rejects.toThrow('EMAIL_TAKEN');
        });

        test('UT-0.7: cifra password con bcrypt', async () => {
            bcrypt.hash.mockResolvedValue('hashed_password_123');
            mockUserRepo.findByEmail.mockResolvedValue(null);
            mockUserRepo.save.mockResolvedValue({ id: 'u-1', email: 'a@b.com', name: 'A', createdAt: new Date() });
            mockOrgRepo.save.mockResolvedValue({ id: 'o-1', name: 'O', slug: 'o', plan: 'free', trialEndsAt: new Date() });
            mockOrgRepo.addMember.mockResolvedValue();
            mockSessionRepo.save.mockResolvedValue();

            await authService.register(validInput);
            expect(bcrypt.hash).toHaveBeenCalledWith('password123', 12);
        });

        test('UT-0.8: createOrganization setea trial_ends_at a 14 días', async () => {
            bcrypt.hash.mockResolvedValue('hashed_password_123');
            mockUserRepo.findByEmail.mockResolvedValue(null);
            mockUserRepo.save.mockResolvedValue({ id: 'u-1', email: 'a@b.com', name: 'A', createdAt: new Date() });
            mockOrgRepo.save.mockResolvedValue({ id: 'o-1', name: 'O', slug: 'o', plan: 'free', trialEndsAt: new Date(Date.now() + 14 * 86400000) });
            mockOrgRepo.addMember.mockResolvedValue();
            mockSessionRepo.save.mockResolvedValue();

            const result = await authService.register(validInput);
            const trialEnd = new Date(result.org.trialEndsAt).getTime();
            const now = Date.now();
            const diffDays = (trialEnd - now) / (1000 * 60 * 60 * 24);
            expect(diffDays).toBeGreaterThan(13);
            expect(diffDays).toBeLessThan(15);
        });
    });

    describe('login — autenticación', () => {
        test('UT-0.1: login exitoso retorna tokens', async () => {
            bcrypt.compare.mockResolvedValue(true);
            mockUserRepo.findWithOrg.mockResolvedValue({
                id: 'u-1', email: 'a@b.com', name: 'A', passwordHash: 'hash',
                role: 'owner', organizationId: 'o-1',
                orgName: 'O', orgSlug: 'o', plan: 'free', trialEndsAt: null, onboardingStep: 2,
            });
            mockSessionRepo.save.mockResolvedValue();

            const result = await authService.login({ email: 'a@b.com', password: 'pass' });
            expect(result.accessToken).toBeDefined();
            expect(result.refreshToken).toBeDefined();
            expect(result.user.email).toBe('a@b.com');
            expect(result.onboardingStep).toBe(2);
        });

        test('login con contraseña incorrecta falla', async () => {
            bcrypt.compare.mockResolvedValue(false);
            mockUserRepo.findWithOrg.mockResolvedValue({
                id: 'u-1', email: 'a@b.com', name: 'A', passwordHash: 'hash',
                role: 'owner', organizationId: 'o-1',
                orgName: 'O', orgSlug: 'o', plan: 'free', trialEndsAt: null, onboardingStep: 0,
            });

            await expect(authService.login({ email: 'a@b.com', password: 'wrong' })).rejects.toThrow('INVALID_CREDENTIALS');
        });
    });

    describe('refresh — rotación de tokens', () => {
        test('UT-0.6: refresh exitoso retorna nuevos tokens', async () => {
            mockSessionRepo.findActiveByHash.mockResolvedValue({
                userId: 'u-1', organizationId: 'o-1',
                name: 'A', email: 'a@b.com', role: 'owner',
                orgName: 'O', orgSlug: 'o', plan: 'free', trialEndsAt: null,
            });
            mockSessionRepo.revoke.mockResolvedValue();
            mockSessionRepo.save.mockResolvedValue();
            mockOrgRepo.findById.mockResolvedValue({ id: 'o-1', name: 'O', slug: 'o', plan: 'free', trialEndsAt: null });
            mockUserRepo.findById.mockResolvedValue({ id: 'u-1', email: 'a@b.com', name: 'A' });

            const result = await authService.refresh('some_valid_token');
            expect(result.accessToken).toBeDefined();
            expect(result.refreshToken).toBeDefined();
        });

        test('refresh con token inválido falla', async () => {
            mockSessionRepo.findActiveByHash.mockResolvedValue(null);
            await expect(authService.refresh('invalid_token')).rejects.toThrow('INVALID_REFRESH_TOKEN');
        });
    });
});

describe('Organization entity — plan efectivo', () => {
    const Organization = require('../../src/domain/entities/Organization');

    test('UT-9.1: trial activo retorna pro', () => {
        const org = new Organization({ plan: 'free', trialEndsAt: new Date(Date.now() + 86400000) });
        expect(org.effectivePlan).toBe('pro');
    });

    test('UT-9.2: trial vencido retorna plan real', () => {
        const org = new Organization({ plan: 'free', trialEndsAt: new Date(Date.now() - 86400000) });
        expect(org.effectivePlan).toBe('free');
    });

    test('UT-9.3: sin trial retorna plan real', () => {
        const org = new Organization({ plan: 'pro' });
        expect(org.effectivePlan).toBe('pro');
    });
});
