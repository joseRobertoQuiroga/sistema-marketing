-- Migration 007: Analytics (social_connections, metrics)

CREATE TABLE IF NOT EXISTS social_connections (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    platform TEXT NOT NULL CHECK (platform IN ('instagram', 'facebook', 'tiktok', 'twitter')),
    platform_account_id TEXT NOT NULL,
    platform_account_name TEXT,
    platform_account_avatar TEXT,
    access_token TEXT NOT NULL,
    refresh_token TEXT,
    token_expires_at TIMESTAMPTZ,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(organization_id, platform, platform_account_id)
);

CREATE INDEX IF NOT EXISTS idx_social_connections_org ON social_connections(organization_id);
CREATE INDEX IF NOT EXISTS idx_social_connections_platform ON social_connections(platform);

CREATE TABLE IF NOT EXISTS account_metrics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    social_connection_id UUID REFERENCES social_connections(id) ON DELETE CASCADE,
    metric_date DATE NOT NULL,
    followers INTEGER DEFAULT 0,
    following INTEGER DEFAULT 0,
    posts_count INTEGER DEFAULT 0,
    likes INTEGER DEFAULT 0,
    comments INTEGER DEFAULT 0,
    shares INTEGER DEFAULT 0,
    views INTEGER DEFAULT 0,
    reach INTEGER DEFAULT 0,
    engagement_rate DECIMAL(5,2) DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_account_metrics_org ON account_metrics(organization_id);
CREATE INDEX IF NOT EXISTS idx_account_metrics_date ON account_metrics(organization_id, metric_date DESC);

ALTER TABLE social_connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE account_metrics ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_isolation ON social_connections;
CREATE POLICY tenant_isolation ON social_connections
    USING (organization_id = current_setting('app.current_org')::uuid);

DROP POLICY IF EXISTS tenant_isolation ON account_metrics;
CREATE POLICY tenant_isolation ON account_metrics
    USING (organization_id = current_setting('app.current_org')::uuid);
