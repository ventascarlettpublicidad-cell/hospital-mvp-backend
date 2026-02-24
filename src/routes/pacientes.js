const express = require('express');
const router = express.Router();
const { body, param, validationResult } = require('express-validator');
const pacienteController = require('../controllers/pacienteController');
const { authenticate, checkPermission } = require('../middleware/auth');

const validate = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }
  next();
};

// Validation rules
const pacienteValidation = [
  body('dni').notEmpty().withMessage('DNI es requerido'),
  body('nombre').notEmpty().withMessage('Nombre es requerido'),
  body('apellido').notEmpty().withMessage('Apellido es requerido'),
  body('fecha_nacimiento').isISO8601().withMessage('Fecha de nacimiento inválida'),
  body('telefono').optional(),
  body('email').optional().isEmail().withMessage('Email inválido'),
  body('sangre_tipo').optional().isIn(['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-']),
];

// All routes require authentication
router.use(authenticate);

// List and create
router.get('/', checkPermission('pacientes:read'), pacienteController.getPacientes);
router.post('/', checkPermission('pacientes:write'), pacienteValidation, validate, pacienteController.createPaciente);

// Get, update, delete by ID
router.get('/:id', checkPermission('pacientes:read'), [param('id').isInt()], validate, pacienteController.getPaciente);
router.put('/:id', checkPermission('pacientes:write'), [param('id').isInt()], validate, pacienteController.updatePaciente);
router.delete('/:id', checkPermission('pacientes:delete'), [param('id').isInt()], validate, pacienteController.deletePaciente);

module.exports = router;
