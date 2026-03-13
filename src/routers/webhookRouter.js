const express = require('express');
const { handleWebhook } = require('../controllers/webhookController');

const router = express.Router();

// POST /api/webhooks/razorpay
// Razorpay must be configured to POST to this URL in the Razorpay Dashboard > Webhooks
router.post('/razorpay', handleWebhook);

module.exports = router;
