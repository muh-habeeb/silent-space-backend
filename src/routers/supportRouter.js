const express = require('express');
const { handleSupportRequest } = require('../controllers/supportController');

const router = express.Router();

// POST /api/support/contact
router.post('/contact', handleSupportRequest);

module.exports = router;
