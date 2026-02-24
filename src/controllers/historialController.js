const { pool } = require('../middleware/auth');

// Get medical records by patient
const getHistorialesPaciente = async (req, res) => {
  try {
    const { paciente_id } = req.params;
    const { page = 1, limit = 20 } = req.query;
    const offset = (page - 1) * limit;

    let query = `
      SELECT hc.*, 
             m.nombre as medico_nombre, m.apellido as medico_apellido, m.especialidad,
             c.fecha_hora as cita_fecha
      FROM historiales_clinicos hc
      LEFT JOIN medicos m ON hc.medico_id = m.id
      LEFT JOIN citas c ON hc.cita_id = c.id
      WHERE hc.paciente_id = $1
    `;
    const params = [paciente_id];

    query += ` ORDER BY hc.fecha DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
    params.push(limit, offset);

    const result = await pool.query(query, params);

    // Get total count
    const countResult = await pool.query(
      'SELECT COUNT(*) FROM historiales_clinicos WHERE paciente_id = $1',
      [paciente_id]
    );
    const total = parseInt(countResult.rows[0].count);

    res.json({
      data: result.rows,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        totalPages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('Get historiales paciente error:', error);
    res.status(500).json({ error: 'Error en el servidor' });
  }
};

// Get single medical record
const getHistorial = async (req, res) => {
  try {
    const { id } = req.params;
    
    const result = await pool.query(
      `SELECT hc.*, 
              m.nombre as medico_nombre, m.apellido as medico_apellido, m.especialidad,
              p.nombre as paciente_nombre, p.apellido as paciente_apellido, p.dni as paciente_dni
       FROM historiales_clinicos hc
       LEFT JOIN medicos m ON hc.medico_id = m.id
       JOIN pacientes p ON hc.paciente_id = p.id
       WHERE hc.id = $1`,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Historial clínico no encontrado' });
    }

    // Get attached files
    const files = await pool.query(
      'SELECT * FROM archivos_clinicos WHERE historial_id = $1 ORDER BY created_at',
      [id]
    );

    res.json({
      ...result.rows[0],
      archivos: files.rows
    });
  } catch (error) {
    console.error('Get historial error:', error);
    res.status(500).json({ error: 'Error en el servidor' });
  }
};

// Create medical record
const createHistorial = async (req, res) => {
  try {
    const {
      paciente_id, cita_id, motivo_consulta, diagnostico,
      tratamiento, receta, observaciones,
      peso, temperatura, presion_sistolica, presion_diastolica
    } = req.body;

    // Check if patient exists
    const paciente = await pool.query(
      'SELECT id FROM pacientes WHERE id = $1 AND activo = true',
      [paciente_id]
    );
    if (paciente.rows.length === 0) {
      return res.status(404).json({ error: 'Paciente no encontrado' });
    }

    const result = await pool.query(
      `INSERT INTO historiales_clinicos (
        paciente_id, cita_id, motivo_consulta, diagnostico,
        tratamiento, receta, observaciones,
        peso, temperatura, presion_sistolica, presion_diastolica, medico_id
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
      RETURNING *`,
      [
        paciente_id, cita_id, motivo_consulta, diagnostico,
        tratamiento, receta, observaciones,
        peso, temperatura, presion_sistolica, presion_diastolica,
        req.user.rol === 'medico' ? req.user.id : null
      ]
    );

    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Create historial error:', error);
    res.status(500).json({ error: 'Error en el servidor' });
  }
};

// Update medical record
const updateHistorial = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      motivo_consulta, diagnostico, tratamiento, receta, observaciones,
      peso, temperatura, presion_sistolica, presion_diastolica
    } = req.body;

    const existing = await pool.query('SELECT id FROM historiales_clinicos WHERE id = $1', [id]);
    if (existing.rows.length === 0) {
      return res.status(404).json({ error: 'Historial clínico no encontrado' });
    }

    const result = await pool.query(
      `UPDATE historiales_clinicos SET
        motivo_consulta = COALESCE($1, motivo_consulta),
        diagnostico = COALESCE($2, diagnostico),
        tratamiento = COALESCE($3, tratamiento),
        receta = COALESCE($4, receta),
        observaciones = COALESCE($5, observaciones),
        peso = COALESCE($6, peso),
        temperatura = COALESCE($7, temperatura),
        presion_sistolica = COALESCE($8, presion_sistolica),
        presion_diastolica = COALESCE($9, presion_diastolica),
        updated_at = NOW()
      WHERE id = $10
      RETURNING *`,
      [
        motivo_consulta, diagnostico, tratamiento, receta, observaciones,
        peso, temperatura, presion_sistolica, presion_diastolica, id
      ]
    );

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Update historial error:', error);
    res.status(500).json({ error: 'Error en el servidor' });
  }
};

// Upload file to medical record
const uploadArchivo = async (req, res) => {
  try {
    const { id } = req.params;

    if (!req.file) {
      return res.status(400).json({ error: 'No se ha proporcionado ningún archivo' });
    }

    const { tipo, nombre } = req.body;

    // Check if historial exists
    const historial = await pool.query('SELECT id FROM historiales_clinicos WHERE id = $1', [id]);
    if (historial.rows.length === 0) {
      return res.status(404).json({ error: 'Historial clínico no encontrado' });
    }

    const result = await pool.query(
      `INSERT INTO archivos_clinicos (
        historial_id, tipo, nombre, nombre_original, mime_type, tamano_bytes, url, uploaded_por
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING *`,
      [
        id, tipo || 'otro', nombre || req.file.originalname,
        req.file.originalname, req.file.mimetype, req.file.size,
        `/uploads/${req.file.filename}`, req.user.id
      ]
    );

    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Upload archivo error:', error);
    res.status(500).json({ error: 'Error en el servidor' });
  }
};

// Get files for a medical record
const getArchivosHistorial = async (req, res) => {
  try {
    const { id } = req.params;

    const result = await pool.query(
      'SELECT * FROM archivos_clinicos WHERE historial_id = $1 ORDER BY created_at',
      [id]
    );

    res.json(result.rows);
  } catch (error) {
    console.error('Get archivos historial error:', error);
    res.status(500).json({ error: 'Error en el servidor' });
  }
};

// Delete file from medical record
const deleteArchivo = async (req, res) => {
  try {
    const { historial_id, archivo_id } = req.params;

    const result = await pool.query(
      'DELETE FROM archivos_clinicos WHERE id = $1 AND historial_id = $2 RETURNING id',
      [archivo_id, historial_id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Archivo no encontrado' });
    }

    res.json({ message: 'Archivo eliminado correctamente' });
  } catch (error) {
    console.error('Delete archivo error:', error);
    res.status(500).json({ error: 'Error en el servidor' });
  }
};

module.exports = {
  getHistorialesPaciente,
  getHistorial,
  createHistorial,
  updateHistorial,
  uploadArchivo,
  getArchivosHistorial,
  deleteArchivo
};
