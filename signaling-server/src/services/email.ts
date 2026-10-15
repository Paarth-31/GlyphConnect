import nodemailer from 'nodemailer';

const SMTP_HOST = process.env.SMTP_HOST ?? 'smtp.gmail.com';
const SMTP_PORT = parseInt(process.env.SMTP_PORT ?? '587');
const SMTP_USER = process.env.SMTP_USER ?? '';
const SMTP_PASS = process.env.SMTP_PASS ?? '';
const SMTP_FROM = process.env.SMTP_FROM ?? `"GlyphConnect" <${SMTP_USER}>`;

let _transporter: nodemailer.Transporter | null = null;

function getTransporter(): nodemailer.Transporter {
  if (!_transporter) {
    if (!SMTP_USER || !SMTP_PASS) {
      throw new Error('SMTP not configured. Set SMTP_HOST/USER/PASS in .env');
    }
    _transporter = nodemailer.createTransport({
      host: SMTP_HOST,
      port: SMTP_PORT,
      secure: SMTP_PORT === 465,
      auth: { user: SMTP_USER, pass: SMTP_PASS },
    });
  }
  return _transporter;
}

export async function sendPasswordResetEmail(
  to: string,
  resetUrl: string
): Promise<void> {
  const transporter = getTransporter();

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin:0;padding:0;background:#0a0a0b;font-family:'Segoe UI',system-ui,sans-serif;">
  <div style="max-width:480px;margin:40px auto;padding:32px;background:#111113;border-radius:16px;border:1px solid rgba(255,255,255,0.08);">
    
    <!-- Logo / Brand -->
    <div style="text-align:center;margin-bottom:24px;">
      <div style="display:inline-flex;align-items:center;gap:8px;">
        <div style="width:32px;height:32px;background:linear-gradient(135deg,#6366f1,#8b5cf6);border-radius:8px;display:flex;align-items:center;justify-content:center;">
          <span style="color:white;font-size:16px;font-weight:bold;">G</span>
        </div>
        <span style="color:#e5e5e5;font-size:18px;font-weight:700;letter-spacing:-0.5px;">GlyphConnect</span>
      </div>
    </div>

    <h1 style="color:#e5e5e5;font-size:20px;font-weight:700;text-align:center;margin:0 0 8px;">
      Reset Your Password
    </h1>
    <p style="color:rgba(255,255,255,0.4);font-size:13px;text-align:center;margin:0 0 28px;line-height:1.5;">
      We received a request to reset the password for your account. Click the button below to set a new password.
    </p>

    <!-- CTA Button -->
    <div style="text-align:center;margin-bottom:28px;">
      <a href="${resetUrl}"
         style="display:inline-block;padding:12px 32px;background:linear-gradient(135deg,#4f46e5,#7c3aed);color:white;font-size:14px;font-weight:700;text-decoration:none;border-radius:10px;letter-spacing:0.3px;">
        Reset Password
      </a>
    </div>

    <p style="color:rgba(255,255,255,0.25);font-size:11px;text-align:center;margin:0 0 16px;line-height:1.5;">
      This link expires in <strong style="color:rgba(255,255,255,0.4);">1 hour</strong>.
      If you didn't request a password reset, you can safely ignore this email.
    </p>

    <hr style="border:none;border-top:1px solid rgba(255,255,255,0.06);margin:20px 0;">

    <p style="color:rgba(255,255,255,0.15);font-size:10px;text-align:center;margin:0;line-height:1.4;">
      If the button doesn't work, copy and paste this URL into your browser:<br>
      <a href="${resetUrl}" style="color:#6366f1;word-break:break-all;font-size:10px;">${resetUrl}</a>
    </p>
  </div>
</body>
</html>`;

  await transporter.sendMail({
    from: SMTP_FROM,
    to,
    subject: 'Reset your GlyphConnect password',
    html,
    text: `Reset your GlyphConnect password\n\nClick this link to reset your password:\n${resetUrl}\n\nThis link expires in 1 hour. If you didn't request this, ignore this email.`,
  });

  console.log(`[Email] Password reset email sent to ${to}`);
}
