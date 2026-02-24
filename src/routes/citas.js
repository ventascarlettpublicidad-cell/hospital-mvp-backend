const express = require('express');
const router = express.Router();
const { body, param, query, validationResult } = require('express-validator');
const citaController = require('../controllers/citaController');
const { authenticate, checkPermission } = require('../middleware/auth');

const validate = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }
  next();
};

// All routes require authentication
router.use(authenticate);

// List and create
router.get('/', checkPermission('citas:read'), citaController.getCitas);
router.post('/', checkPermission('citas:write'), citaController.createCita);

// Get, update, delete by ID
router.get('/:id', checkPermission('citas:read'), [param('id').isInt()], validate, citaController.getCita);
router.put('/:id', checkPermission('citas:write'), [param('id').isInt()], validate, citaController.updateCita);
router.delete('/:id', checkPermission('citas:cancel'), [param('id').isInt()], validate, citaController.deleteCita);

// Update status
router.patch('/:id/estado', checkPermission('citas:write'), [param('id').isInt()], validate, citaController.updateEstadoCita);

// Check availability
router.get('/disponibilidad', checkPermission('citas:read'), [
  query('medico_id').isInt(),
  query('fecha').isISO8601()
], validate, citaController.getDisponibilidad);

module.exports = router;
