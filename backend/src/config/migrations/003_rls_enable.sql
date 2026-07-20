-- Migration 003: Row Level Security

ALTER TABLE knowledge_chunks ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_sets ENABLE ROW LEVEL SECURITY;
ALTER TABLE bot_configs ENABLE ROW LEVEL SECURITY;
ALTER TABLE memberships ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_isolation ON knowledge_chunks;
CREATE POLICY tenant_isolation ON knowledge_chunks
    USING (organization_id = current_setting('app.current_org')::uuid);

DROP POLICY IF EXISTS tenant_isolation ON messages;
CREATE POLICY tenant_isolation ON messages
    USING (organization_id = current_setting('app.current_org')::uuid);

DROP POLICY IF EXISTS tenant_isolation ON products;
CREATE POLICY tenant_isolation ON products
    USING (organization_id = current_setting('app.current_org')::uuid);

DROP POLICY IF EXISTS tenant_isolation ON product_sets;
CREATE POLICY tenant_isolation ON product_sets
    USING (organization_id = current_setting('app.current_org')::uuid);

DROP POLICY IF EXISTS tenant_isolation ON bot_configs;
CREATE POLICY tenant_isolation ON bot_configs
    USING (organization_id = current_setting('app.current_org')::uuid);

DROP POLICY IF EXISTS tenant_isolation ON memberships;
CREATE POLICY tenant_isolation ON memberships
    USING (organization_id = current_setting('app.current_org')::uuid);
