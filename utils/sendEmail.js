const nodemailer = require("nodemailer");

const sendEmail = async (to, subject, html) => {
  try {
    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS, // 16-char Gmail App Password
      },
    });

    await transporter.verify(); // ensure connection is okay

    const info = await transporter.sendMail({
      from: `"Isonga Market" <${process.env.EMAIL_USER}>`,
      to,
      subject,
      html,
    });

    console.log("✅ Email sent:", info.response);
    return { success: true };
  } catch (error) {
    console.error("❌ Email error:", error);
    return { success: false, error: error.message };
  }
};

module.exports = sendEmail;