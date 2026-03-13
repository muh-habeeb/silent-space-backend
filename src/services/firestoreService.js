/**
 * firestoreService.js
 * 
 * All Firestore operations for the server:
 * - Seed subscription plans
 * - Idempotency: create / fetch pending orders
 * - Activate a plan after successful payment
 * - Record payment transactions (success & failure)
 * - Helper to get user email for invoice
 */
const { db } = require('../config/firebase');
const { FieldValue } = require('firebase-admin/firestore');

// ── Subscription Plans ────────────────────────────────────────────────────────

const PLANS = {
  base: {
    id: 'base',
    name: 'Base',
    price: 5,
    priceInPaise: 500,
    maxLocations: 5,
    hasBannerAds: true,
    hasVideoAds: false,
    hasInterstitialAds: false,
    description: '5 saved locations · Banner ads only',
    features: [
      '5 silent locations',
      'Banner ads displayed',
      'Basic geofencing',
    ],
    order: 1,
  },
  super: {
    id: 'super',
    name: 'Super',
    price: 15,
    priceInPaise: 1500,
    maxLocations: 10,
    hasBannerAds: false,
    hasVideoAds: false,
    hasInterstitialAds: false,
    description: '10 saved locations · No ads',
    features: [
      '10 silent locations',
      'No banner or video ads',
      'Priority geofencing',
    ],
    order: 2,
  },
  pro: {
    id: 'pro',
    name: 'Pro',
    price: 20,
    priceInPaise: 2000,
    maxLocations: 9999,
    hasBannerAds: false,
    hasVideoAds: false,
    hasInterstitialAds: false,
    description: 'Unlimited locations · Completely ad-free',
    features: [
      'Unlimited silent locations',
      'Zero ads of any kind',
      'Priority geofencing',
    ],
    order: 3,
  },
};

/**
 * Seed subscription plans into Firestore if they don't exist yet.
 * Called once on server startup.
 */
async function seedSubscriptionPlans() {
  const col = db.collection('subscriptionplans');
  const batch = db.batch();
  let anyMissing = false;

  for (const [id, plan] of Object.entries(PLANS)) {
    const ref = col.doc(id);
    const snap = await ref.get();
    if (!snap.exists) {
      batch.set(ref, { ...plan, createdAt: FieldValue.serverTimestamp() });
      anyMissing = true;
    }
  }

  if (anyMissing) await batch.commit();
}

// ── Idempotency: Pending Orders ───────────────────────────────────────────────

/**
 * findExistingPendingOrder – returns an unexpired pending order for uid+planId,
 * or null if none exists. Orders expire after 30 minutes.
 */
async function findExistingPendingOrder(uid, planId) {
  const thirtyMinsAgo = Date.now() - 30 * 60 * 1000;
  const snap = await db
    .collection('pendingOrders')
    .where('uid', '==', uid)
    .where('planId', '==', planId)
    .where('status', '==', 'pending')
    .where('createdAtMs', '>=', thirtyMinsAgo)
    .orderBy('createdAtMs', 'desc')
    .limit(1)
    .get();

  if (snap.empty) return null;
  return snap.docs[0].data();
}

/**
 * savePendingOrder – stores order metadata in Firestore for idempotency tracking.
 */
async function savePendingOrder({ orderId, uid, planId, amountInPaise, amountInRupees, receipt }) {
  await db.collection('pendingOrders').doc(orderId).set({
    orderId,
    uid,
    planId,
    amountInPaise,
    amountInRupees,
    receipt,
    status: 'pending',
    createdAtMs: Date.now(),
    createdAt: FieldValue.serverTimestamp(),
  });
}

/**
 * markPendingOrderDone – transitions a pending order to 'paid' or 'failed'.
 */
async function markPendingOrderDone(orderId, status) {
  const ref = db.collection('pendingOrders').doc(orderId);
  const snap = await ref.get();
  if (snap.exists) {
    await ref.update({ status, updatedAt: FieldValue.serverTimestamp() });
  }
}

// ── User & Payment ────────────────────────────────────────────────────────────

/**
 * getUserEmail – fetch the stored email from the users collection.
 * Used to send invoice email.
 */
async function getUserEmail(uid) {
  const snap = await db.collection('users').doc(uid).get();
  return snap.exists ? snap.data().email : null;
}

/**
 * checkUserExists – returns true if the user document exists in the 'users' collection.
 */
async function checkUserExists(uid) {
  const snap = await db.collection('users').doc(uid).get();
  return snap.exists;
}

/**
 * activatePlan – called after successful payment webhook.
 * Updates the user document and writes a success transaction record.
 */
async function activatePlan({ uid, planId, paymentId, orderId, amountInPaise }) {
  const batch = db.batch();

  // Update user
  const userRef = db.collection('users').doc(uid);
  batch.update(userRef, {
    plan: planId,
    isPaid: true,
    paymentId,
    orderId,
    activatedAt: FieldValue.serverTimestamp(),
    lastUpdatedAt: FieldValue.serverTimestamp(),
  });

  // Record transaction
  const txRef = db.collection('paymentTransactions').doc(paymentId);
  batch.set(txRef, {
    paymentId,
    orderId,
    uid,
    planId,
    amountInPaise,
    amountInRupees: amountInPaise / 100,
    status: 'success',
    createdAt: FieldValue.serverTimestamp(),
  });

  await batch.commit();
}

/**
 * recordPaymentFailure – records a failed payment in paymentTransactions.
 */
async function recordPaymentFailure({ uid, planId, orderId, errorCode, errorDescription }) {
  await db.collection('paymentTransactions').add({
    uid,
    planId,
    orderId: orderId || null,
    errorCode: errorCode || 'UNKNOWN',
    errorDescription: errorDescription || 'Payment failed',
    status: 'failed',
    createdAt: FieldValue.serverTimestamp(),
  });
}

module.exports = {
  seedSubscriptionPlans,
  findExistingPendingOrder,
  savePendingOrder,
  markPendingOrderDone,
  getUserEmail,
  checkUserExists,
  activatePlan,
  recordPaymentFailure,
  PLANS,
};
