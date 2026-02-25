// Database initialization script
const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false,
  },
});

const initDb = async () => {
  const client = await pool.connect();
  
  try {
    console.log('🔄 Initializing database...');
    
    // Create tables
    await client.query(`
      -- USUARIOS
      CREATE TABLE IF NOT EXISTS usuarios (
        id SERIAL PRIMARY KEY,
        email VARCHAR(255) UNIQUE NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        rol VARCHAR(50) NOT NULL CHECK (rol IN ('administrador', 'recepcion', 'medico', 'enfermeria')),
        nombre VARCHAR(100) NOT NULL,
        apellido VARCHAR(100) NOT NULL,
        activo BOOLEAN DEFAULT true,
        ultimo_login TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      -- PACIENTES
      CREATE TABLE IF NOT EXISTS pacientes (
        id SERIAL PRIMARY KEY,
        usuario_id INTEGER REFERENCES usuarios(id) ON DELETE SET NULL,
        dni VARCHAR(20) UNIQUE NOT NULL,
        nombre VARCHAR(100) NOT NULL,
        apellido VARCHAR(100) NOT NULL,
        fecha_nacimiento DATE NOT NULL,
        genero VARCHAR(20),
        telefono VARCHAR(20),
        email VARCHAR(255),
        direccion TEXT,
        sangre_tipo VARCHAR(5),
        alergias TEXT[],
        contacto_emergencia_nombre VARCHAR(200),
        contacto_emergencia_telefono VARCHAR(20),
        contacto_emergencia_parentesco VARCHAR(50),
        activo BOOLEAN DEFAULT true,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      -- MÉDICOS
      CREATE TABLE IF NOT EXISTS medicos (
        id SERIAL PRIMARY KEY,
        usuario_id INTEGER REFERENCES usuarios(id) ON DELETE SET NULL,
        nombre VARCHAR(100) NOT NULL,
        apellido VARCHAR(100) NOT NULL,
        especialidad VARCHAR(100) NOT NULL,
        licencia VARCHAR(50) UNIQUE NOT NULL,
        telefono VARCHAR(20),
        email VARCHAR(255),
        duracion_consulta_minutos INTEGER DEFAULT 30,
        activo BOOLEAN DEFAULT true,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      -- HORARIOS DE MÉDICOS
      CREATE TABLE IF NOT EXISTS medico_horarios (
        id SERIAL PRIMARY KEY,
        medico_id INTEGER REFERENCES medicos(id) ON DELETE CASCADE,
        dia_semana INTEGER NOT NULL CHECK (dia_semana BETWEEN 0 AND 6),
        hora_inicio TIME NOT NULL,
        hora_fin TIME NOT NULL,
        activo BOOLEAN DEFAULT true,
        UNIQUE(medico_id, dia_semana, hora_inicio)
      );

      -- CITAS
      CREATE TABLE IF NOT EXISTS citas (
        id SERIAL PRIMARY KEY,
        paciente_id INTEGER REFERENCES pacientes(id) ON DELETE CASCADE,
        medico_id INTEGER REFERENCES medicos(id) ON DELETE CASCADE,
        fecha_hora TIMESTAMP NOT NULL,
        duracion_minutos INTEGER DEFAULT 30,
        motivo TEXT,
        estado VARCHAR(30) DEFAULT 'pendiente' CHECK (estado IN ('pendiente', 'confirmada', 'cancelada', 'atendida', 'no_asistio')),
        cancelada_por INTEGER REFERENCES usuarios(id),
        motivo_cancelacion TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      -- HISTORIALES CLÍNICOS
      CREATE TABLE IF NOT EXISTS historiales_clinicos (
        id SERIAL PRIMARY KEY,
        paciente_id INTEGER REFERENCES pacientes(id) ON DELETE CASCADE,
        cita_id INTEGER REFERENCES citas(id) ON DELETE SET NULL,
        fecha TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        motivo_consulta TEXT,
        diagnostico TEXT,
        tratamiento TEXT,
        receta TEXT,
        observaciones TEXT,
        peso DECIMAL(5,2),
        temperatura DECIMAL(4,1),
        presion_sistolica INTEGER,
        presion_diastolica INTEGER,
        medico_id INTEGER REFERENCES medicos(id) ON DELETE SET NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      -- ARCHIVOS CLÍNICOS
      CREATE TABLE IF NOT EXISTS archivos_clinicos (
        id SERIAL PRIMARY KEY,
        historial_id INTEGER REFERENCES historiales_clinicos(id) ON DELETE CASCADE,
        tipo VARCHAR(50) NOT NULL CHECK (tipo IN ('laboratorio', 'imagen', 'receta', 'otro')),
        nombre VARCHAR(255) NOT NULL,
        nombre_original VARCHAR(255) NOT NULL,
        mime_type VARCHAR(100),
        tamano_bytes INTEGER,
        url TEXT NOT NULL,
        uploaded_por INTEGER REFERENCES usuarios(id),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      -- FACTURAS
      CREATE TABLE IF NOT EXISTS facturas (
        id SERIAL PRIMARY KEY,
        paciente_id INTEGER REFERENCES pacientes(id) ON DELETE CASCADE,
        cita_id INTEGER REFERENCES citas(id) ON DELETE SET NULL,
        numero_factura VARCHAR(50) UNIQUE NOT NULL,
        concepto TEXT NOT NULL,
        monto DECIMAL(10,2) NOT NULL,
        igv DECIMAL(10,2) DEFAULT 0,
        total DECIMAL(10,2) NOT NULL,
        estado_pago VARCHAR(30) DEFAULT 'pendiente' CHECK (estado_pago IN ('pendiente', 'pagada', 'anulada')),
        metodo_pago VARCHAR(30),
        fecha_pago TIMESTAMP,
        observaciones TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      -- CAMAS
      CREATE TABLE IF NOT EXISTS camas (
        id SERIAL PRIMARY KEY,
        numero VARCHAR(10) NOT NULL,
        tipo VARCHAR(50) DEFAULT 'estandar' CHECK (tipo IN ('estandar', 'uci', 'pediatrica', 'maternidad')),
        planta INTEGER NOT NULL,
        descripcion TEXT,
        estado VARCHAR(30) DEFAULT 'disponible' CHECK (estado IN ('disponible', 'ocupada', 'limpieza', 'mantenimiento')),
        paciente_id INTEGER REFERENCES pacientes(id) ON DELETE SET NULL,
        fecha_asignacion TIMESTAMP,
        fecha_liberacion TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(numero, planta)
      );

      -- HISTORIAL DE CAMAS
      CREATE TABLE IF NOT EXISTS cama_historial (
        id SERIAL PRIMARY KEY,
        cama_id INTEGER REFERENCES camas(id) ON DELETE CASCADE,
        paciente_id INTEGER REFERENCES pacientes(id) ON DELETE CASCADE,
        fecha_entrada TIMESTAMP NOT NULL,
        fecha_salida TIMESTAMP,
        motivo TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      -- AUDITORÍA
      CREATE TABLE IF NOT EXISTS audit_log (
        id SERIAL PRIMARY KEY,
        usuario_id INTEGER REFERENCES usuarios(id),
        accion VARCHAR(50) NOT NULL,
        tabla_afectada VARCHAR(100),
        registro_id INTEGER,
        datos_previos JSONB,
        datos_nuevos JSONB,
        ip_address VARCHAR(45),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      -- Create indexes
      CREATE INDEX IF NOT EXISTS idx_pacientes_dni ON pacientes(dni);
      CREATE INDEX IF NOT EXISTS idx_citas_fecha ON citas(fecha_hora);
      CREATE INDEX IF NOT EXISTS idx_citas_estado ON citas(estado);
      CREATE INDEX IF NOT EXISTS idx_citas_medico ON citas(medico_id);
      CREATE INDEX IF NOT EXISTS idx_citas_paciente ON citas(paciente_id);
      CREATE INDEX IF NOT EXISTS idx_historiales_paciente ON historiales_clinicos(paciente_id);
      CREATE INDEX IF NOT EXISTS idx_facturas_paciente ON facturas(paciente_id);
      CREATE INDEX IF NOT EXISTS idx_camas_estado ON camas(estado);
      CREATE INDEX IF NOT EXISTS idx_audit_fecha ON audit_log(created_at);
    `);

    console.log('✅ Database tables created successfully!');
    
    // Insert default admin user (password: admin123)
    const bcrypt = require('bcryptjs');
    const adminPassword = await bcrypt.hash('admin123', 12);
    
    await client.query(`
      INSERT INTO usuarios (email, password_hash, rol, nombre, apellido)
      VALUES ('admin@hospital.com', $1, 'administrador', 'Admin', 'Sistema')
      ON CONFLICT (email) DO NOTHING
    `, [adminPassword]);

    console.log('✅ Default admin user created!');
    console.log('   Email: admin@hospital.com');
    console.log('   Password: admin123');
    
  } catch (error) {
    console.error('❌ Error initializing database:', error);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
};

initDb();
