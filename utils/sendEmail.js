const nodemailer = require('nodemailer');

const sendEmail = async (email, subject, htmlContent) => {
  try {
    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
      },
    });

    await transporter.sendMail({
      from: `"Isonga Market" <${process.env.EMAIL_USER}>`,
      to: email,
      subject: subject,
      html: htmlContent,
    });
    console.log("Verification email sent to:", email);
  } catch (error) {
    console.error("Email error:", error);
  }
};

module.exports = sendEmail;