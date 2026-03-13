/**
 * rawBody.js
 * 
 * Preserves the raw Buffer of the request body on `req.rawBody`.
 * This is required for Razorpay webhook HMAC-SHA256 signature verification —
 * the signature is computed over the exact raw bytes, not a parsed JSON string.
 */
const express = require('express');

const rawBodyMiddleware = express.raw({
  type: 'application/json',
  limit: '1mb',
  // Store raw body on req for signature verification
  verify: (req, _res, buf) => {
    req.rawBody = buf;
  },
});

module.exports = { rawBodyMiddleware };
