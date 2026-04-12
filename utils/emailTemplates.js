export function verifyEmailTemplate(name, code) {
  return `
    <div style="font-family: Arial; background:#f9fafb; padding:20px;">
      <div style="max-width:500px; margin:auto; background:white; padding:20px; border-radius:8px;">
        
        <h2 style="color:#2563eb;">Welcome to Isonga Market 🎉</h2>

        <p>Hi ${name},</p>

        <p>Verify your email using this code:</p>

        <div style="
          font-size:28px;
          font-weight:bold;
          text-align:center;
          margin:20px 0;
          letter-spacing:5px;
        ">
          ${code}
        </div>

        <p>This code expires in 10 minutes.</p>

        <p style="color:#6b7280;">
          If you didn’t request this, ignore this email.
        </p>

      </div>
    </div>
  `;
}