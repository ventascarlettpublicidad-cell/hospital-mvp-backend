const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const authController = require('../controllers/authController');
const { authenticate } = require('../middleware/auth');

// Validation middleware
const validate = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }
  next();
};

// Public routes
router.post('/login', [
  body('email').isEmail().normalizeEmail(),
  body('password').notEmpty()
], validate, authController.login);

router.post('/logout', authenticate, authController.logout);

// Protected routes
router.get('/me', authenticate, authController.getMe);

// Admin only routes
router.post('/users', authenticate, authController.createUser);
router.get('/users', authenticate, authController.getUsers);

module.exports = router;
