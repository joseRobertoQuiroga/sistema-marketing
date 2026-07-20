class Organization {
    constructor({ id, name, slug, plan, settings, trialEndsAt, onboardingStep, createdAt }) {
        this.id = id;
        this.name = name;
        this.slug = slug;
        this.plan = plan || 'free';
        this.settings = settings || {};
        this.trialEndsAt = trialEndsAt ? new Date(trialEndsAt) : null;
        this.onboardingStep = onboardingStep || 0;
        this.createdAt = createdAt || new Date();
    }

    get effectivePlan() {
        if (this.trialEndsAt && new Date() < this.trialEndsAt) return 'pro';
        return this.plan;
    }

    get isTrialActive() {
        return this.trialEndsAt && new Date() < this.trialEndsAt;
    }
}

module.exports = Organization;
