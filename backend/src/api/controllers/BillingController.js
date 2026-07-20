const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

class BillingController {
    constructor({ orgRepo }) {
        this.orgRepo = orgRepo;
    }

    async createCheckoutSession(req, res) {
        try {
            const { priceId, successUrl, cancelUrl } = req.body;
            const orgId = req.user.orgId;

            const session = await stripe.checkout.sessions.create({
                mode: 'subscription',
                payment_method_types: ['card'],
                line_items: [{ price: priceId, quantity: 1 }],
                client_reference_id: orgId,
                success_url: successUrl || `${process.env.FRONTEND_URL}/settings?session_id={CHECKOUT_SESSION_ID}`,
                cancel_url: cancelUrl || `${process.env.FRONTEND_URL}/plans`,
                metadata: { orgId },
            });

            res.json({ url: session.url, sessionId: session.id });
        } catch (error) {
            res.status(500).json({ error: { code: 'STRIPE_ERROR', message: error.message } });
        }
    }

    async createPortalSession(req, res) {
        try {
            const orgId = req.user.orgId;
            const org = await this.orgRepo.findById(orgId);
            if (!org.stripeCustomerId) {
                return res.status(400).json({ error: { code: 'NO_CUSTOMER', message: 'No hay cliente de Stripe' } });
            }

            const session = await stripe.billingPortal.sessions.create({
                customer: org.stripeCustomerId,
                return_url: `${process.env.FRONTEND_URL}/settings`,
            });

            res.json({ url: session.url });
        } catch (error) {
            res.status(500).json({ error: { code: 'STRIPE_ERROR', message: error.message } });
        }
    }

    async getCurrentPlan(req, res) {
        try {
            const orgId = req.user.orgId;
            const org = await this.orgRepo.findById(orgId);
            res.json({
                plan: org.plan || 'free',
                trialEndsAt: org.trialEndsAt,
                stripeCustomerId: org.stripeCustomerId,
                onboardingStep: org.onboardingStep || 0,
            });
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    }
}

module.exports = BillingController;
