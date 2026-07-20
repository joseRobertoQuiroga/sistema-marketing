-- Migration 004: Leads table for CRM

CREATE TABLE IF NOT EXISTS leads (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    conversation_id TEXT NOT NULL,
    name TEXT DEFAULT 'Usuario',
    contact_info JSONB DEFAULT '{}',
    source TEXT DEFAULT 'telegram',
    status TEXT DEFAULT 'new' CHECK (status IN ('new','contacted','qualified','converted','lost')),
    score INTEGER DEFAULT 0,
    captured_data JSONB DEFAULT '{}',
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(organization_id, conversation_id)
);

CREATE INDEX IF NOT EXISTS idx_leads_org ON leads(organization_id);
CREATE INDEX IF NOT EXISTS idx_leads_status ON leads(organization_id, status);
CREATE INDEX IF NOT EXISTS idx_leads_score ON leads(organization_id, score DESC);

ALTER TABLE leads ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_isolation ON leads;
CREATE POLICY tenant_isolation ON leads
    USING (organization_id = current_setting('app.current_org')::uuid);
