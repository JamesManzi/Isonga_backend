const nodemailer = require("nodemailer");

const sendEmail = async (to, subject, html) => {
  try {
    console.log("📧 Attempting to send email...");
    console.log("USER:", process.env.EMAIL_USER);

    const transporter = nodemailer.createTransport({
  service: "gmail", 
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS, // Ensure this is your 16-character App Password
  },
});

    const info = await transporter.sendMail({
      from: `"Isonga Market" <${process.env.EMAIL_USER}>`,
      to,
      subject,
      html,
    });

    console.log("✅ Email sent:", info.response);

    return { success: true };

  } catch (error) {
    console.error("❌ EMAIL ERROR FULL:", error); // VERY IMPORTANT
    return { success: false, error: error.message };
  }
};

module.exports = sendEmail;