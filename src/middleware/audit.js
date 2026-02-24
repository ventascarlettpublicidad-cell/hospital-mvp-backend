const { pool } = require('./auth');

// Middleware para registrar acciones en el log de auditoría
const auditLog = (tabla, accion) => {
  return async (req, res, next) => {
    const originalSend = res.send;
    
    res.send = function (body) {
      // Solo registrar si la operación fue exitosa
      if (res.statusCode >= 200 && res.statusCode < 300 && req.user) {
        pool.query(
          `INSERT INTO audit_log (usuario_id, accion, tabla_afectada, registro_id, ip_address)
           VALUES ($1, $2, $3, $4, $5)`,
          [
            req.user.id,
            accion,
            tabla,
            res.locals.auditId || null,
            req.ip || req.connection.remoteAddress
          ]
        ).catch(console.error);
      }
      
      originalSend.call(this, body);
    };
    
    next();
  };
};

// Función helper para registrar datos específicos
const logAudit = async (usuarioId, accion, tabla, registroId, datosPrevios = null, datosNuevos = null) => {
  try {
    await pool.query(
      `INSERT INTO audit_log (usuario_id, accion, tabla_afectada, registro_id, datos_previos, datos_nuevos)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [usuarioId, accion, tabla, registroId, JSON.stringify(datosPrevios), JSON.stringify(datosNuevos)]
    );
  } catch (error) {
    console.error('Error logging audit:', error);
  }
};

module.exports = { auditLog, logAudit };
