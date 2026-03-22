const sendEmail = async (to, subject, html) => {
  try {
    console.log("📧 Attempting to send email...");
    console.log("USER:", process.env.EMAIL_USER);
    console.log("PASS EXISTS:", !!process.env.EMAIL_PASS);

    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
      },
    });

    // 🔥 VERIFY CONNECTION FIRST
    await transporter.verify();
    console.log("✅ SMTP connection ready");

    const info = await transporter.sendMail({
      from: `"Isonga Market" <${process.env.EMAIL_USER}>`,
      to,
      subject,
      html,
    });

    console.log("✅ Email sent:", info.response);

    return { success: true };

  } catch (error) {
    console.error("❌ EMAIL ERROR FULL:", error);
    return { success: false, error: error.message };
  }
};