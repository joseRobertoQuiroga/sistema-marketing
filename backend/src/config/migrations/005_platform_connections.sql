-- Migration 005: Platform connections (multi-org bot tokens)

CREATE TABLE IF NOT EXISTS platform_connections (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    platform TEXT NOT NULL CHECK (platform IN ('telegram', 'whatsapp', 'instagram', 'messenger')),
    bot_token TEXT,
    platform_user_id TEXT,
    settings JSONB DEFAULT '{}',
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_platform_connections_org ON platform_connections(organization_id);
CREATE INDEX IF NOT EXISTS idx_platform_connections_token ON platform_connections(bot_token) WHERE bot_token IS NOT NULL;

ALTER TABLE platform_connections ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_isolation ON platform_connections;
CREATE POLICY tenant_isolation ON platform_connections
    USING (organization_id = current_setting('app.current_org')::uuid);
