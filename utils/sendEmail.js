const nodemailer = require('nodemailer');

const sendEmail = async (email, subject, htmlContent) => {
  // 1. Production Validation: Ensure credentials exist before trying to connect
  if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
    console.error("CRITICAL: Email credentials missing in Environment Variables.");
    return { success: false, error: "Configuration Error" };
  }

  try {
    // 2. Optimized Transporter for Cloud Hosting
    // Using host/port is often more stable than 'service: gmail' on cloud servers
    const transporter = nodemailer.createTransport({
      host: 'smtp.gmail.com',
      port: 465,
      secure: true, // Use SSL/TLS
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS, // Must be 16-character App Password
      },
      // Helps bypass common DNS/Certificate issues on Render
      tls: {
        rejectUnauthorized: false 
      },
      // Set a timeout so the request doesn't hang forever
      connectionTimeout: 10000, 
    });

    // 3. Verify connection before sending
    await transporter.verify();

    // 4. Send the mail
    const info = await transporter.sendMail({
      from: `"Isonga Market" <${process.env.EMAIL_USER}>`,
      to: email,
      subject: subject,
      html: htmlContent,
    });

    console.log(`✅ Email sent to ${email}. MessageID: ${info.messageId}`);
    return { success: true, messageId: info.messageId };

  } catch (error) {
    // 5. Detailed Production Logging
    console.error("❌ NODEMAILER ERROR:");
    console.error(`Status Code: ${error.code}`);
    console.error(`Response: ${error.response}`);
    
    // In production, we return the error status to the calling function
    return { success: false, error: error.message };
  }
};

module.exports = sendEmail;