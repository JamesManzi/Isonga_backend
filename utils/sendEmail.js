const nodemailer = require("nodemailer");

const sendEmail = async (to, subject, html) => {
  try {
    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
      },
    });

    // send email
    const info = await transporter.sendMail({
      from: `"Isonga Market" <${process.env.EMAIL_USER}>`,
      to,
      subject,
      html,
    });

    console.log("✅ Email sent:", info.response);
    return true;

  } catch (error) {
    console.error("❌ Email error:", error);
    return false;
  }
};

module.exports = sendEmail;