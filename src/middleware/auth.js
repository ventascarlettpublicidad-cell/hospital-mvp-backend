const jwt = require('jsonwebtoken');
const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  user: process.env.DB_USER || 'postgres',
  host: process.env.DB_HOST || 'localhost',
  database: process.env.DB_NAME || 'hospital_db',
  password: process.env.DB_PASSWORD || 'postgres',
  port: process.env.DB_PORT || 5432,
});

// Middleware para verificar JWT
const authenticate = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Token no proporcionado' });
    }

    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Obtener usuario de la base de datos
    const result = await pool.query(
      'SELECT id, email, rol, nombre, apellido, activo FROM usuarios WHERE id = $1',
      [decoded.userId]
    );

    if (result.rows.length === 0 || !result.rows[0].activo) {
      return res.status(401).json({ error: 'Usuario no válido o inactivo' });
    }

    req.user = result.rows[0];
    next();
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Token expirado' });
    }
    return res.status(401).json({ error: 'Token inválido' });
  }
};

// Control de acceso basado en roles
const authorize = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'No autenticado' });
    }

    if (!roles.includes(req.user.rol)) {
      return res.status(403).json({ 
        error: 'No tienes permisos para realizar esta acción',
        required: roles,
        current: req.user.rol
      });
    }

    next();
  };
};

// Verificar permisos específicos
const checkPermission = (permission) => {
  return (req, res, next) => {
    const permissions = {
      // Pacientes
      'pacientes:read': ['administrador', 'recepcion', 'medico', 'enfermeria'],
      'pacientes:write': ['administrador', 'recepcion'],
      'pacientes:delete': ['administrador'],
      
      // Médicos
      'medicos:read': ['administrador', 'recepcion', 'medico', 'enfermeria'],
      'medicos:write': ['administrador'],
      'medicos:delete': ['administrador'],
      
      // Citas
      'citas:read': ['administrador', 'recepcion', 'medico', 'enfermeria'],
      'citas:write': ['administrador', 'recepcion', 'medico'],
      'citas:cancel': ['administrador', 'recepcion', 'medico'],
      
      // Historial Clínico
      'historial:read': ['administrador', 'medico', 'enfermeria'],
      'historial:write': ['administrador', 'medico'],
      
      // Facturas
      'facturas:read': ['administrador', 'recepcion'],
      'facturas:write': ['administrador', 'recepcion'],
      
      // Camas
      'camas:read': ['administrador', 'recepcion', 'enfermeria'],
      'camas:write': ['administrador', 'enfermeria'],
      
      // Usuarios
      'usuarios:read': ['administrador'],
      'usuarios:write': ['administrador'],
    };

    const allowedRoles = permissions[permission];
    
    if (!allowedRoles) {
      return res.status(500).json({ error: 'Permiso no definido' });
    }

    if (!allowedRoles.includes(req.user.rol)) {
      return res.status(403).json({ error: 'No tienes permiso para esta acción' });
    }

    next();
  };
};

module.exports = {
  authenticate,
  authorize,
  checkPermission,
  pool
};
