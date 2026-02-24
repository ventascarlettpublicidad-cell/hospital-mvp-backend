const { pool } = require('../middleware/auth');

// Get all doctors
const getMedicos = async (req, res) => {
  try {
    const { especialidad, activo = 'true' } = req.query;

    let query = `
      SELECT m.*, u.email as usuario_email
      FROM medicos m
      LEFT JOIN usuarios u ON m.usuario_id = u.id
      WHERE m.activo = $1
    `;
    const params = [activo === 'true'];

    if (especialidad) {
      params.push(especialidad);
      query += ` AND m.especialidad = $${params.length}`;
    }

    query += ` ORDER BY m.apellido, m.nombre`;

    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (error) {
    console.error('Get medicos error:', error);
    res.status(500).json({ error: 'Error en el servidor' });
  }
};

// Get single doctor
const getMedico = async (req, res) => {
  try {
    const { id } = req.params;
    
    const result = await pool.query(
      `SELECT m.*, u.email as usuario_email
       FROM medicos m
       LEFT JOIN usuarios u ON m.usuario_id = u.id
       WHERE m.id = $1 AND m.activo = true`,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Médico no encontrado' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Get medico error:', error);
    res.status(500).json({ error: 'Error en el servidor' });
  }
};

// Create doctor
const createMedico = async (req, res) => {
  try {
    const {
      nombre, apellido, especialidad, licencia,
      telefono, email, duracion_consulta_minutos
    } = req.body;

    // Check if license already exists
    const existing = await pool.query('SELECT id FROM medicos WHERE licencia = $1', [licencia]);
    if (existing.rows.length > 0) {
      return res.status(400).json({ error: 'Ya existe un médico con esta licencia' });
    }

    const result = await pool.query(
      `INSERT INTO medicos (
        nombre, apellido, especialidad, licencia,
        telefono, email, duracion_consulta_minutos
      ) VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING *`,
      [nombre, apellido, especialidad, licencia, telefono, email, duracion_consulta_minutos || 30]
    );

    res.status(201).json(result.rows[0]);
  } catch (error) {
    if (error.code === '23505') {
      return res.status(400).json({ error: 'Ya existe un médico con esta licencia' });
    }
    console.error('Create medico error:', error);
    res.status(500).json({ error: 'Error en el servidor' });
  }
};

// Update doctor
const updateMedico = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      nombre, apellido, especialidad, licencia,
      telefono, email, duracion_consulta_minutos
    } = req.body;

    const existing = await pool.query('SELECT id FROM medicos WHERE id = $1 AND activo = true', [id]);
    if (existing.rows.length === 0) {
      return res.status(404).json({ error: 'Médico no encontrado' });
    }

    // Check if license is being changed to one that already exists
    if (licencia) {
      const licenciaExists = await pool.query(
        'SELECT id FROM medicos WHERE licencia = $1 AND id != $2',
        [licencia, id]
      );
      if (licenciaExists.rows.length > 0) {
        return res.status(400).json({ error: 'Ya existe un médico con esta licencia' });
      }
    }

    const result = await pool.query(
      `UPDATE medicos SET
        nombre = COALESCE($1, nombre),
        apellido = COALESCE($2, apellido),
        especialidad = COALESCE($3, especialidad),
        licencia = COALESCE($4, licencia),
        telefono = COALESCE($5, telefono),
        email = COALESCE($6, email),
        duracion_consulta_minutos = COALESCE($7, duracion_consulta_minutos),
        updated_at = NOW()
      WHERE id = $8 AND activo = true
      RETURNING *`,
      [nombre, apellido, especialidad, licencia, telefono, email, duracion_consulta_minutos, id]
    );

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Update medico error:', error);
    res.status(500).json({ error: 'Error en el servidor' });
  }
};

// Delete (soft delete) doctor
const deleteMedico = async (req, res) => {
  try {
    const { id } = req.params;

    const result = await pool.query(
      'UPDATE medicos SET activo = false, updated_at = NOW() WHERE id = $1 AND activo = true RETURNING id',
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Médico no encontrado' });
    }

    res.json({ message: 'Médico eliminado correctamente' });
  } catch (error) {
    console.error('Delete medico error:', error);
    res.status(500).json({ error: 'Error en el servidor' });
  }
};

// Get doctor's schedule
const getMedicoHorarios = async (req, res) => {
  try {
    const { id } = req.params;

    const result = await pool.query(
      `SELECT * FROM medico_horarios WHERE medico_id = $1 AND activo = true ORDER BY dia_semana, hora_inicio`,
      [id]
    );

    res.json(result.rows);
  } catch (error) {
    console.error('Get medico horarios error:', error);
    res.status(500).json({ error: 'Error en el servidor' });
  }
};

// Create doctor's schedule
const createMedicoHorario = async (req, res) => {
  try {
    const { id } = req.params;
    const { dia_semana, hora_inicio, hora_fin } = req.body;

    // Validate day of week
    if (dia_semana < 0 || dia_semana > 6) {
      return res.status(400).json({ error: 'Día de la semana inválido (0-6)' });
    }

    // Check if doctor exists
    const medico = await pool.query('SELECT id FROM medicos WHERE id = $1 AND activo = true', [id]);
    if (medico.rows.length === 0) {
      return res.status(404).json({ error: 'Médico no encontrado' });
    }

    const result = await pool.query(
      `INSERT INTO medico_horarios (medico_id, dia_semana, hora_inicio, hora_fin)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [id, dia_semana, hora_inicio, hora_fin]
    );

    res.status(201).json(result.rows[0]);
  } catch (error) {
    if (error.code === '23505') {
      return res.status(400).json({ error: 'Ya existe un horario para este día' });
    }
    console.error('Create horario error:', error);
    res.status(500).json({ error: 'Error en el servidor' });
  }
};

// Get list of specialties
const getEspecialidades = async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT DISTINCT especialidad FROM medicos WHERE activo = true ORDER BY especialidad'
    );
    res.json(result.rows.map(r => r.especialidad));
  } catch (error) {
    console.error('Get especialidades error:', error);
    res.status(500).json({ error: 'Error en el servidor' });
  }
};

module.exports = {
  getMedicos,
  getMedico,
  createMedico,
  updateMedico,
  deleteMedico,
  getMedicoHorarios,
  createMedicoHorario,
  getEspecialidades
};
