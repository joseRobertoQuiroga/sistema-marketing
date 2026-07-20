const { Router } = require('express');
const { authenticate } = require('../middleware/auth');

function createBillingRoutes(billingController, stripeWebhookController) {
    const router = Router();

    router.post('/create-checkout-session', authenticate, (req, res) => billingController.createCheckoutSession(req, res));
    router.post('/create-portal-session', authenticate, (req, res) => billingController.createPortalSession(req, res));
    router.get('/current', authenticate, (req, res) => billingController.getCurrentPlan(req, res));

    return router;
}

module.exports = createBillingRoutes;
