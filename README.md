# Silent Space Backend Server 🚀

This is the backend server for the **Silent Space** Flutter application.

## 🛠️ Features
- **Razorpay Integration**: Order creation and payment status verification.
- **Webhooks**: Automated Firestore updates for subscriptions.
- **Support System**: Contact form handler with email notifications.

## 🚀 Setup
1. **Install Dependencies**:
   ```bash
   npm install
   ```
2. **Environment Configuration**:
   Create a `.env` file from `.env.example`. Make sure to include:
   - Razorpay Keys
   - Firebase Service Account path
   - Email credentials for support forms

3. **Firebase Keys**:
   Ensure `firebase-service-account.json` is present in the server root.

4. **Run Server**:
   ```bash
   npm run dev
   ```

5. **Public Access (Webhooks)**:
   Use `ngrok http 3000` to expose the server for Razorpay webhooks.

## 🔗 Connection
- **Local Dev URL**: `http://10.0.2.2:3000` (Android Emulator)
- **Webhook URL**: `https://<your-ngrok-url>/api/orders/webhook`
