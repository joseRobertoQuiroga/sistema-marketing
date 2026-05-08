const axios = require('axios');

class LinkedInAdapter {
    constructor() {
        this.baseURL = 'https://api.linkedin.com/v2';
        this.clientId = process.env.LINKEDIN_CLIENT_ID;
        this.clientSecret = process.env.LINKEDIN_CLIENT_SECRET;
        this.redirectUri = process.env.LINKEDIN_REDIRECT_URI;
    }

    /**
     * Genera la URL de autorización para iniciar el flujo OAuth 2.0
     */
    getAuthUrl(state) {
        const params = new URLSearchParams({
            response_type: 'code',
            client_id: this.clientId,
            redirect_uri: this.redirectUri,
            state,
            scope: 'r_liteprofile r_emailaddress rw_organization_admin'
        });
        return `https://www.linkedin.com/oauth/v2/authorization?${params.toString()}`;
    }

    /**
     * Intercambia el código de autorización por un access_token
     */
    async exchangeCodeForToken(code) {
        const response = await axios.post('https://www.linkedin.com/oauth/v2/accessToken', null, {
            params: {
                grant_type: 'authorization_code',
                code,
                redirect_uri: this.redirectUri,
                client_id: this.clientId,
                client_secret: this.clientSecret
            }
        });
        return response.data;
    }

    /**
     * Obtiene las métricas de una organización de LinkedIn
     */
    async fetchOrganizationInsights(organizationId, accessToken) {
        try {
            console.log(`[LinkedInAdapter] Solicitando insights para org ${organizationId}`);
            // En producción:
            // const response = await axios.get(
            //     `${this.baseURL}/organizationalEntityShareStatistics?q=organizationalEntity&organizationalEntity=urn:li:organization:${organizationId}`,
            //     { headers: { Authorization: `Bearer ${accessToken}` } }
            // );
            // return response.data;
            
            return {
                platform: 'linkedin',
                followers: Math.floor(Math.random() * 2000) + 500,
                impressions: Math.floor(Math.random() * 10000) + 2000,
                engagement: Math.floor(Math.random() * 300) + 30
            };
        } catch (error) {
            console.error('[LinkedInAdapter] Error al extraer insights:', error.message);
            throw error;
        }
    }
}

module.exports = new LinkedInAdapter();
