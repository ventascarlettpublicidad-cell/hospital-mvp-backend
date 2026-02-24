const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const { body, param, validationResult } = require('express-validator');
const historialController = require('../controllers/historialController');
const { authenticate, checkPermission } = require('../middleware/auth');

const validate = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }
  next();
};

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, path.join(__dirname, '../../uploads'));
  },
  filename: (req, file, cb) => {
    const uniqueName = `${uuidv4()}${path.extname(file.originalname)}`;
    cb(null, uniqueName);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
  fileFilter: (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|pdf|doc|docx/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);
    if (extname && mimetype) {
      return cb(null, true);
    }
    cb(new Error('Tipo de archivo no permitido'));
  }
});

// All routes require authentication
router.use(authenticate);

// Get medical records by patient
router.get('/paciente/:paciente_id', checkPermission('historial:read'), historialController.getHistorialesPaciente);

// CRUD for medical records
router.get('/:id', checkPermission('historial:read'), [param('id').isInt()], validate, historialController.getHistorial);
router.post('/', checkPermission('historial:write'), historialController.createHistorial);
router.put('/:id', checkPermission('historial:write'), [param('id').isInt()], validate, historialController.updateHistorial);

// File management
router.post('/:id/archivos', checkPermission('historial:write'), upload.single('archivo'), historialController.uploadArchivo);
router.get('/:id/archivos', checkPermission('historial:read'), historialController.getArchivosHistorial);
router.delete('/:historial_id/archivos/:archivo_id', checkPermission('historial:write'), historialController.deleteArchivo);

module.exports = router;
