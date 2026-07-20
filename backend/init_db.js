const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');

dotenv.config();

const pool = new Pool({
    connectionString: process.env.DATABASE_URL
});

async function initDb() {
    console.log('🏗️ Inicializando Base de Datos...');
    try {
        const migrations = [
            'db_init.sql',
            'src/config/migrations/001_users_sessions.sql',
            'src/config/migrations/002_organizations_extend.sql',
            'src/config/migrations/003_rls_enable.sql',
            'src/config/migrations/004_leads.sql',
            'src/config/migrations/005_platform_connections.sql',
            'src/config/migrations/006_billing.sql',
            'src/config/migrations/007_analytics.sql',
            'src/config/migrations/008_content.sql',
        ];

        for (const file of migrations) {
            const sqlPath = path.join(__dirname, file);
            if (fs.existsSync(sqlPath)) {
                const sql = fs.readFileSync(sqlPath, 'utf8');
                await pool.query(sql);
                console.log(`  ✅ ${file}`);
            } else {
                console.log(`  ⏭️ ${file} no encontrado, saltando`);
            }
        }
        console.log('✅ Esquema creado con éxito.');
        process.exit(0);
    } catch (error) {
        console.error('❌ Error inicializando DB:', error.message);
        process.exit(1);
    }
}

initDb();
