const { Pool } = require('pg');

/** Migración: Crear tabla de conversaciones del chatbot */
const CONVERSATIONS_TABLE = `
CREATE TABLE IF NOT EXISTS conversations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    platform TEXT NOT NULL,
    platform_conversation_id TEXT NOT NULL,
    contact_name TEXT DEFAULT 'Usuario',
    contact_info JSONB DEFAULT '{}',
    status TEXT DEFAULT 'active' CHECK (status IN ('active', 'paused', 'closed', 'escalated')),
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE (organization_id, platform, platform_conversation_id)
);
CREATE INDEX IF NOT EXISTS idx_conversations_org_status ON conversations(organization_id, status);
CREATE INDEX IF NOT EXISTS idx_conversations_org_platform ON conversations(organization_id, platform);
`;

const CAMPAIGNS_TABLE = `
CREATE TABLE IF NOT EXISTS campaigns (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    platform TEXT DEFAULT 'all',
    template_id UUID,
    audience_filter JSONB DEFAULT '{}',
    scheduled_at TIMESTAMPTZ,
    status TEXT DEFAULT 'draft' CHECK (status IN ('draft','scheduled','sending','completed','cancelled','failed')),
    stats JSONB DEFAULT '{"total":0,"sent":0,"delivered":0,"read":0,"replied":0,"failed":0}',
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_campaigns_org_status ON campaigns(organization_id, status);
CREATE INDEX IF NOT EXISTS idx_campaigns_scheduled ON campaigns(status, scheduled_at) WHERE status = 'scheduled';

CREATE TABLE IF NOT EXISTS campaign_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    campaign_id UUID NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    platform_conversation_id TEXT NOT NULL,
    platform TEXT NOT NULL,
    content TEXT NOT NULL,
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending','sent','delivered','read','replied','failed')),
    sent_at TIMESTAMPTZ,
    delivered_at TIMESTAMPTZ,
    read_at TIMESTAMPTZ,
    replied_at TIMESTAMPTZ,
    error TEXT,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_campaign_msgs_campaign ON campaign_messages(campaign_id);
CREATE INDEX IF NOT EXISTS idx_campaign_msgs_status ON campaign_messages(organization_id, status);
`;

module.exports = { CONVERSATIONS_TABLE, CAMPAIGNS_TABLE };
