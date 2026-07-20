class Session {
    constructor({ id, userId, organizationId, tokenHash, expiresAt, revokedAt, createdAt }) {
        this.id = id;
        this.userId = userId;
        this.organizationId = organizationId;
        this.tokenHash = tokenHash;
        this.expiresAt = new Date(expiresAt);
        this.revokedAt = revokedAt ? new Date(revokedAt) : null;
        this.createdAt = createdAt || new Date();
    }

    get isExpired() {
        return new Date() > this.expiresAt;
    }

    get isRevoked() {
        return this.revokedAt !== null;
    }
}

module.exports = Session;
