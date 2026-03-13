/**
 * orderController.js
 * 
 * POST /api/orders/create
 * GET  /api/orders/verify/:orderId
 * 
 * Body: { uid: string, planId: "base"|"super"|"pro" }
 */
const {
  findExistingPendingOrder,
  savePendingOrder,
  checkUserExists,
  activatePlan,
  markPendingOrderDone,
  getUserEmail,
  PLANS,
} = require('../services/firestoreService');
const {
  createOrder,
  fetchOrder,
  fetchPaymentsForOrder,
} = require('../services/razorpayService');
const { sendInvoiceEmail } = require('../services/emailService');
const { db } = require('../config/firebase');

async function createOrderHandler(req, res) {
  try {
    const { uid, planId } = req.body;

    // ── Validation ────────────────────────────────────────────────────────────
    if (!uid || typeof uid !== 'string' || uid.trim().length === 0) {
      return res.status(400).json({ error: 'uid is required' });
    }

    // Ensure user exists in Firestore
    const userExists = await checkUserExists(uid);
    if (!userExists) {
      return res.status(404).json({ error: 'User does not exist. Please sign in first.' });
    }

    const plan = PLANS[planId];
    if (!plan) {
      return res.status(400).json({
        error: `Invalid planId. Must be one of: ${Object.keys(PLANS).join(', ')}`,
      });
    }

    // ── Idempotency check ─────────────────────────────────────────────────────
    const existing = await findExistingPendingOrder(uid, planId);
    if (existing) {
      console.log(`♻️  Reusing existing order ${existing.orderId} for uid=${uid} plan=${planId}`);
      return res.json({
        orderId: existing.orderId,
        amount: existing.amountInPaise,
        currency: 'INR',
        keyId: process.env.RAZORPAY_KEY_ID,
        reused: true,
      });
    }

    // ── Create new Razorpay order ─────────────────────────────────────────────
    const receipt = `${uid.slice(0, 20)}_${planId}_${Date.now()}`;
    const order = await createOrder(plan.priceInPaise, receipt, {
      uid,
      planId,
      planName: plan.name,
    });

    // ── Persist pending order for idempotency ─────────────────────────────────
    await savePendingOrder({
      orderId: order.id,
      uid,
      planId,
      amountInPaise: plan.priceInPaise,
      amountInRupees: plan.price,
      receipt,
    });

    console.log(`✅ Created Razorpay order ${order.id} for uid=${uid} plan=${planId} amount=₹${plan.price}`);

    return res.json({
      orderId: order.id,
      amount: plan.priceInPaise,
      currency: 'INR',
      keyId: process.env.RAZORPAY_KEY_ID,
      reused: false,
    });
  } catch (err) {
    console.error('createOrderHandler error:', err);
    return res.status(500).json({ error: 'Failed to create order', details: err.message });
  }
}

async function verifyOrderHandler(req, res) {
  try {
    const { orderId } = req.params;
    if (!orderId) return res.status(400).json({ error: 'orderId is required' });

    console.log(`🔍 Manually verifying order: ${orderId}`);

    // 1. Fetch order from Razorpay
    const order = await fetchOrder(orderId);
    
    // 2. Fetch payments for this order
    const payments = await fetchPaymentsForOrder(orderId);
    console.log(`ℹ️  Found ${payments.items.length} payments for order ${orderId}`);
    
    // Log each payment status for debugging
    payments.items.forEach(p => console.log(`   - Payment ${p.id}: status=${p.status}, method=${p.method}`));

    // 3. Find if any payment is 'captured'
    const successfulPayment = payments.items.find(p => p.status === 'captured');

    if (successfulPayment) {
      const uid = order.notes.uid;
      const planId = order.notes.planId || order.notes.plan_id;

      // Check if already activated in Firestore
      const txRef = db.collection('paymentTransactions').doc(successfulPayment.id);
      const txSnap = await txRef.get();
      
      if (!txSnap.exists) {
        // Activate now
        await activatePlan({
          uid,
          planId,
          paymentId: successfulPayment.id,
          orderId,
          amountInPaise: successfulPayment.amount,
        });
        await markPendingOrderDone(orderId, 'paid');
        console.log(`✅ Manually activated plan '${planId}' for uid=${uid}`);

        // ── Send invoice email ───────────────────────────────────────────
        try {
          const email = await getUserEmail(uid);
          const plan = PLANS[planId];
          if (email && plan) {
            await sendInvoiceEmail({
              toEmail: email,
              userName: email.split('@')[0],
              planName: plan.name,
              amountInRupees: plan.price,
              paymentId: successfulPayment.id,
              orderId: orderId,
            });
          }
        } catch (emailErr) {
          console.error('📧 Manual verification email failure:', emailErr.message);
        }
      }

      return res.json({ 
        status: 'paid', 
        paymentId: successfulPayment.id,
        planId 
      });
    }

    return res.json({ 
      status: order.status || 'pending',
      reason: payments.items.length > 0 ? `Latest payment status: ${payments.items[0].status}` : 'No payment attempt found yet'
    });
  } catch (err) {
    console.error('verifyOrderHandler error:', err);
    return res.status(500).json({ error: 'Verification failed', details: err.message });
  }
}

module.exports = { createOrderHandler, verifyOrderHandler };
