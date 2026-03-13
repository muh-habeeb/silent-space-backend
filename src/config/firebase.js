/**
 * firebase.js  – Initialize Firebase Admin SDK (singleton)
 * 
 * Download your service account JSON from:
 * Firebase Console → Project Settings → Service Accounts → Generate new private key
 * Save it as firebase-service-account.json in smart_mute_server/
 */
const admin = require('firebase-admin');
const path = require('path');

if (!admin.apps.length) {
  let serviceAccount;

  // Check if FIREBASE_SERVICE_ACCOUNT is provided as a JSON string or a file path
  const saEnv = process.env.FIREBASE_SERVICE_ACCOUNT;
  
  if (saEnv) {
    if (saEnv.trim().startsWith('{')) {
      // It's a JSON string
      try {
        serviceAccount = JSON.parse(saEnv);
      } catch (err) {
        console.error('Failed to parse FIREBASE_SERVICE_ACCOUNT JSON string:', err.message);
      }
    } else {
      // It's a file path
      serviceAccount = require(path.resolve(saEnv));
    }
  }

  // Fallback to local file if not yet loaded
  if (!serviceAccount) {
    try {
      serviceAccount = require(path.resolve('./firebase-service-account.json'));
    } catch (err) {
      console.warn('⚠️ No firebase-service-account.json found and FIREBASE_SERVICE_ACCOUNT env var missing/invalid.');
      console.warn('   Ensure you set FIREBASE_SERVICE_ACCOUNT in your environment (Railway/Heroku/Vercel).');
    }
  }

  if (serviceAccount) {
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
    });
    console.log('🔥 Firebase Admin initialized successfully.');
  }
}

const db = admin.firestore();

module.exports = { admin, db };
