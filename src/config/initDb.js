const { pool } = require('./database');

const initDb = async () => {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS usuarios (
        id SERIAL PRIMARY KEY,
        nombre VARCHAR(100),
        email VARCHAR(100) UNIQUE NOT NULL,
        password VARCHAR(255) NOT NULL,
        role VARCHAR(20) DEFAULT 'admin',
        activo BOOLEAN DEFAULT true,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    console.log('✅ Tabla usuarios verificada/creada correctamente');
  } catch (error) {
    console.error('❌ Error inicializando la base de datos:', error.message);
    process.exit(1);
  }
};

module.exports = initDb;
