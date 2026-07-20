-- Migration 008: Content Hub (assets, posts)

CREATE TABLE IF NOT EXISTS assets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    filename TEXT NOT NULL,
    original_name TEXT NOT NULL,
    mimetype TEXT NOT NULL,
    size INTEGER NOT NULL,
    width INTEGER,
    height INTEGER,
    variants JSONB DEFAULT '{}',
    url TEXT,
    alt_text TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    deleted_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_assets_org ON assets(organization_id);
CREATE INDEX IF NOT EXISTS idx_assets_active ON assets(organization_id) WHERE deleted_at IS NULL;

CREATE TABLE IF NOT EXISTS posts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    media_urls TEXT[] DEFAULT '{}',
    scheduled_at TIMESTAMPTZ,
    published_at TIMESTAMPTZ,
    status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'scheduled', 'publishing', 'published', 'failed')),
    platform_data JSONB DEFAULT '[]',
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_posts_org ON posts(organization_id);
CREATE INDEX IF NOT EXISTS idx_posts_status ON posts(organization_id, status);
CREATE INDEX IF NOT EXISTS idx_posts_scheduled ON posts(organization_id, scheduled_at) WHERE status = 'scheduled';

CREATE TABLE IF NOT EXISTS post_accounts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    post_id UUID NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
    social_connection_id UUID NOT NULL REFERENCES social_connections(id) ON DELETE CASCADE,
    platform_post_id TEXT,
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'published', 'failed')),
    error_message TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(post_id, social_connection_id)
);

ALTER TABLE assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE post_accounts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_isolation ON assets;
CREATE POLICY tenant_isolation ON assets
    USING (organization_id = current_setting('app.current_org')::uuid);

DROP POLICY IF EXISTS tenant_isolation ON posts;
CREATE POLICY tenant_isolation ON posts
    USING (organization_id = current_setting('app.current_org')::uuid);

DROP POLICY IF EXISTS tenant_isolation ON post_accounts;
CREATE POLICY tenant_isolation ON post_accounts
    USING (organization_id = current_setting('app.current_org')::uuid);
