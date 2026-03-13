/**
 * razorpayService.js
 * 
 * Wraps the Razorpay SDK for:
 * - Creating orders (server-side, with idempotency via receipt field)
 * - Verifying webhook HMAC-SHA256 signatures (strict verification)
 */
const Razorpay = require('razorpay');
const crypto = require('crypto');

const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET,
});

/**
 * createOrder – creates a Razorpay order.
 * 
 * The `receipt` field gives idempotency: Razorpay returns the same order
 * if you re-submit the same receipt within their dedup window.
 * 
 * @param {number} amountInPaise  e.g. 500 for ₹5
 * @param {string} receipt       unique per order attempt, e.g. "uid_planId_1710000000000"
 * @param {object} notes         arbitrary key-value stored with the order
 */
async function createOrder(amountInPaise, receipt, notes = {}) {
  return razorpay.orders.create({
    amount: amountInPaise,
    currency: 'INR',
    receipt,
    notes,
    payment_capture: 1, // auto-capture
  });
}

/**
 * verifyWebhookSignature – strict HMAC-SHA256 verification.
 * 
 * Razorpay signs the raw request body with HMAC-SHA256 using the webhook secret.
 * We MUST use the raw bytes (not the parsed JSON) to verify.
 * 
 * @param {Buffer} rawBody       Raw request body buffer
 * @param {string} receivedSig   Value of `x-razorpay-signature` header
 * @returns {boolean}
 */
function verifyWebhookSignature(rawBody, receivedSig) {
  const expectedSig = crypto
    .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
    .update(rawBody)
    .digest('hex');

  // Constant-time comparison to prevent timing attacks
  try {
    return crypto.timingSafeEqual(
      Buffer.from(expectedSig, 'hex'),
      Buffer.from(receivedSig, 'hex'),
    );
  } catch {
    return false;
  }
}

async function fetchOrder(orderId) {
  return razorpay.orders.fetch(orderId);
}

async function fetchPaymentsForOrder(orderId) {
  return razorpay.orders.fetchPayments(orderId);
}

module.exports = { 
  createOrder, 
  verifyWebhookSignature,
  fetchOrder,
  fetchPaymentsForOrder
};
