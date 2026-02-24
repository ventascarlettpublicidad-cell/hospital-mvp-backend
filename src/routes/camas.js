const express = require('express');
const router = express.Router();
const { body, param, validationResult } = require('express-validator');
const camaController = require('../controllers/camaController');
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
router.get('/', checkPermission('camas:read'), camaController.getCamas);
router.post('/', checkPermission('camas:write'), camaController.createCama);

// Get, update, delete by ID
router.get('/:id', checkPermission('camas:read'), [param('id').isInt()], validate, camaController.getCama);
router.put('/:id', checkPermission('camas:write'), [param('id').isInt()], validate, camaController.updateCama);
router.delete('/:id', checkPermission('camas:write'), [param('id').isInt()], validate, camaController.deleteCama);

// Bed operations
router.post('/:id/asignar', checkPermission('camas:write'), camaController.asignarCama);
router.post('/:id/liberar', checkPermission('camas:write'), camaController.liberarCama);
router.post('/:id/disponible', checkPermission('camas:write'), camaController.marcarDisponible);

module.exports = router;
