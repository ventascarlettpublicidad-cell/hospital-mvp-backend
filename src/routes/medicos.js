const express = require('express');
const router = express.Router();
const { body, param, validationResult } = require('express-validator');
const medicoController = require('../controllers/medicoController');
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
router.get('/', checkPermission('medicos:read'), medicoController.getMedicos);
router.get('/especialidades', checkPermission('medicos:read'), medicoController.getEspecialidades);
router.post('/', checkPermission('medicos:write'), medicoController.createMedico);

// Get, update, delete by ID
router.get('/:id', checkPermission('medicos:read'), [param('id').isInt()], validate, medicoController.getMedico);
router.put('/:id', checkPermission('medicos:write'), [param('id').isInt()], validate, medicoController.updateMedico);
router.delete('/:id', checkPermission('medicos:delete'), [param('id').isInt()], validate, medicoController.deleteMedico);

// Schedules
router.get('/:id/horarios', checkPermission('medicos:read'), medicoController.getMedicoHorarios);
router.post('/:id/horarios', checkPermission('medicos:write'), medicoController.createMedicoHorario);

module.exports = router;
