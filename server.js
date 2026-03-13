require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { rawBodyMiddleware } = require('./src/middleware/rawBody');
const orderRouter = require('./src/routers/orderRouter');
const webhookRouter = require('./src/routers/webhookRouter');
const supportRouter = require('./src/routers/supportRouter');
const { seedSubscriptionPlans } = require('./src/services/firestoreService');

const app = express();
const PORT = process.env.PORT || 3000;

// CORS – allow Flutter app (all origins in dev; restrict in prod)
app.use(cors());

// Raw body middleware MUST come before express.json() for the webhook route
// so we can verify the Razorpay HMAC signature on the raw bytes.
app.use('/api/webhooks', rawBodyMiddleware);

// JSON body parser for all other routes
app.use(express.json());

// ── Routes ──────────────────────────────────────────────────────────────────
app.use('/api/orders', orderRouter);
app.use('/api/webhooks', webhookRouter);
app.use('/api/support', supportRouter);

// Health check
app.get('/health', (req, res) => res.json({ status: 'ok', server: 'SmartMute API' }));

// 404 fallback
app.use((req, res) => res.status(404).json({ error: 'Not found' }));

// ── Seed Firestore & Start ───────────────────────────────────────────────────
(async () => {
  try {
    await seedSubscriptionPlans();
    console.log('✅ Subscription plans seeded/verified in Firestore');
  } catch (err) {
    console.error('⚠️  Could not seed subscription plans:', err.message);
  }

  app.listen(PORT, () => {
    console.log(`🚀 SmartMute server running on http://localhost:${PORT}`);
  });
})();
