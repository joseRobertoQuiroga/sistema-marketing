const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const logger = require('../../infrastructure/utils/logger');

class StripeWebhookController {
    constructor({ orgRepo, pool }) {
        this.orgRepo = orgRepo;
        this.pool = pool;
    }

    async handle(req, res) {
        const sig = req.headers['stripe-signature'];
        let event;

        try {
            event = stripe.webhooks.constructEvent(req.body, sig, process.env.STRIPE_WEBHOOK_SECRET);
        } catch (err) {
            logger.error({ err }, 'Stripe webhook signature verification failed');
            return res.status(400).send(`Webhook Error: ${err.message}`);
        }

        try {
            switch (event.type) {
                case 'checkout.session.completed': {
                    const session = event.data.object;
                    const orgId = session.metadata?.orgId || session.client_reference_id;
                    if (orgId) {
                        await this.pool.query(
                            'UPDATE organizations SET stripe_customer_id = $1 WHERE id = $2',
                            [session.customer, orgId]
                        );
                        await this.createSubscription(orgId, session);
                    }
                    break;
                }

                case 'customer.subscription.updated':
                case 'customer.subscription.created': {
                    const subscription = event.data.object;
                    const orgId = subscription.metadata?.orgId;
                    if (orgId) {
                        await this.updateSubscription(orgId, subscription);
                    }
                    break;
                }

                case 'customer.subscription.deleted': {
                    const deleted = event.data.object;
                    const orgId = deleted.metadata?.orgId;
                    if (orgId) {
                        await this.pool.query(
                            'UPDATE organizations SET plan = $1 WHERE id = $2',
                            ['free', orgId]
                        );
                        await this.pool.query(
                            `UPDATE subscriptions SET status = 'canceled', canceled_at = NOW(), updated_at = NOW()
                             WHERE stripe_subscription_id = $1`,
                            [deleted.id]
                        );
                    }
                    break;
                }

                case 'invoice.paid': {
                    const invoice = event.data.object;
                    const subId = invoice.subscription;
                    if (subId) {
                        await this.pool.query(
                            `UPDATE subscriptions SET status = 'active', updated_at = NOW()
                             WHERE stripe_subscription_id = $1`,
                            [subId]
                        );
                    }
                    break;
                }

                case 'invoice.payment_failed': {
                    const failed = event.data.object;
                    const subId = failed.subscription;
                    if (subId) {
                        await this.pool.query(
                            `UPDATE subscriptions SET status = 'past_due', updated_at = NOW()
                             WHERE stripe_subscription_id = $1`,
                            [subId]
                        );
                    }
                    break;
                }
            }

            await this.logEvent(event);
            res.json({ received: true });
        } catch (error) {
            logger.error({ err: error, eventType: event.type }, 'Error processing Stripe webhook');
            res.status(500).json({ error: error.message });
        }
    }

    async createSubscription(orgId, session) {
        const plan = this.getPlanFromPrice(session.display_items?.[0]?.price?.id || session.line_items?.data?.[0]?.price?.id);
        await this.pool.query(`
            INSERT INTO subscriptions (organization_id, stripe_subscription_id, stripe_customer_id, plan, status)
            VALUES ($1, $2, $3, $4, 'active')
            ON CONFLICT (organization_id) DO UPDATE SET
                stripe_subscription_id = EXCLUDED.stripe_subscription_id,
                stripe_customer_id = EXCLUDED.stripe_customer_id,
                plan = EXCLUDED.plan,
                status = 'active',
                updated_at = NOW()
        `, [orgId, session.subscription, session.customer, plan]);

        await this.pool.query('UPDATE organizations SET plan = $1 WHERE id = $2', [plan, orgId]);
    }

    async updateSubscription(orgId, subscription) {
        const plan = this.getPlanFromPrice(subscription.items?.data?.[0]?.price?.id);
        const status = subscription.status;
        const periodStart = new Date(subscription.current_period_start * 1000);
        const periodEnd = new Date(subscription.current_period_end * 1000);

        await this.pool.query(`
            UPDATE subscriptions SET
                plan = $1, status = $2, current_period_start = $3, current_period_end = $4,
                updated_at = NOW()
            WHERE stripe_subscription_id = $5
        `, [plan, status, periodStart, periodEnd, subscription.id]);

        await this.pool.query('UPDATE organizations SET plan = $1 WHERE id = $2', [plan, orgId]);
    }

    getPlanFromPrice(priceId) {
        const prices = {
            [process.env.STRIPE_PRICE_PRO_MONTHLY]: 'pro',
            [process.env.STRIPE_PRICE_BUSINESS_MONTHLY]: 'business',
            [process.env.STRIPE_PRICE_AGENCY_MONTHLY]: 'agency',
        };
        return prices[priceId] || 'free';
    }

    async logEvent(event) {
        try {
            await this.pool.query(
                'INSERT INTO billing_events (stripe_event_id, type, data) VALUES ($1, $2, $3) ON CONFLICT (stripe_event_id) DO NOTHING',
                [event.id, event.type, JSON.stringify({ id: event.id, type: event.type, created: event.created })]
            );
        } catch (err) {
            logger.warn({ err }, 'Failed to log billing event');
        }
    }
}

module.exports = StripeWebhookController;
