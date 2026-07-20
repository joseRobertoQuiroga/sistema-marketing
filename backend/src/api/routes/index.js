const { authenticate } = require('../middleware/auth');
const { tenantContext, releaseDbClient } = require('../middleware/tenant');
const createAuthRoutes = require('./auth.routes');
const createConversationRoutes = require('./conversation.routes');
const createProductRoutes = require('./product.routes');
const createLeadRoutes = require('./lead.routes');
const createBillingRoutes = require('./billing.routes');
const createAnalyticsRoutes = require('./analytics.routes');
const createContentRoutes = require('./content.routes');
const createCampaignRoutes = require('./campaign.routes');

function registerRoutes(app, dependencies) {
    const { authController, conversationController, productController, leadController, webhookController, billingController, stripeWebhookController, analyticsController, contentController, campaignController } = dependencies;

    const authRoutes = createAuthRoutes(authController);
    const conversationRoutes = createConversationRoutes(conversationController);
    const productRoutes = createProductRoutes(productController);
    const leadRoutes = createLeadRoutes(leadController);
    const billingRoutes = createBillingRoutes(billingController, stripeWebhookController);
    const analyticsRoutes = createAnalyticsRoutes(analyticsController);
    const contentRoutes = createContentRoutes(contentController);
    const campaignRoutes = createCampaignRoutes(campaignController);

    app.use('/auth', authRoutes);
    app.use('/api/conversations', authenticate, tenantContext, releaseDbClient, conversationRoutes);
    app.use('/api/products', authenticate, tenantContext, releaseDbClient, productRoutes);
    app.use('/api/leads', authenticate, tenantContext, releaseDbClient, leadRoutes);
    app.use('/api/billing', billingRoutes);
    app.use('/api/analytics', analyticsRoutes);
    app.use('/api/content', authenticate, tenantContext, releaseDbClient, contentRoutes);
    if (campaignController) {
        const campaignRoutes = createCampaignRoutes(campaignController);
        app.use('/api/campaigns', authenticate, tenantContext, releaseDbClient, campaignRoutes);
    }
}

module.exports = registerRoutes;
