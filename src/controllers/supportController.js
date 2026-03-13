/**
 * supportController.js
 * 
 * Handles contact form submissions.
 */
const { sendSupportEmail } = require('../services/emailService');

async function handleSupportRequest(req, res) {
  try {
    const { fromEmail, userName, subject, message } = req.body;

    if (!fromEmail || !userName || !subject || !message) {
      return res.status(400).json({ error: 'All fields are required: fromEmail, userName, subject, message' });
    }

    await sendSupportEmail({ fromEmail, userName, subject, message });

    return res.json({ status: 'success', message: 'Support message sent successfully' });
  } catch (err) {
    console.error('handleSupportRequest error:', err);
    return res.status(500).json({ error: 'Failed to send support message', details: err.message });
  }
}

module.exports = { handleSupportRequest };
