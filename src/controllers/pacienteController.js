const { pool } = require('../middleware/auth');

// Get all patients
const getPacientes = async (req, res) => {
  try {
    const { page = 1, limit = 20, search = '' } = req.query;
    const offset = (page - 1) * limit;

    let query = `
      SELECT p.*, u.email as usuario_email
      FROM pacientes p
      LEFT JOIN usuarios u ON p.usuario_id = u.id
      WHERE p.activo = true
    `;
    const params = [];

    if (search) {
      params.push(`%${search}%`);
      query += ` AND (p.nombre ILIKE $${params.length} OR p.apellido ILIKE $${params.length} OR p.dni ILIKE $${params.length} OR p.telefono ILIKE $${params.length})`;
    }

    query += ` ORDER BY p.apellido, p.nombre LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
    params.push(limit, offset);

    const result = await pool.query(query, params);

    // Get total count
    let countQuery = 'SELECT COUNT(*) FROM pacientes WHERE activo = true';
    if (search) {
      countQuery += ` AND (nombre ILIKE $1 OR apellido ILIKE $1 OR dni ILIKE $1)`;
    }
    const countResult = await pool.query(countQuery, search ? [`%${search}%`] : []);
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
    console.error('Get pacientes error:', error);
    res.status(500).json({ error: 'Error en el servidor' });
  }
};

// Get single patient
const getPaciente = async (req, res) => {
  try {
    const { id } = req.params;
    
    const result = await pool.query(
      `SELECT p.*, u.email as usuario_email
       FROM pacientes p
       LEFT JOIN usuarios u ON p.usuario_id = u.id
       WHERE p.id = $1 AND p.activo = true`,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Paciente no encontrado' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Get paciente error:', error);
    res.status(500).json({ error: 'Error en el servidor' });
  }
};

// Create patient
const createPaciente = async (req, res) => {
  try {
    const {
      dni, nombre, apellido, fecha_nacimiento, genero,
      telefono, email, direccion, sangre_tipo, alergias,
      contacto_emergencia_nombre, contacto_emergencia_telefono, contacto_emergencia_parentesco
    } = req.body;

    // Check if DNI already exists
    const existing = await pool.query('SELECT id FROM pacientes WHERE dni = $1', [dni]);
    if (existing.rows.length > 0) {
      return res.status(400).json({ error: 'Ya existe un paciente con este DNI' });
    }

    const result = await pool.query(
      `INSERT INTO pacientes (
        dni, nombre, apellido, fecha_nacimiento, genero,
        telefono, email, direccion, sangre_tipo, alergias,
        contacto_emergencia_nombre, contacto_emergencia_telefono, contacto_emergencia_parentesco
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
      RETURNING *`,
      [
        dni, nombre, apellido, fecha_nacimiento, genero,
        telefono, email, direccion, sangre_tipo, alergias,
        contacto_emergencia_nombre, contacto_emergencia_telefono, contacto_emergencia_parentesco
      ]
    );

    res.status(201).json(result.rows[0]);
  } catch (error) {
    if (error.code === '23505') {
      return res.status(400).json({ error: 'Ya existe un paciente con este DNI' });
    }
    console.error('Create paciente error:', error);
    res.status(500).json({ error: 'Error en el servidor' });
  }
};

// Update patient
const updatePaciente = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      dni, nombre, apellido, fecha_nacimiento, genero,
      telefono, email, direccion, sangre_tipo, alergias,
      contacto_emergencia_nombre, contacto_emergencia_telefono, contacto_emergencia_parentesco
    } = req.body;

    // Check if patient exists
    const existing = await pool.query('SELECT id FROM pacientes WHERE id = $1 AND activo = true', [id]);
    if (existing.rows.length === 0) {
      return res.status(404).json({ error: 'Paciente no encontrado' });
    }

    // Check if DNI is being changed to one that already exists
    if (dni) {
      const dniExists = await pool.query(
        'SELECT id FROM pacientes WHERE dni = $1 AND id != $2',
        [dni, id]
      );
      if (dniExists.rows.length > 0) {
        return res.status(400).json({ error: 'Ya existe un paciente con este DNI' });
      }
    }

    const result = await pool.query(
      `UPDATE pacientes SET
        dni = COALESCE($1, dni),
        nombre = COALESCE($2, nombre),
        apellido = COALESCE($3, apellido),
        fecha_nacimiento = COALESCE($4, fecha_nacimiento),
        genero = COALESCE($5, genero),
        telefono = COALESCE($6, telefono),
        email = COALESCE($7, email),
        direccion = COALESCE($8, direccion),
        sangre_tipo = COALESCE($9, sangre_tipo),
        alergias = COALESCE($10, alergias),
        contacto_emergencia_nombre = COALESCE($11, contacto_emergencia_nombre),
        contacto_emergencia_telefono = COALESCE($12, contacto_emergencia_telefono),
        contacto_emergencia_parentesco = COALESCE($13, contacto_emergencia_parentesco),
        updated_at = NOW()
      WHERE id = $14 AND activo = true
      RETURNING *`,
      [
        dni, nombre, apellido, fecha_nacimiento, genero,
        telefono, email, direccion, sangre_tipo, alergias,
        contacto_emergencia_nombre, contacto_emergencia_telefono, contacto_emergencia_parentesco, id
      ]
    );

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Update paciente error:', error);
    res.status(500).json({ error: 'Error en el servidor' });
  }
};

// Delete (soft delete) patient
const deletePaciente = async (req, res) => {
  try {
    const { id } = req.params;

    const result = await pool.query(
      'UPDATE pacientes SET activo = false, updated_at = NOW() WHERE id = $1 AND activo = true RETURNING id',
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Paciente no encontrado' });
    }

    res.json({ message: 'Paciente eliminado correctamente' });
  } catch (error) {
    console.error('Delete paciente error:', error);
    res.status(500).json({ error: 'Error en el servidor' });
  }
};

module.exports = {
  getPacientes,
  getPaciente,
  createPaciente,
  updatePaciente,
  deletePaciente
};
