const nodemailer = require("nodemailer");

const sendEmail = async (to, subject, html) => {
  try {
    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: process.env.EMAIL_USER,
        // IMPORTANT: Use a 16-character App Password, not your Gmail password
        pass: process.env.EMAIL_PASS, 
      },
    });

    const info = await transporter.sendMail({
      from: `"Isonga Market" <${process.env.EMAIL_USER}>`,
      to,
      subject,
      html,
    });

    console.log("✅ Email sent:", info.response);
    return { success: true }; // Corrected: returning an object
  } catch (error) {
    console.error("❌ Email error:", error);
    return { success: false, error: error.message }; // Corrected: returning an object
  }
};

module.exports = sendEmail;