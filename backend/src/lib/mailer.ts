import nodemailer from 'nodemailer';
import dns from 'dns';

// Belt-and-suspenders: also pin IPv4 here, in case the host's runtime
// somehow doesn't honour the global dns.setDefaultResultOrder set in
// the entrypoint. Render's free tier resolves smtp.gmail.com to IPv6
// addresses it can't actually route, which produces ENETUNREACH.
function ipv4Lookup(
  hostname: string,
  options: any,
  callback: (err: NodeJS.ErrnoException | null, address: string, family: number) => void
) {
  if (typeof options === 'function') {
    callback = options;
    options = {};
  }
  const opts =
    typeof options === 'number'
      ? { family: 4 }
      : { ...(options || {}), family: 4 };
  return (dns.lookup as any)(hostname, opts, callback);
}

function createTransporter() {
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port: Number(process.env.SMTP_PORT) || 587,
    secure: false,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
    // Force IPv4 at the underlying net.connect level
    family: 4,
    // Custom DNS lookup that always returns IPv4
    lookup: ipv4Lookup,
    // Reasonable timeouts so a hung connection fails fast instead of timing out the request
    connectionTimeout: 15_000,
    greetingTimeout: 10_000,
    socketTimeout: 20_000,
  } as any);
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

export async function send2faOtpEmail(toEmail: string, otp: string, action: 'enable' | 'disable' | 'login'): Promise<void> {
  const transporter = createTransporter();
  const actionLabel = action === 'enable' ? 'Enable Two-Factor Authentication'
    : action === 'disable' ? 'Disable Two-Factor Authentication'
    : 'Two-Factor Login Verification';
  const actionDesc = action === 'login'
    ? 'Use the code below to complete your sign-in.'
    : `Use the code below to ${action} two-factor authentication on your account.`;

  await transporter.sendMail({
    from: `"Pronote AI" <${process.env.SMTP_USER}>`,
    to: toEmail,
    subject: `Your Pronote 2FA Code — ${actionLabel}`,
    html: `
      <!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"></head>
      <body style="margin:0;padding:0;background:#0a0a0a;font-family:'Segoe UI',Arial,sans-serif;">
        <table width="100%" cellpadding="0" cellspacing="0" style="background:#0a0a0a;padding:40px 20px;">
          <tr><td align="center">
            <table width="520" cellpadding="0" cellspacing="0" style="background:#111;border-radius:20px;overflow:hidden;border:1px solid #1f1f1f;">
              <tr><td style="background:linear-gradient(135deg,#6366f1,#8b5cf6);padding:36px;text-align:center;">
                <div style="width:48px;height:48px;background:rgba(255,255,255,0.2);border-radius:12px;display:inline-flex;align-items:center;justify-content:center;margin-bottom:12px;font-size:22px;">🔐</div>
                <h1 style="margin:0 0 4px;color:#fff;font-size:22px;font-weight:800;">Pronote AI</h1>
                <p style="margin:0;color:rgba(255,255,255,0.7);font-size:13px;">${actionLabel}</p>
              </td></tr>
              <tr><td style="padding:40px 36px;">
                <p style="margin:0 0 24px;color:#888;font-size:14px;line-height:1.6;">${actionDesc} This code expires in <strong style="color:#8b5cf6;">10 minutes</strong>.</p>
                <div style="background:#0d0b1f;border:2px solid #6366f1;border-radius:16px;padding:28px;text-align:center;margin-bottom:28px;">
                  <p style="margin:0 0 8px;color:#818cf8;font-size:11px;font-weight:700;letter-spacing:3px;text-transform:uppercase;">Verification Code</p>
                  <div style="letter-spacing:12px;font-size:42px;font-weight:900;color:#fff;font-family:monospace;margin-left:12px;">${otp}</div>
                </div>
                <div style="background:#1a1a1a;border-radius:12px;padding:16px;margin-bottom:20px;">
                  <p style="margin:0;color:#666;font-size:13px;line-height:1.5;">🔒 If you did not request this code, please ignore this email. Your account remains secure.</p>
                </div>
                <p style="margin:0;color:#555;font-size:12px;text-align:center;">This code expires in 10 minutes and can only be used once.</p>
              </td></tr>
              <tr><td style="padding:20px 36px;border-top:1px solid #1f1f1f;text-align:center;">
                <p style="margin:0;color:#444;font-size:12px;">© ${new Date().getFullYear()} Pronote AI Medical Scribe. All rights reserved.</p>
              </td></tr>
            </table>
          </td></tr>
        </table>
      </body></html>
    `,
  });
}



export async function sendTrialReminderEmail(
  toEmail: string,
  userName: string,
  daysLeft: number,
  upgradeUrl: string
): Promise<void> {
  const transporter = createTransporter();
  const urgencyColor  = daysLeft <= 1 ? '#ef4444' : '#f59e0b';
  const urgencyLabel  = daysLeft <= 1 ? '🚨 Last Day!' : `⏰ ${daysLeft} Days Left`;
  const urgencyText   = daysLeft <= 1
    ? 'Your trial expires <strong style="color:#ef4444;">today</strong>. Upgrade now to keep access to all your notes and recordings.'
    : `Your free trial expires in <strong style="color:#f59e0b;">${daysLeft} days</strong>. Upgrade now to keep uninterrupted access.`;

  const mailOptions = {
    from: `"Pronote AI" <${process.env.SMTP_USER}>`,
    to: toEmail,
    subject: `${urgencyLabel} Your Pronote AI trial is ending soon`,
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
                  <td style="background:linear-gradient(135deg,${urgencyColor},#d97706);padding:36px;text-align:center;">
                    <div style="width:56px;height:56px;background:rgba(255,255,255,0.2);border-radius:16px;display:inline-flex;align-items:center;justify-content:center;margin-bottom:12px;">
                      <span style="font-size:26px;">⏳</span>
                    </div>
                    <h1 style="margin:0 0 4px;color:#fff;font-size:22px;font-weight:800;letter-spacing:-0.5px;">Pronote AI</h1>
                    <p style="margin:0;color:rgba(255,255,255,0.8);font-size:13px;">Your trial is ending soon</p>
                  </td>
                </tr>

                <!-- Body -->
                <tr>
                  <td style="padding:40px 36px;">
                    <h2 style="margin:0 0 8px;color:#fff;font-size:20px;font-weight:700;">Hi ${userName},</h2>
                    <p style="margin:0 0 28px;color:#888;font-size:14px;line-height:1.7;">
                      ${urgencyText}
                    </p>

                    <!-- Days Counter Box -->
                    <div style="background:#0a0a0a;border:2px solid ${urgencyColor};border-radius:16px;padding:24px;text-align:center;margin-bottom:28px;">
                      <p style="margin:0 0 6px;color:${urgencyColor};font-size:11px;font-weight:700;letter-spacing:3px;text-transform:uppercase;">Trial ends in</p>
                      <div style="font-size:52px;font-weight:900;color:#fff;line-height:1;">${daysLeft}</div>
                      <p style="margin:4px 0 0;color:#666;font-size:13px;">${daysLeft === 1 ? 'day' : 'days'}</p>
                    </div>

                    <!-- What you'll lose -->
                    <div style="background:#1a1a1a;border-radius:12px;padding:20px;margin-bottom:28px;">
                      <p style="margin:0 0 12px;color:#fff;font-size:13px;font-weight:700;">What happens after your trial ends:</p>
                      <ul style="margin:0;padding:0 0 0 20px;color:#888;font-size:13px;line-height:1.8;">
                        <li>Access to all clinical notes will be locked</li>
                        <li>Audio recordings will no longer process</li>
                        <li>AI note generation will be disabled</li>
                        <li>Your data is safe — it won't be deleted</li>
                      </ul>
                    </div>

                    <!-- CTA -->
                    <div style="text-align:center;margin-bottom:24px;">
                      <a href="${upgradeUrl}" style="display:inline-block;background:linear-gradient(135deg,${urgencyColor},#d97706);color:#fff;text-decoration:none;font-weight:800;font-size:16px;padding:16px 40px;border-radius:14px;letter-spacing:0.3px;">
                        Upgrade Now — Keep Full Access →
                      </a>
                    </div>

                    <!-- Plans -->
                    <div style="background:#0f0f0f;border:1px solid #222;border-radius:12px;padding:16px;margin-bottom:24px;">
                      <p style="margin:0 0 10px;color:#fff;font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:1px;">Choose a Plan</p>
                      <table width="100%" cellpadding="0" cellspacing="0">
                        <tr>
                          <td style="padding:8px;background:#1a1a1a;border-radius:8px;text-align:center;width:48%;">
                            <p style="margin:0;color:#10b981;font-size:11px;font-weight:700;">INDIVIDUAL</p>
                            <p style="margin:4px 0;color:#fff;font-size:20px;font-weight:800;">$25<span style="font-size:12px;color:#666;">/mo</span></p>
                            <p style="margin:0;color:#666;font-size:11px;">Billed annually</p>
                          </td>
                          <td style="width:4%;"></td>
                          <td style="padding:8px;background:linear-gradient(135deg,rgba(139,92,246,0.2),rgba(124,58,237,0.1));border:1px solid #7c3aed;border-radius:8px;text-align:center;width:48%;">
                            <p style="margin:0;color:#a78bfa;font-size:11px;font-weight:700;">GROUP ⭐ POPULAR</p>
                            <p style="margin:4px 0;color:#fff;font-size:20px;font-weight:800;">$40<span style="font-size:12px;color:#666;">/mo</span></p>
                            <p style="margin:0;color:#666;font-size:11px;">Up to 5 members</p>
                          </td>
                        </tr>
                      </table>
                    </div>

                    <p style="margin:0;color:#555;font-size:12px;text-align:center;">
                      Questions? Reply to this email and we'll help you choose the right plan.
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

// ── Support ticket emails ──────────────────────────────────────────────────────

interface SupportEmailOptions {
  ticketId: string;
  userName: string;
  userEmail: string;
  subject: string;
  message: string;
  category: string;
  plan: string;
  isPriority: boolean;
}

export async function sendSupportEmail(opts: SupportEmailOptions): Promise<void> {
  const transporter = createTransporter();
  const adminEmail  = process.env.SMTP_USER!;
  const priorityBadge = opts.isPriority
    ? `<span style="background:#ef4444;color:#fff;padding:2px 10px;border-radius:20px;font-size:11px;font-weight:800;text-transform:uppercase;letter-spacing:1px;">🔴 Priority</span>`
    : `<span style="background:#3b82f6;color:#fff;padding:2px 10px;border-radius:20px;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:1px;">Standard</span>`;

  // ── Admin notification ──────────────────────────────────────────────────────
  await transporter.sendMail({
    from: `"Pronote Support" <${adminEmail}>`,
    to: adminEmail,
    subject: `${opts.isPriority ? '🔴 [PRIORITY] ' : ''}New Support Ticket ${opts.ticketId} — ${opts.subject}`,
    html: `
      <!DOCTYPE html><html><head><meta charset="utf-8"></head>
      <body style="margin:0;padding:32px;background:#f8fafc;font-family:'Segoe UI',sans-serif;">
        <div style="max-width:540px;margin:0 auto;background:#fff;border-radius:16px;overflow:hidden;border:1px solid #e2e8f0;">
          <div style="background:${opts.isPriority ? 'linear-gradient(135deg,#ef4444,#f97316)' : 'linear-gradient(135deg,#3b82f6,#6366f1)'};padding:24px;">
            <h2 style="margin:0;color:#fff;font-size:18px;">New Support Ticket</h2>
            <p style="margin:4px 0 0;color:rgba(255,255,255,0.8);font-size:13px;">${opts.ticketId} · ${priorityBadge}</p>
          </div>
          <div style="padding:28px;">
            <table style="width:100%;border-collapse:collapse;font-size:13px;">
              <tr><td style="padding:6px 0;color:#64748b;width:120px;">From</td><td style="color:#111;font-weight:600;">${opts.userName} (${opts.userEmail})</td></tr>
              <tr><td style="padding:6px 0;color:#64748b;">Plan</td><td style="color:#111;">${opts.plan}</td></tr>
              <tr><td style="padding:6px 0;color:#64748b;">Category</td><td style="color:#111;text-transform:capitalize;">${opts.category}</td></tr>
              <tr><td style="padding:6px 0;color:#64748b;">Subject</td><td style="color:#111;font-weight:600;">${opts.subject}</td></tr>
            </table>
            <div style="margin-top:20px;background:#f8fafc;border-left:4px solid ${opts.isPriority ? '#ef4444' : '#3b82f6'};padding:16px;border-radius:0 8px 8px 0;">
              <p style="margin:0;color:#334155;font-size:14px;line-height:1.7;white-space:pre-wrap;">${opts.message}</p>
            </div>
            <p style="margin:20px 0 0;font-size:12px;color:#94a3b8;">Reply directly to this email to respond to the user.</p>
          </div>
        </div>
      </body></html>
    `,
    replyTo: opts.userEmail,
  });

  // ── User auto-reply ─────────────────────────────────────────────────────────
  await transporter.sendMail({
    from: `"Pronote Support" <${adminEmail}>`,
    to: opts.userEmail,
    subject: `[${opts.ticketId}] We received your message — ${opts.subject}`,
    html: `
      <!DOCTYPE html><html><head><meta charset="utf-8"></head>
      <body style="margin:0;padding:32px;background:#0a0a0a;font-family:'Segoe UI',sans-serif;">
        <div style="max-width:520px;margin:0 auto;background:#111;border-radius:20px;overflow:hidden;border:1px solid #1f1f1f;">
          <div style="background:linear-gradient(135deg,#10b981,#059669);padding:32px;text-align:center;">
            <h1 style="margin:0 0 4px;color:#fff;font-size:20px;font-weight:800;">Pronote AI</h1>
            <p style="margin:0;color:rgba(255,255,255,0.8);font-size:13px;">Support Team</p>
          </div>
          <div style="padding:32px;">
            <h2 style="margin:0 0 8px;color:#fff;font-size:18px;">Hi ${opts.userName}, we've got your message!</h2>
            <p style="margin:0 0 24px;color:#888;font-size:14px;line-height:1.7;">
              Your support ticket has been received. Here's what to expect:
            </p>
            <div style="background:#0a0a0a;border-radius:12px;padding:20px;margin-bottom:24px;">
              <div style="display:flex;justify-content:space-between;margin-bottom:12px;">
                <span style="color:#666;font-size:12px;">Ticket ID</span>
                <span style="color:#10b981;font-weight:700;font-size:12px;">${opts.ticketId}</span>
              </div>
              <div style="display:flex;justify-content:space-between;margin-bottom:12px;">
                <span style="color:#666;font-size:12px;">Subject</span>
                <span style="color:#fff;font-size:12px;">${opts.subject}</span>
              </div>
              <div style="display:flex;justify-content:space-between;">
                <span style="color:#666;font-size:12px;">Expected Response</span>
                <span style="color:${opts.isPriority ? '#ef4444' : '#3b82f6'};font-weight:700;font-size:12px;">${opts.isPriority ? '< 4 hours 🔴' : '< 24 hours'}</span>
              </div>
            </div>
            ${opts.isPriority ? `<div style="background:rgba(239,68,68,0.1);border:1px solid rgba(239,68,68,0.2);border-radius:12px;padding:14px;margin-bottom:20px;text-align:center;">
              <p style="margin:0;color:#ef4444;font-size:13px;font-weight:700;">🔴 Priority Support Active</p>
              <p style="margin:4px 0 0;color:#888;font-size:12px;">As a Group plan member, your ticket is prioritized.</p>
            </div>` : ''}
            <p style="margin:0;color:#555;font-size:12px;text-align:center;">
              We'll reply to <strong style="color:#888;">${opts.userEmail}</strong>. Reply to this email if you have anything to add.
            </p>
          </div>
        </div>
      </body></html>
    `,
  });
}
export async function sendTeamInviteEmail(
  toEmail: string,
  teamName: string,
  inviterEmail: string,
  inviteUrl: string
): Promise<void> {
  const transporter = createTransporter();

  const mailOptions = {
    from: `"Pronote AI" <${process.env.SMTP_USER}>`,
    to: toEmail,
    subject: `You've been invited to join ${teamName} on Pronote AI`,
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
                  <td style="background:linear-gradient(135deg,#8b5cf6,#7c3aed);padding:36px;text-align:center;">
                    <div style="display:inline-flex;align-items:center;gap:10px;">
                      <div style="width:44px;height:44px;background:rgba(255,255,255,0.2);border-radius:12px;display:inline-flex;align-items:center;justify-content:center;">
                        <span style="font-size:20px;">👥</span>
                      </div>
                    </div>
                    <h1 style="margin:12px 0 4px;color:#fff;font-size:22px;font-weight:800;letter-spacing:-0.5px;">Pronote AI</h1>
                    <p style="margin:0;color:rgba(255,255,255,0.7);font-size:13px;">Team Invitation</p>
                  </td>
                </tr>

                <!-- Body -->
                <tr>
                  <td style="padding:40px 36px;">
                    <h2 style="margin:0 0 8px;color:#fff;font-size:20px;font-weight:700;">You're invited!</h2>
                    <p style="margin:0 0 28px;color:#888;font-size:14px;line-height:1.6;">
                      <strong style="color:#a78bfa;">${inviterEmail}</strong> has invited you to join the 
                      <strong style="color:#a78bfa;">${teamName}</strong> team on Pronote AI Medical Scribe.
                    </p>

                    <!-- CTA -->
                    <div style="text-align:center;margin-bottom:28px;">
                      <a href="${inviteUrl}" style="display:inline-block;background:linear-gradient(135deg,#8b5cf6,#7c3aed);color:#fff;text-decoration:none;font-weight:700;font-size:15px;padding:14px 36px;border-radius:14px;letter-spacing:0.3px;">
                        Accept Invitation →
                      </a>
                    </div>

                    <div style="background:#1a1a1a;border-radius:12px;padding:16px;margin-bottom:24px;">
                      <p style="margin:0;color:#666;font-size:13px;line-height:1.5;">
                        🔒 This invite link expires in <strong style="color:#a78bfa;">7 days</strong>. 
                        If you don't have a Pronote account, you'll be asked to create one first.
                      </p>
                    </div>

                    <p style="margin:0;color:#555;font-size:12px;text-align:center;">
                      If you didn't expect this invitation, you can safely ignore this email.
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

