const jwt = require('jsonwebtoken');
const { pool } = require('../config/database');

// LOGIN
exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;

    const userResult = await pool.query(
      'SELECT * FROM usuarios WHERE email = $1',
      [email]
    );

    if (userResult.rows.length === 0) {
      return res.status(401).json({ error: 'Credenciales inválidas' });
    }

    const user = userResult.rows[0];

    const isMatch = await bcrypt.compare(password, user.password);

    if (!isMatch) {
      return res.status(401).json({ error: 'Credenciales inválidas' });
    }

    const token = jwt.sign(
      { id: user.id, role: user.role },
      process.env.JWT_SECRET || 'supersecretkey',
      { expiresIn: '8h' }
    );

   res.json({
      message: 'Login exitoso',
      token,
      user: {
        id: user.id,
        email: user.email,
        role: user.role
      }
    });

  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error en login' });
  }
};

// CREAR ADMIN INICIAL
exports.createAdmin = async (req, res) => {
  try {
    const email = 'admin@hospital.com';
    const password = '123456';

    const existing = await pool.query(
      'SELECT * FROM usuarios WHERE email = $1',
      [email]
    );

    if (existing.rows.length > 0) {
      return res.json({ message: 'Admin ya existe' });
    }

  const hashedPassword = await bcrypt.hash(password, 10);

    await pool.query(
      `INSERT INTO usuarios (email, password, role)
       VALUES ($1, $2, $3)`,
      [email, hashedPassword, 'admin']
    );

    res.json({ message: 'Admin creado correctamente' });

  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error creando admin' });
  }
};
