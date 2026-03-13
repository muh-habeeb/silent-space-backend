/**
 * emailService.js
 * 
 * Sends a styled HTML invoice email to the user via Nodemailer + Gmail SMTP.
 * Configure EMAIL_USER and EMAIL_PASS (Gmail App Password) in .env
 */
const nodemailer = require('nodemailer');

let transporter;

function getTransporter() {
  if (!transporter) {
    transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
      },
    });
  }
  return transporter;
}

/**
 * sendInvoiceEmail – sends a payment confirmation + invoice to the user.
 * 
 * @param {object} params
 * @param {string} params.toEmail
 * @param {string} params.userName
 * @param {string} params.planName  e.g. "Super"
 * @param {number} params.amountInRupees  e.g. 15
 * @param {string} params.paymentId
 * @param {string} params.orderId
 */
async function sendInvoiceEmail({
  toEmail,
  userName,
  planName,
  amountInRupees,
  paymentId,
  orderId,
}) {
  const date = new Date().toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  });

  const html = `
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>Silent Space Invoice</title>
</head>
<body style="margin:0;padding:0;background:#0f1f1c;font-family:Arial,sans-serif;color:#e0e0e0;">
  <div style="max-width:560px;margin:40px auto;background:#162823;border-radius:16px;overflow:hidden;box-shadow:0 8px 32px rgba(0,0,0,0.4)">

    <!-- Header -->
    <div style="background:linear-gradient(135deg,#15e6a3,#0f8c60);padding:32px 32px 24px;text-align:center;">
      <div style="font-size:28px;margin-bottom:4px;">🎉</div>
      <h1 style="margin:0;font-size:22px;color:#000;font-weight:700;letter-spacing:-0.5px;">Payment Successful!</h1>
      <p style="margin:6px 0 0;font-size:14px;color:#004d30;">Your Silent Space subscription is active</p>
    </div>

    <!-- Body -->
    <div style="padding:28px 32px;">
      <p style="margin:0 0 20px;font-size:15px;">Hi <strong style="color:#15e6a3;">${userName || 'there'}</strong>,</p>
      <p style="margin:0 0 24px;font-size:14px;line-height:1.6;color:#b0c4be;">
        Thank you for upgrading to <strong style="color:#15e6a3;">Silent Space ${planName}</strong>!
        Your subscription is now active. Here's your invoice for your records.
      </p>

      <!-- Invoice box -->
      <div style="background:#1b322d;border-radius:12px;padding:20px 24px;margin-bottom:24px;">
        <table style="width:100%;border-collapse:collapse;font-size:14px;">
          <tr>
            <td style="padding:8px 0;color:#7fa99b;">Plan</td>
            <td style="padding:8px 0;text-align:right;color:#fff;font-weight:600;">Silent Space ${planName}</td>
          </tr>
          <tr>
            <td style="padding:8px 0;color:#7fa99b;border-top:1px solid #2a4a42;">Amount</td>
            <td style="padding:8px 0;text-align:right;color:#15e6a3;font-weight:700;font-size:18px;border-top:1px solid #2a4a42;">₹${amountInRupees}</td>
          </tr>
          <tr>
            <td style="padding:8px 0;color:#7fa99b;border-top:1px solid #2a4a42;">Date</td>
            <td style="padding:8px 0;text-align:right;border-top:1px solid #2a4a42;">${date}</td>
          </tr>
          <tr>
            <td style="padding:8px 0;color:#7fa99b;border-top:1px solid #2a4a42;">Payment ID</td>
            <td style="padding:8px 0;text-align:right;font-family:monospace;font-size:12px;border-top:1px solid #2a4a42;">${paymentId}</td>
          </tr>
          <tr>
            <td style="padding:8px 0;color:#7fa99b;border-top:1px solid #2a4a42;">Order ID</td>
            <td style="padding:8px 0;text-align:right;font-family:monospace;font-size:12px;border-top:1px solid #2a4a42;">${orderId}</td>
          </tr>
        </table>
      </div>

      <p style="margin:0 0 8px;font-size:13px;color:#7fa99b;line-height:1.6;">
        If you have any questions about your subscription, reply to this email.
      </p>
    </div>

    <!-- Footer -->
    <div style="padding:16px 32px 24px;text-align:center;border-top:1px solid #1b322d;">
      <p style="margin:0;font-size:12px;color:#4a6e65;">© ${new Date().getFullYear()} Silent Space. All rights reserved.</p>
    </div>
  </div>
</body>
</html>
  `.trim();

  await getTransporter().sendMail({
    from: process.env.EMAIL_FROM || process.env.EMAIL_USER,
    to: toEmail,
    subject: `🎉 Your Silent Space ${planName} subscription is active — Invoice #${paymentId.slice(-8).toUpperCase()}`,
    html,
  });

  console.log(`📧 Invoice sent to ${toEmail} for plan=${planName} paymentId=${paymentId}`);
}

/**
 * sendSupportEmail – sends a user support request to the admin.
 * @param {object} params
 * @param {string} params.fromEmail
 * @param {string} params.userName
 * @param {string} params.subject
 * @param {string} params.message
 */
async function sendSupportEmail({ fromEmail, userName, subject, message }) {
  const adminEmail = process.env.EMAIL_USER;
  
  const html = `
    <div style="font-family: Arial, sans-serif; background: #f4f4f4; padding: 20px;">
      <div style="max-width: 600px; margin: auto; background: white; padding: 20px; border-radius: 10px;">
        <h2 style="color: #333;">New Support Request</h2>
        <p><strong>From:</strong> ${userName} (${fromEmail})</p>
        <p><strong>Subject:</strong> ${subject}</p>
        <hr />
        <p style="white-space: pre-wrap;">${message}</p>
      </div>
    </div>
  `.trim();

  await getTransporter().sendMail({
    from: process.env.EMAIL_USER,
    to: adminEmail,
    subject: `[SUPPORT] ${subject}`,
    text: `Support Request from ${userName} (${fromEmail}):\n\n${message}`,
    html,
    replyTo: fromEmail,
  });

  console.log(`📧 Support email sent from ${fromEmail} to admin`);
}

module.exports = { sendInvoiceEmail, sendSupportEmail };
