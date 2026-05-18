import { Pool } from 'pg';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL?.includes('localhost') ? false : { rejectUnauthorized: false }
});

async function initDatabase() {
  console.log('Conectando a la base de datos...');
  
  try {
    // Crear tabla de usuarios
    await pool.query(`
      CREATE TABLE IF NOT EXISTS usuario (
        id SERIAL PRIMARY KEY,
        nombre VARCHAR(100) NOT NULL,
        apellido VARCHAR(100) NOT NULL,
        email VARCHAR(255) UNIQUE NOT NULL,
        telefono VARCHAR(20),
        password_hash VARCHAR(255) NOT NULL,
        rol VARCHAR(20) DEFAULT 'cliente' CHECK (rol IN ('cliente', 'admin', 'empleado')),
        estado VARCHAR(20) DEFAULT 'pendiente' CHECK (estado IN ('pendiente', 'activo', 'bloqueado')),
        intentos_fallidos INTEGER DEFAULT 0,
        ultimo_intento TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log('Tabla "usuario" creada o ya existe');

    // Crear tabla de tokens de verificación
    await pool.query(`
      CREATE TABLE IF NOT EXISTS tokens_verificacion (
        id SERIAL PRIMARY KEY,
        usuario_id INTEGER REFERENCES usuario(id) ON DELETE CASCADE,
        token VARCHAR(6) NOT NULL,
        tipo VARCHAR(20) DEFAULT 'email' CHECK (tipo IN ('email', 'password_reset')),
        expira_en TIMESTAMP NOT NULL,
        usado BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log('Tabla "tokens_verificacion" creada o ya existe');

    // Crear índices para mejorar el rendimiento
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_usuario_email ON usuario(email);
    `);
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_tokens_usuario ON tokens_verificacion(usuario_id);
    `);
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_tokens_token ON tokens_verificacion(token);
    `);
    console.log('Índices creados');

    console.log('\n Base de datos inicializada correctamente!');
    console.log('\nTablas creadas:');
    console.log('  - usuario');
    console.log('  - tokens_verificacion');
    
  } catch (error) {
    console.error('Error al inicializar la base de datos:', error);
    throw error;
  } finally {
    await pool.end();
  }
}

initDatabase();
