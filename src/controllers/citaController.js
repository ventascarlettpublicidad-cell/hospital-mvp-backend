const { pool } = require('../middleware/auth');

// Get all appointments
const getCitas = async (req, res) => {
  try {
    const { 
      page = 1, 
      limit = 20, 
      medico_id, 
      paciente_id, 
      estado, 
      fecha_inicio, 
      fecha_fin 
    } = req.query;
    
    const offset = (page - 1) * limit;
    let query = `
      SELECT c.*, 
             p.nombre as paciente_nombre, p.apellido as paciente_apellido, p.dni as paciente_dni,
             m.nombre as medico_nombre, m.apellido as medico_apellido, m.especialidad
      FROM citas c
      JOIN pacientes p ON c.paciente_id = p.id
      JOIN medicos m ON c.medico_id = m.id
      WHERE 1=1
    `;
    const params = [];

    if (medico_id) {
      params.push(medico_id);
      query += ` AND c.medico_id = $${params.length}`;
    }

    if (paciente_id) {
      params.push(paciente_id);
      query += ` AND c.paciente_id = $${params.length}`;
    }

    if (estado) {
      params.push(estado);
      query += ` AND c.estado = $${params.length}`;
    }

    if (fecha_inicio) {
      params.push(fecha_inicio);
      query += ` AND c.fecha_hora >= $${params.length}`;
    }

    if (fecha_fin) {
      params.push(fecha_fin);
      query += ` AND c.fecha_hora <= $${params.length}`;
    }

    query += ` ORDER BY c.fecha_hora DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
    params.push(limit, offset);

    const result = await pool.query(query, params);

    // Get total count
    let countQuery = 'SELECT COUNT(*) FROM citas WHERE 1=1';
    if (medico_id) countQuery += ` AND medico_id = ${medico_id}`;
    if (paciente_id) countQuery += ` AND paciente_id = ${paciente_id}`;
    if (estado) countQuery += ` AND estado = '${estado}'`;
    
    const countResult = await pool.query(countQuery);
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
    console.error('Get citas error:', error);
    res.status(500).json({ error: 'Error en el servidor' });
  }
};

// Get single appointment
const getCita = async (req, res) => {
  try {
    const { id } = req.params;
    
    const result = await pool.query(
      `SELECT c.*, 
              p.nombre as paciente_nombre, p.apellido as paciente_apellido, p.dni as paciente_dni,
              m.nombre as medico_nombre, m.apellido as medico_apellido, m.especialidad
       FROM citas c
       JOIN pacientes p ON c.paciente_id = p.id
       JOIN medicos m ON c.medico_id = m.id
       WHERE c.id = $1`,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Cita no encontrada' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Get cita error:', error);
    res.status(500).json({ error: 'Error en el servidor' });
  }
};

// Create appointment
const createCita = async (req, res) => {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    
    const { paciente_id, medico_id, fecha_hora, duracion_minutos, motivo } = req.body;

    // Check if patient exists
    const paciente = await client.query(
      'SELECT id FROM pacientes WHERE id = $1 AND activo = true',
      [paciente_id]
    );
    if (paciente.rows.length === 0) {
      throw new Error('Paciente no encontrado');
    }

    // Check if doctor exists
    const medico = await client.query(
      'SELECT id, duracion_consulta_minutos FROM medicos WHERE id = $1 AND activo = true',
      [medico_id]
    );
    if (medico.rows.length === 0) {
      throw new Error('Médico no encontrado');
    }

    const duracion = duracion_minutos || medico.rows[0].duracion_consulta_minutos;

    // Check for conflicts
    const conflicts = await client.query(
      `SELECT id FROM citas 
       WHERE medico_id = $1 
       AND estado NOT IN ('cancelada')
       AND (
         (fecha_hora <= $2 AND DATE_ADD(fecha_hora, INTERVAL '1 minute' * duracion_minutos) > $2)
         OR
         (fecha_hora < DATE_ADD($2, INTERVAL '1 minute' * $3) AND fecha_hora >= $2)
       )`,
      [medico_id, fecha_hora, duracion]
    );

    if (conflicts.rows.length > 0) {
      throw new Error('El médico ya tiene una cita en ese horario');
    }

    const result = await client.query(
      `INSERT INTO citas (paciente_id, medico_id, fecha_hora, duracion_minutos, motivo)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [paciente_id, medico_id, fecha_hora, duracion, motivo]
    );

    await client.query('COMMIT');
    res.status(201).json(result.rows[0]);
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Create cita error:', error);
    res.status(400).json({ error: error.message || 'Error en el servidor' });
  } finally {
    client.release();
  }
};

// Update appointment
const updateCita = async (req, res) => {
  try {
    const { id } = req.params;
    const { fecha_hora, duracion_minutos, motivo, estado } = req.body;

    const existing = await pool.query('SELECT id, estado FROM citas WHERE id = $1', [id]);
    if (existing.rows.length === 0) {
      return res.status(404).json({ error: 'Cita no encontrada' });
    }

    const result = await pool.query(
      `UPDATE citas SET
        fecha_hora = COALESCE($1, fecha_hora),
        duracion_minutos = COALESCE($2, duracion_minutos),
        motivo = COALESCE($3, motivo),
        estado = COALESCE($4, estado),
        updated_at = NOW()
      WHERE id = $5
      RETURNING *`,
      [fecha_hora, duracion_minutos, motivo, estado, id]
    );

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Update cita error:', error);
    res.status(500).json({ error: 'Error en el servidor' });
  }
};

// Update appointment status
const updateEstadoCita = async (req, res) => {
  try {
    const { id } = req.params;
    const { estado, motivo_cancelacion } = req.body;

    const validStates = ['pendiente', 'confirmada', 'cancelada', 'atendida', 'no_asistio'];
    if (!validStates.includes(estado)) {
      return res.status(400).json({ error: 'Estado inválido' });
    }

    const existing = await pool.query('SELECT id, estado FROM citas WHERE id = $1', [id]);
    if (existing.rows.length === 0) {
      return res.status(404).json({ error: 'Cita no encontrada' });
    }

    const result = await pool.query(
      `UPDATE citas SET
        estado = $1,
        cancelada_por = $2,
        motivo_cancelacion = $3,
        updated_at = NOW()
      WHERE id = $4
      RETURNING *`,
      [estado, req.user.id, motivo_cancelacion, id]
    );

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Update estado cita error:', error);
    res.status(500).json({ error: 'Error en el servidor' });
  }
};

// Delete/Cancel appointment
const deleteCita = async (req, res) => {
  try {
    const { id } = req.params;
    const { motivo_cancelacion } = req.body;

    const result = await pool.query(
      `UPDATE citas SET
        estado = 'cancelada',
        cancelada_por = $1,
        motivo_cancelacion = $2,
        updated_at = NOW()
      WHERE id = $3
      RETURNING *`,
      [req.user.id, motivo_cancelacion, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Cita no encontrada' });
    }

    res.json({ message: 'Cita cancelada correctamente', cita: result.rows[0] });
  } catch (error) {
    console.error('Delete cita error:', error);
    res.status(500).json({ error: 'Error en el servidor' });
  }
};

// Get available slots for a doctor on a specific date
const getDisponibilidad = async (req, res) => {
  try {
    const { medico_id, fecha } = req.query;

    if (!medico_id || !fecha) {
      return res.status(400).json({ error: 'Médico y fecha requeridos' });
    }

    // Get doctor's schedule for the day of week
    const dayOfWeek = new Date(fecha).getDay();
    
    const schedule = await pool.query(
      `SELECT hora_inicio, hora_fin FROM medico_horarios 
       WHERE medico_id = $1 AND dia_semana = $2 AND activo = true`,
      [medico_id, dayOfWeek]
    );

    if (schedule.rows.length === 0) {
      return res.json({ available: false, message: 'El médico no trabaja este día' });
    }

    // Get appointments for that day
    const appointments = await pool.query(
      `SELECT fecha_hora, duracion_minutos FROM citas 
       WHERE medico_id = $1 AND DATE(fecha_hora) = $2 AND estado NOT IN ('cancelada')`,
      [medico_id, fecha]
    );

    // Get doctor's default duration
    const medico = await pool.query(
      'SELECT duracion_consulta_minutos FROM medicos WHERE id = $1',
      [medico_id]
    );

    const defaultDuration = medico.rows[0]?.duracion_consulta_minutos || 30;
    const startTime = schedule.rows[0].hora_inicio;
    const endTime = schedule.rows[0].hora_fin;

    // Calculate available slots
    const slots = [];
    let currentTime = new Date(`${fecha}T${startTime}`);
    const endDateTime = new Date(`${fecha}T${endTime}`);

    while (currentTime < endDateTime) {
      const slotEnd = new Date(currentTime.getTime() + defaultDuration * 60000);
      
      // Check if slot conflicts with any appointment
      const isAvailable = !appointments.rows.some(apt => {
        const aptStart = new Date(apt.fecha_hora);
        const aptEnd = new Date(aptStart.getTime() + apt.duracion_minutos * 60000);
        return (currentTime < aptEnd && slotStart > aptStart);
      });

      if (isAvailable && slotEnd <= endDateTime) {
        slots.push(currentTime.toISOString());
      }

      currentTime = slotEnd;
    }

    res.json({
      fecha,
      medico_id,
      disponible: slots.length > 0,
      slots
    });
  } catch (error) {
    console.error('Get disponibilidad error:', error);
    res.status(500).json({ error: 'Error en el servidor' });
  }
};

module.exports = {
  getCitas,
  getCita,
  createCita,
  updateCita,
  updateEstadoCita,
  deleteCita,
  getDisponibilidad
};
