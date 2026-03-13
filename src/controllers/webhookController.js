/**
 * webhookController.js
 * 
 * POST /api/webhooks/razorpay
 * 
 * Handles:
 * - payment.captured  → activate plan, send invoice email
 * - payment.failed    → record failure
 * 
 * Security:
 * - Strict HMAC-SHA256 signature verification on raw body bytes
 * - Idempotent: checks if paymentTransactions/{paymentId} already exists before writing
 */
const { verifyWebhookSignature } = require('../services/razorpayService');
const {
  activatePlan,
  recordPaymentFailure,
  markPendingOrderDone,
  getUserEmail,
  PLANS,
} = require('../services/firestoreService');
const { sendInvoiceEmail } = require('../services/emailService');
const { db } = require('../config/firebase');

async function handleWebhook(req, res) {
  // ── 1. Signature Verification ─────────────────────────────────────────────
  const receivedSig = req.headers['x-razorpay-signature'];
  if (!receivedSig) {
    console.warn('⚠️  Webhook received without signature header');
    return res.status(400).json({ error: 'Missing signature' });
  }

  const rawBody = req.rawBody; // set by rawBodyMiddleware
  if (!rawBody) {
    console.warn('⚠️  rawBody is missing – middleware not applied correctly');
    return res.status(400).json({ error: 'Cannot verify signature' });
  }

  const isValid = verifyWebhookSignature(rawBody, receivedSig);
  if (!isValid) {
    console.warn('🚫 Invalid Razorpay signature. Ignoring webhook.');
    return res.status(401).json({ error: 'Invalid signature' });
  }

  // ── 2. Parse event ────────────────────────────────────────────────────────
  let event;
  try {
    event = JSON.parse(rawBody.toString('utf-8'));
  } catch {
    return res.status(400).json({ error: 'Invalid JSON' });
  }

  const eventType = event.event;
  const payload = event.payload?.payment?.entity;

  console.log(`📥 Webhook received: ${eventType}`);

  // ── 3. Acknowledge immediately (Razorpay expects a fast 200) ─────────────
  res.status(200).json({ received: true });

  // ── 4. Handle event asynchronously ───────────────────────────────────────
  if (!payload) {
    console.warn('⚠️  No payment entity in webhook payload');
    return;
  }

  const paymentId = payload.id;
  const orderId = payload.order_id;
  const notes = payload.notes || {};
  const uid = notes.uid;
  const planId = notes.planId || notes.plan_id;

  if (eventType === 'payment.captured') {
    await handlePaymentCaptured({ paymentId, orderId, uid, planId, payload });
  } else if (eventType === 'payment.failed') {
    await handlePaymentFailed({ paymentId, orderId, uid, planId, payload });
  } else {
    console.log(`ℹ️  Unhandled webhook event: ${eventType}`);
  }
}

// ── Handlers ──────────────────────────────────────────────────────────────────

async function handlePaymentCaptured({ paymentId, orderId, uid, planId, payload }) {
  try {
    // ── Idempotency: skip if already processed ────────────────────────────
    const txRef = db.collection('paymentTransactions').doc(paymentId);
    const txSnap = await txRef.get();
    if (txSnap.exists) {
      console.log(`⏭️  Payment ${paymentId} already processed. Skipping.`);
      return;
    }

    const plan = PLANS[planId];
    if (!plan) {
      console.error(`❌ Unknown planId: ${planId} for payment ${paymentId}`);
      return;
    }

    if (!uid) {
      console.error(`❌ No uid in payment notes for payment ${paymentId}`);
      return;
    }

    // ── Activate plan in Firestore ────────────────────────────────────────
    await activatePlan({
      uid,
      planId,
      paymentId,
      orderId,
      amountInPaise: payload.amount,
    });

    // ── Mark pending order done ───────────────────────────────────────────
    if (orderId) await markPendingOrderDone(orderId, 'paid');

    console.log(`✅ Plan '${planId}' activated for uid=${uid}, paymentId=${paymentId}`);

    // ── Send invoice email ────────────────────────────────────────────────
    try {
      const email = await getUserEmail(uid);
      if (email) {
        const displayName = payload.email?.split('@')[0] || 'there';
        await sendInvoiceEmail({
          toEmail: email,
          userName: displayName,
          planName: plan.name,
          amountInRupees: plan.price,
          paymentId,
          orderId: orderId || 'N/A',
        });
      } else {
        console.warn(`⚠️  No email found for uid=${uid}. Invoice not sent.`);
      }
    } catch (emailErr) {
      // Email failure MUST NOT fail the webhook handler
      console.error('📧 Failed to send invoice email:', emailErr.message);
    }
  } catch (err) {
    console.error('handlePaymentCaptured error:', err);
  }
}

async function handlePaymentFailed({ paymentId, orderId, uid, planId, payload }) {
  try {
    await recordPaymentFailure({
      uid: uid || 'unknown',
      planId: planId || 'unknown',
      orderId,
      errorCode: payload.error_code || 'BAD_REQUEST_ERROR',
      errorDescription: payload.error_description || 'Payment failed',
    });

    if (orderId) await markPendingOrderDone(orderId, 'failed');

    console.log(`❌ Payment failed: uid=${uid} planId=${planId} orderId=${orderId}`);
  } catch (err) {
    console.error('handlePaymentFailed error:', err);
  }
}

module.exports = { handleWebhook };
