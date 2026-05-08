const express = require('express');
const router = express.Router();

// Mock Data Generator Functions
const generateEvolutionData = (days) => {
    const data = [];
    let baseReach = 1000;
    let baseEngagement = 4.0;
    let baseConversions = 10;
    let baseSpend = 50;

    for (let i = days; i >= 0; i--) {
        const date = new Date();
        date.setDate(date.getDate() - i);
        
        // Random variance
        const variance = (Math.random() - 0.5) * 0.2; // +/- 10%
        
        data.push({
            date: date.toISOString().split('T')[0],
            reach: Math.round(baseReach * (1 + variance)),
            engagement_rate: Number((baseEngagement * (1 + variance)).toFixed(1)),
            conversions: Math.round(baseConversions * (1 + variance)),
            spend: Number((baseSpend * (1 + variance)).toFixed(2))
        });

        // Slight upward trend
        baseReach *= 1.01;
        baseEngagement *= 1.005;
        baseConversions *= 1.015;
        baseSpend *= 1.005;
    }
    return data;
};

const generateTopPosts = () => [
    {
        id: 'post-1',
        platform: 'instagram',
        content: '¡Nueva colección de verano disponible ahora! 🌞👗',
        reach: 12500,
        engagement_rate: 8.4,
        url: 'https://instagram.com/p/mock1',
        published_at: new Date(Date.now() - 2 * 86400000).toISOString()
    },
    {
        id: 'post-2',
        platform: 'facebook',
        content: '5 Tips para combinar tus accesorios este invierno ❄️',
        reach: 9800,
        engagement_rate: 6.2,
        url: 'https://facebook.com/p/mock2',
        published_at: new Date(Date.now() - 5 * 86400000).toISOString()
    },
    {
        id: 'post-3',
        platform: 'tiktok',
        content: 'Behind the scenes de nuestra última sesión de fotos 📸✨',
        reach: 45000,
        engagement_rate: 12.1,
        url: 'https://tiktok.com/@user/video/mock3',
        published_at: new Date(Date.now() - 1 * 86400000).toISOString()
    }
];

// Endpoints
router.get('/overview', (req, res) => {
    const days = parseInt(req.query.days) || 30;
    const channel = req.query.channel || 'all';

    // Mock multiplier based on channel and days
    const daysMultiplier = days / 30;
    const channelMultiplier = channel === 'all' ? 1 : 0.4; // 40% del total para simular un canal
    const mult = daysMultiplier * channelMultiplier;

    res.json({
        kpis: {
            total_reach: Math.round(245000 * mult),
            engagement_rate: Number((4.8 * (channel === 'instagram' ? 1.2 : 1)).toFixed(1)),
            leads_generated: Math.round(142 * mult),
            cpl: Number((3.50 * (channel === 'linkedin' ? 1.5 : 1)).toFixed(2)), // Cost Per Lead en USD
            total_spend: Number((497.00 * mult).toFixed(2)),
            roas: 2.4
        },
        evolution: generateEvolutionData(days),
        top_posts: generateTopPosts().filter(p => channel === 'all' || p.platform === channel)
    });
});

router.get('/channels', (req, res) => {
    // Mock per-channel metrics
    res.json({
        channels: [
            {
                platform: 'instagram',
                account_name: '@tienda_oficial',
                followers: 12400,
                growth_rate: 2.5,
                reach: 150000,
                engagement_rate: 5.2
            },
            {
                platform: 'facebook',
                account_name: 'Tienda Oficial FB',
                followers: 34000,
                growth_rate: 0.8,
                reach: 85000,
                engagement_rate: 3.1
            },
            {
                platform: 'tiktok',
                account_name: '@tienda_tiktok',
                followers: 8500,
                growth_rate: 15.4,
                reach: 320000,
                engagement_rate: 9.8
            }
        ]
    });
});

router.get('/export', (req, res) => {
    const format = req.query.format || 'csv';
    const days = req.query.days || 30;

    if (format === 'csv') {
        const csvContent = `Fecha,Alcance,Engagement Rate,Conversiones,Inversion
2026-05-01,15000,4.2,25,120.50
2026-05-02,16200,4.5,28,125.00
2026-05-03,15800,4.3,24,122.00
2026-05-04,18000,5.1,35,140.00
2026-05-05,17500,4.9,32,135.00
2026-05-06,20000,5.5,45,160.00
2026-05-07,22000,6.0,50,180.00
        `;
        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', `attachment; filename="analytics_report_${days}d.csv"`);
        return res.send(csvContent.trim());
    }

    res.status(400).json({ error: 'Format not supported yet in mock mode' });
});

module.exports = router;
