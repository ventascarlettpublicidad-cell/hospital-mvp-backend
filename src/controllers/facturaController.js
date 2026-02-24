const { pool } = require('../middleware/auth');

// Get all invoices
const getFacturas = async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT f.*, 
             p.nombre as paciente_nombre, 
             p.apellido as paciente_apellido
      FROM facturas f
      JOIN pacientes p ON f.paciente_id = p.id
      ORDER BY f.created_at DESC
    `);

    res.json(result.rows);
  } catch (error) {
    console.error('Get facturas error:', error);
    res.status(500).json({ error: 'Error en el servidor' });
  }
};

// Create invoice
const createFactura = async (req, res) => {
  try {
    const { paciente_id, cita_id, concepto, monto, igv, observaciones } = req.body;

    const paciente = await pool.query(
      'SELECT id FROM pacientes WHERE id = $1 AND activo = true',
      [paciente_id]
    );

    if (paciente.rows.length === 0) {
      return res.status(404).json({ error: 'Paciente no encontrado' });
    }

    const countResult = await pool.query('SELECT COUNT(*) FROM facturas');
    const numFactura = `FAC-${String(parseInt(countResult.rows[0].count) + 1).padStart(6, '0')}`;

    const igvAmount = igv || 0;
    const totalAmount = parseFloat(monto) + igvAmount;

    const result = await pool.query(
      `INSERT INTO facturas (
        paciente_id, cita_id, numero_factura, concepto, monto, igv, total, observaciones
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING *`,
      [paciente_id, cita_id, numFactura, concepto, monto, igvAmount, totalAmount, observaciones]
    );

    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Create factura error:', error);
    res.status(500).json({ error: 'Error en el servidor' });
  }
};

module.exports = {
  getFacturas,
  createFactura
};