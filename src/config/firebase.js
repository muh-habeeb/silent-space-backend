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
  const serviceAccountPath = process.env.FIREBASE_SERVICE_ACCOUNT || './firebase-service-account.json';
  const serviceAccount = require(path.resolve(serviceAccountPath));

  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });
}

const db = admin.firestore();

module.exports = { admin, db };
