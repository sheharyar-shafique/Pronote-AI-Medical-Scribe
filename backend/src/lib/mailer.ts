import nodemailer from 'nodemailer';

function createTransporter() {
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port: Number(process.env.SMTP_PORT) || 587,
    secure: false,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });
}

export async function sendOtpEmail(toEmail: string, otp: string): Promise<void> {
  const transporter = createTransporter();

  const mailOptions = {
    from: `"Pronote AI" <${process.env.SMTP_USER}>`,
    to: toEmail,
    subject: 'Your Pronote Password Reset Code',
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
      </head>
      <body style="margin:0;padding:0;background:#0a0a0a;font-family:'Segoe UI',Arial,sans-serif;">
        <table width="100%" cellpadding="0" cellspacing="0" style="background:#0a0a0a;padding:40px 20px;">
          <tr>
            <td align="center">
              <table width="520" cellpadding="0" cellspacing="0" style="background:#111;border-radius:20px;overflow:hidden;border:1px solid #1f1f1f;">

                <!-- Header -->
                <tr>
                  <td style="background:linear-gradient(135deg,#10b981,#0d9488);padding:36px;text-align:center;">
                    <div style="display:inline-flex;align-items:center;gap:10px;">
                      <div style="width:44px;height:44px;background:rgba(255,255,255,0.2);border-radius:12px;display:inline-flex;align-items:center;justify-content:center;">
                        <span style="font-size:20px;">✦</span>
                      </div>
                    </div>
                    <h1 style="margin:12px 0 4px;color:#fff;font-size:22px;font-weight:800;letter-spacing:-0.5px;">Pronote AI</h1>
                    <p style="margin:0;color:rgba(255,255,255,0.7);font-size:13px;">AI Medical Scribe</p>
                  </td>
                </tr>

                <!-- Body -->
                <tr>
                  <td style="padding:40px 36px;">
                    <h2 style="margin:0 0 8px;color:#fff;font-size:20px;font-weight:700;">Password Reset Code</h2>
                    <p style="margin:0 0 28px;color:#888;font-size:14px;line-height:1.6;">
                      We received a request to reset your Pronote password. Use the code below to proceed. This code expires in <strong style="color:#10b981;">10 minutes</strong>.
                    </p>

                    <!-- OTP Box -->
                    <div style="background:#0a1f18;border:2px solid #10b981;border-radius:16px;padding:28px;text-align:center;margin-bottom:28px;">
                      <p style="margin:0 0 8px;color:#10b981;font-size:11px;font-weight:700;letter-spacing:3px;text-transform:uppercase;">Your verification code</p>
                      <div style="letter-spacing:12px;font-size:42px;font-weight:900;color:#fff;font-family:monospace;margin-left:12px;">
                        ${otp}
                      </div>
                    </div>

                    <div style="background:#1a1a1a;border-radius:12px;padding:16px;margin-bottom:24px;">
                      <p style="margin:0;color:#666;font-size:13px;line-height:1.5;">
                        🔒 If you did not request a password reset, you can safely ignore this email. Your account remains secure.
                      </p>
                    </div>

                    <p style="margin:0;color:#555;font-size:12px;text-align:center;">
                      This code will expire in 10 minutes and can only be used once.
                    </p>
                  </td>
                </tr>

                <!-- Footer -->
                <tr>
                  <td style="padding:20px 36px;border-top:1px solid #1f1f1f;text-align:center;">
                    <p style="margin:0;color:#444;font-size:12px;">© ${new Date().getFullYear()} Pronote AI Medical Scribe. All rights reserved.</p>
                  </td>
                </tr>

              </table>
            </td>
          </tr>
        </table>
      </body>
      </html>
    `,
  };

  await transporter.sendMail(mailOptions);
}
