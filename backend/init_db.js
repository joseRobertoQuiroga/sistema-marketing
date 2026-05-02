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
        const sqlPath = path.join(__dirname, 'db_init.sql');
        const sql = fs.readFileSync(sqlPath, 'utf8');
        
        await pool.query(sql);
        console.log('✅ Esquema creado con éxito.');
        process.exit(0);
    } catch (error) {
        console.error('❌ Error inicializando DB:', error.message);
        process.exit(1);
    }
}

initDb();
