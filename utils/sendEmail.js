const nodemailer = require("nodemailer");

const sendEmail = async (email, subject, htmlContent) => {
  try {
    if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
      console.error("❌ Missing email environment variables");
      return { success: false, error: "Missing credentials" };
    }

    const transporter = nodemailer.createTransport({
      host: "smtp.gmail.com",
      port: 465,
      secure: true,
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS.trim(), // 🔥 IMPORTANT
      },
    });

    // Verify connection
    await transporter.verify();

    const info = await transporter.sendMail({
      from: `"Isonga Market" <${process.env.EMAIL_USER}>`,
      to: email,
      subject: subject,
      html: htmlContent,
    });

    console.log("✅ Email sent:", info.messageId);

    return { success: true };
  } catch (error) {
    console.error("❌ EMAIL ERROR FULL:", error); // 🔥 FULL ERROR
    return { success: false, error: error.message };
  }
};

module.exports = sendEmail;