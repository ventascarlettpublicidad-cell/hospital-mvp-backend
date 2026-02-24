const express = require('express');
const router = express.Router();
const facturaController = require('../controllers/facturaController');
const { authenticate, checkPermission } = require('../middleware/auth');

router.use(authenticate);

// SOLO las funciones que existen en tu controller
router.get('/', checkPermission('facturas:read'), facturaController.getFacturas);
router.post('/', checkPermission('facturas:write'), facturaController.createFactura);

module.exports = router;