class User {
    constructor({ id, email, name, passwordHash, role, createdAt }) {
        this.id = id;
        this.email = email;
        this.name = name;
        this.passwordHash = passwordHash;
        this.role = role || 'member';
        this.createdAt = createdAt || new Date();
    }
}

module.exports = User;
