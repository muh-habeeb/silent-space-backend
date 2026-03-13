const express = require('express');
const { createOrderHandler, verifyOrderHandler } = require('../controllers/orderController');

const router = express.Router();

// POST /api/orders/create
// Body: { uid: string, planId: "base"|"super"|"pro" }
router.post('/create', createOrderHandler);

// GET /api/orders/verify/:orderId
router.get('/verify/:orderId', verifyOrderHandler);

module.exports = router;
