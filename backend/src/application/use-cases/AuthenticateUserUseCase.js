const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const User = require('../../domain/entities/User');
const Organization = require('../../domain/entities/Organization');

const SALT_ROUNDS = 12;

class AuthenticateUserUseCase {
    constructor({ userRepo, orgRepo, sessionRepo }) {
        this.userRepo = userRepo;
        this.orgRepo = orgRepo;
        this.sessionRepo = sessionRepo;
    }

    generateTokens(user, org) {
        const payload = {
            sub: user.id,
            org_id: org.id,
            org_slug: org.slug,
            role: user.role,
            plan: org.plan,
            trial_ends_at: org.trialEndsAt,
        };

        const accessToken = jwt.sign(payload, process.env.JWT_SECRET, {
            expiresIn: process.env.JWT_EXPIRES_IN || '15m',
        });
        const refreshToken = crypto.randomBytes(48).toString('hex');
        const refreshTokenHash = crypto.createHash('sha256').update(refreshToken).digest('hex');

        return { accessToken, refreshToken, refreshTokenHash };
    }

    async register({ email, password, name, orgName, industry, timezone }) {
        const existing = await this.userRepo.findByEmail(email);
        if (existing) {
            throw Object.assign(new Error('EMAIL_TAKEN'), { status: 409 });
        }

        const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
        const user = new User({ email, name, passwordHash, role: 'owner' });
        const savedUser = await this.userRepo.save(user);

        const slug = orgName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
            + '-' + crypto.randomBytes(3).toString('hex');
        const trialEndsAt = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000);

        const org = new Organization({
            name: orgName, slug, plan: 'free',
            settings: { industry: industry || null, timezone: timezone || 'UTC' },
            trialEndsAt,
        });
        const savedOrg = await this.orgRepo.save(org);
        await this.orgRepo.addMember(savedUser.id, savedOrg.id, 'owner');

        const tokens = this.generateTokens({ ...savedUser, role: 'owner' }, savedOrg);
        await this.sessionRepo.save({ userId: savedUser.id, orgId: savedOrg.id, tokenHash: tokens.refreshTokenHash });

        return {
            user: { id: savedUser.id, email: savedUser.email, name: savedUser.name, role: 'owner' },
            org: { id: savedOrg.id, name: savedOrg.name, slug: savedOrg.slug, plan: savedOrg.plan, trialEndsAt: savedOrg.trialEndsAt },
            accessToken: tokens.accessToken,
            refreshToken: tokens.refreshToken,
            onboardingStep: 0,
        };
    }

    async login({ email, password }) {
        const row = await this.userRepo.findWithOrg(email);
        if (!row) {
            throw Object.assign(new Error('INVALID_CREDENTIALS'), { status: 401 });
        }

        const valid = await bcrypt.compare(password, row.passwordHash);
        if (!valid) {
            throw Object.assign(new Error('INVALID_CREDENTIALS'), { status: 401 });
        }

        const user = { id: row.id, email: row.email, name: row.name, role: row.role };
        const org = {
            id: row.organizationId, name: row.orgName, slug: row.orgSlug,
            plan: row.plan, trialEndsAt: row.trialEndsAt,
        };

        const tokens = this.generateTokens(user, org);
        await this.sessionRepo.save({ userId: user.id, orgId: org.id, tokenHash: tokens.refreshTokenHash });

        return {
            user, org: { id: org.id, name: org.name, slug: org.slug, plan: org.plan, trialEndsAt: org.trialEndsAt },
            accessToken: tokens.accessToken, refreshToken: tokens.refreshToken,
            onboardingStep: row.onboardingStep || 0,
        };
    }

    async refresh(refreshToken) {
        const hash = crypto.createHash('sha256').update(refreshToken).digest('hex');
        const session = await this.sessionRepo.findActiveByHash(hash);
        if (!session) {
            throw Object.assign(new Error('INVALID_REFRESH_TOKEN'), { status: 401 });
        }

        await this.sessionRepo.revoke(hash);

        const org = await this.orgRepo.findById(session.organizationId);
        const userData = await this.userRepo.findById(session.userId);
        const user = { id: userData.id, email: userData.email, name: userData.name, role: session.role };

        const tokens = this.generateTokens(user, org);
        await this.sessionRepo.save({ userId: user.id, orgId: org.id, tokenHash: tokens.refreshTokenHash });

        return { accessToken: tokens.accessToken, refreshToken: tokens.refreshToken };
    }

    async logout(refreshToken) {
        if (!refreshToken) return;
        const hash = crypto.createHash('sha256').update(refreshToken).digest('hex');
        await this.sessionRepo.revoke(hash);
    }
}

module.exports = AuthenticateUserUseCase;
