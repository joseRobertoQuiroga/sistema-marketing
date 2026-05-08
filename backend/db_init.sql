-- Habilitar extensiones necesarias
CREATE EXTENSION IF NOT EXISTS vector;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. Tabla de Organizaciones (Tenants)
CREATE TABLE IF NOT EXISTS organizations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    plan TEXT DEFAULT 'free',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Tabla de Conocimiento (RAG) - Multi-tenant
CREATE TABLE IF NOT EXISTS knowledge_chunks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    source_type TEXT NOT NULL, -- 'text', 'csv', 'pdf', 'image'
    source_name TEXT,
    content TEXT NOT NULL,
    embedding vector(768), -- Dimensiones para nomic-embed-text
    metadata JSONB DEFAULT '{}',
    is_active BOOLEAN DEFAULT true,
    deleted_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Tabla de Productos (Específica para Moda/Retail)
CREATE TABLE IF NOT EXISTS products (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT,
    price DECIMAL(10, 2),
    currency TEXT DEFAULT 'Bs.',
    category TEXT,
    image_url TEXT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Tabla de Conjuntos / Looks (Outfits)
CREATE TABLE IF NOT EXISTS product_sets (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. Relación entre Conjuntos y Productos
CREATE TABLE IF NOT EXISTS product_set_items (
    set_id UUID REFERENCES product_sets(id) ON DELETE CASCADE,
    product_id UUID REFERENCES products(id) ON DELETE CASCADE,
    PRIMARY KEY (set_id, product_id)
);

-- 6. Historial de Mensajes con Intent Score
CREATE TABLE IF NOT EXISTS messages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    conversation_id TEXT NOT NULL,
    role TEXT CHECK (role IN ('user', 'assistant')), -- Nota: mensajes del admin usan role='assistant' + captured_data.is_admin=true
    content TEXT,
    intent_score INTEGER DEFAULT 0,
    captured_data JSONB DEFAULT '{}',
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 7. Configuración del Bot por Organización
CREATE TABLE IF NOT EXISTS bot_configs (
    organization_id UUID PRIMARY KEY REFERENCES organizations(id) ON DELETE CASCADE,
    business_name TEXT NOT NULL,
    tone TEXT DEFAULT 'amigable',
    escalation_message TEXT DEFAULT 'Lo siento, no tengo esa información. Te paso con un humano.',
    is_active BOOLEAN DEFAULT true,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Índices para optimización
CREATE INDEX IF NOT EXISTS idx_chunks_org ON knowledge_chunks(organization_id);
CREATE INDEX IF NOT EXISTS idx_chunks_embedding ON knowledge_chunks USING hnsw (embedding vector_cosine_ops);
CREATE INDEX IF NOT EXISTS idx_products_org ON products(organization_id);
CREATE INDEX IF NOT EXISTS idx_messages_conversation ON messages(conversation_id);

-- 8. Conexiones de Redes Sociales (Módulo 1: Analytics Hub)
CREATE TABLE IF NOT EXISTS social_connections (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    platform TEXT NOT NULL, -- 'facebook', 'instagram', 'linkedin', 'tiktok'
    account_id TEXT NOT NULL, -- ID de la página/cuenta en la plataforma
    account_name TEXT NOT NULL,
    access_token TEXT NOT NULL, -- Token cifrado
    refresh_token TEXT,
    token_expires_at TIMESTAMPTZ,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(platform, account_id)
);

-- 9. Métricas Agregadas por Cuenta (Módulo 1: Analytics Hub)
CREATE TABLE IF NOT EXISTS account_metrics (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    connection_id UUID NOT NULL REFERENCES social_connections(id) ON DELETE CASCADE,
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    metric_date DATE NOT NULL,
    followers_count INTEGER DEFAULT 0,
    total_reach INTEGER DEFAULT 0,
    total_spend DECIMAL(10, 2) DEFAULT 0.00,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(connection_id, metric_date)
);

-- 10. Métricas por Publicación (Módulo 1: Analytics Hub)
CREATE TABLE IF NOT EXISTS post_metrics (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    connection_id UUID NOT NULL REFERENCES social_connections(id) ON DELETE CASCADE,
    platform_post_id TEXT NOT NULL,
    content TEXT,
    post_url TEXT,
    impressions INTEGER DEFAULT 0,
    reach INTEGER DEFAULT 0,
    engagement_rate DECIMAL(5, 2) DEFAULT 0.00,
    ctr DECIMAL(5, 2) DEFAULT 0.00,
    clicks INTEGER DEFAULT 0,
    published_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(connection_id, platform_post_id)
);

-- Índices para Analytics
CREATE INDEX IF NOT EXISTS idx_account_metrics_date ON account_metrics(metric_date);
CREATE INDEX IF NOT EXISTS idx_post_metrics_conn ON post_metrics(connection_id);
