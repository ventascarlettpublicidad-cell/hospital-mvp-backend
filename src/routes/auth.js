const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');

// LOGIN
router.post('/login', authController.login);

// CREAR ADMIN
router.post('/create-admin', authController.createAdmin);

module.exports = router;
