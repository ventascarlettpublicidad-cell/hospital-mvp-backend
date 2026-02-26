const express = require('express');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

const initDb = require('./config/initDb');

const app = express();

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve uploaded files
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// Routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/pacientes', require('./routes/pacientes'));
app.use('/api/medicos', require('./routes/medicos'));
app.use('/api/citas', require('./routes/citas'));
app.use('/api/historiales', require('./routes/historiales'));
app.use('/api/facturas', require('./routes/facturas'));
app.use('/api/camas', require('./routes/camas'));

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Algo salió mal en el servidor' });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Ruta no encontrada' });
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, '0.0.0.0', () => {
  console.log(⁠ 🚀 Hospital Management API running on port ${PORT} ⁠);
});

// Ejecutar DB sin bloquear el servidor
initDb().catch(error => {
  console.error("❌ Error inicializando base de datos:", error);
});

module.exports = app;
