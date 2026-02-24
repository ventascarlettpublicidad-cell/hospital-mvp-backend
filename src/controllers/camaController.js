const { pool } = require('../middleware/auth');

// Get all beds
const getCamas = async (req, res) => {
  try {
    const { estado, tipo, planta } = req.query;

    let query = `
      SELECT c.*, 
             p.nombre as paciente_nombre, p.apellido as paciente_apellido, p.dni as paciente_dni
      FROM camas c
      LEFT JOIN pacientes p ON c.paciente_id = p.id
      WHERE 1=1
    `;
    const params = [];

    if (estado) {
      params.push(estado);
      query += ` AND c.estado = $${params.length}`;
    }

    if (tipo) {
      params.push(tipo);
      query += ` AND c.tipo = $${params.length}`;
    }

    if (planta) {
      params.push(planta);
      query += ` AND c.planta = $${params.length}`;
    }

    query += ' ORDER BY c.planta, c.numero';

    const result = await pool.query(query, params);

    // Get summary
    const summary = await pool.query(`
      SELECT 
        COUNT(*) as total,
        SUM(CASE WHEN estado = 'disponible' THEN 1 ELSE 0 END) as disponibles,
        SUM(CASE WHEN estado = 'ocupada' THEN 1 ELSE 0 END) as ocupadas,
        SUM(CASE WHEN estado = 'limpieza' THEN 1 ELSE 0 END) as limpieza
      FROM camas
    `);

    res.json({
      data: result.rows,
      resumen: summary.rows[0]
    });
  } catch (error) {
    console.error('Get camas error:', error);
    res.status(500).json({ error: 'Error en el servidor' });
  }
};

// Get single bed
const getCama = async (req, res) => {
  try {
    const { id } = req.params;
    
    const result = await pool.query(
      `SELECT c.*, 
              p.nombre as paciente_nombre, p.apellido as paciente_apellido, p.dni as paciente_dni
       FROM camas c
       LEFT JOIN pacientes p ON c.paciente_id = p.id
       WHERE c.id = $1`,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Cama no encontrada' });
    }

    // Get occupancy history
    const history = await pool.query(
      `SELECT ch.*, p.nombre as paciente_nombre, p.apellido as paciente_apellido
       FROM cama_historial ch
       JOIN pacientes p ON ch.paciente_id = p.id
       WHERE ch.cama_id = $1
       ORDER BY ch.fecha_entrada DESC
       LIMIT 10`,
      [id]
    );

    res.json({
      ...result.rows[0],
      historial: history.rows
    });
  } catch (error) {
    console.error('Get cama error:', error);
    res.status(500).json({ error: 'Error en el servidor' });
  }
};

// Create bed
const createCama = async (req, res) => {
  try {
    const { numero, tipo, planta, descripcion } = req.body;

    // Check if bed number already exists on that floor
    const existing = await pool.query(
      'SELECT id FROM camas WHERE numero = $1 AND planta = $2',
      [numero, planta]
    );
    if (existing.rows.length > 0) {
      return res.status(400).json({ error: 'Ya existe una cama con ese número en esta planta' });
    }

    const result = await pool.query(
      `INSERT INTO camas (numero, tipo, planta, descripcion)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [numero, tipo || 'estandar', planta, descripcion]
    );

    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Create cama error:', error);
    res.status(500).json({ error: 'Error en el servidor' });
  }
};

// Update bed
const updateCama = async (req, res) => {
  try {
    const { id } = req.params;
    const { numero, tipo, planta, descripcion, estado } = req.body;

    const existing = await pool.query('SELECT id, numero, planta FROM camas WHERE id = $1', [id]);
    if (existing.rows.length === 0) {
      return res.status(404).json({ error: 'Cama no encontrada' });
    }

    // Check if new bed number already exists
    const newNumero = numero || existing.rows[0].numero;
    const newPlanta = planta || existing.rows[0].planta;
    
    if (numero || planta) {
      const conflict = await pool.query(
        'SELECT id FROM camas WHERE numero = $1 AND planta = $2 AND id != $3',
        [newNumero, newPlanta, id]
      );
      if (conflict.rows.length > 0) {
        return res.status(400).json({ error: 'Ya existe una cama con ese número en esta planta' });
      }
    }

    const result = await pool.query(
      `UPDATE camas SET
        numero = COALESCE($1, numero),
        tipo = COALESCE($2, tipo),
        planta = COALESCE($3, planta),
        descripcion = COALESCE($4, descripcion),
        estado = COALESCE($5, estado),
        updated_at = NOW()
      WHERE id = $6
      RETURNING *`,
      [numero, tipo, planta, descripcion, estado, id]
    );

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Update cama error:', error);
    res.status(500).json({ error: 'Error en el servidor' });
  }
};

// Assign bed to patient
const asignarCama = async (req, res) => {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    
    const { id } = req.params;
    const { paciente_id, motivo } = req.body;

    // Check if bed exists and is available
    const cama = await client.query(
      'SELECT id, estado, paciente_id FROM camas WHERE id = $1',
      [id]
    );
    
    if (cama.rows.length === 0) {
      throw new Error('Cama no encontrada');
    }

    if (cama.rows[0].estado !== 'disponible') {
      throw new Error('La cama no está disponible');
    }

    // Check if patient exists
    const paciente = await client.query(
      'SELECT id, nombre, apellido FROM pacientes WHERE id = $1 AND activo = true',
      [paciente_id]
    );
    
    if (paciente.rows.length === 0) {
      throw new Error('Paciente no encontrado');
    }

    // Update bed
    await client.query(
      `UPDATE camas SET
        estado = 'ocupada',
        paciente_id = $1,
        fecha_asignacion = NOW(),
        updated_at = NOW()
      WHERE id = $2`,
      [paciente_id, id]
    );

    // Add to history
    await client.query(
      `INSERT INTO cama_historial (cama_id, paciente_id, fecha_entrada, motivo)
       VALUES ($1, $2, NOW(), $3)`,
      [id, paciente_id, motivo]
    );

    await client.query('COMMIT');

    const result = await pool.query('SELECT * FROM camas WHERE id = $1', [id]);
    res.json(result.rows[0]);
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Asignar cama error:', error);
    res.status(400).json({ error: error.message });
  } finally {
    client.release();
  }
};

// Release bed
const liberarCama = async (req, res) => {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    
    const { id } = req.params;
    const { motivo } = req.body;

    // Check if bed exists and is occupied
    const cama = await client.query(
      'SELECT id, estado, paciente_id FROM camas WHERE id = $1',
      [id]
    );
    
    if (cama.rows.length === 0) {
      throw new Error('Cama no encontrada');
    }

    if (cama.rows[0].estado !== 'ocupada') {
      throw new Error('La cama no está ocupada');
    }

    const pacienteId = cama.rows[0].paciente_id;

    // Update bed
    await client.query(
      `UPDATE camas SET
        estado = 'limpieza',
        paciente_id = NULL,
        fecha_liberacion = NOW(),
        updated_at = NOW()
      WHERE id = $1`,
      [id]
    );

    // Update history
    await client.query(
      `UPDATE cama_historial SET
        fecha_salida = NOW(),
        motivo = COALESCE($1, motivo)
      WHERE cama_id = $2 AND paciente_id = $3 AND fecha_salida IS NULL`,
      [motivo, id, pacienteId]
    );

    await client.query('COMMIT');

    const result = await pool.query('SELECT * FROMimas WHERE id = $1', [id]);
    res.json(result.rows[0]);
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Liberar cama error:', error);
    res.status(400).json({ error: error.message });
  } finally {
    client.release();
  }
};

// Mark bed as available after cleaning
const marcarDisponible = async (req, res) => {
  try {
    const { id } = req.params;

    const existing = await pool.query('SELECT id, estado FROM camas WHERE id = $1', [id]);
    if (existing.rows.length === 0) {
      return res.status(404).json({ error: 'Cama no encontrada' });
    }

    if (existing.rows[0].estado !== 'limpieza') {
      return res.status(400).json({ error: 'La cama debe estar en limpieza para marcarse como disponible' });
    }

    const result = await pool.query(
      `UPDATE camas SET
        estado = 'disponible',
        updated_at = NOW()
      WHERE id = $1
      RETURNING *`,
      [id]
    );

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Marcar disponible error:', error);
    res.status(500).json({ error: 'Error en el servidor' });
  }
};

// Delete bed
const deleteCama = async (req, res) => {
  try {
    const { id } = req.params;

    const existing = await pool.query('SELECT id, estado FROM camas WHERE id = $1', [id]);
    if (existing.rows.length === 0) {
      return res.status(404).json({ error: 'Cama no encontrada' });
    }

    if (existing.rows[0].estado === 'ocupada') {
      return res.status(400).json({ error: 'No se puede eliminar una cama ocupada' });
    }

    await pool.query('DELETE FROM cama_historial WHERE cama_id = $1', [id]);
    await pool.query('DELETE FROM camas WHERE id = $1', [id]);

    res.json({ message: 'Cama eliminada correctamente' });
  } catch (error) {
    console.error('Delete cama error:', error);
    res.status(500).json({ error: 'Error en el servidor' });
  }
};

module.exports = {
  getCamas,
  getCama,
  createCama,
  updateCama,
  asignarCama,
  liberarCama,
  marcarDisponible,
  deleteCama
};
