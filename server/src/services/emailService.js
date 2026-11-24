// server/src/services/emailService.js
//
// The one place that sends emails. Works like smsService.js:
//   - SMTP not configured + development  -> the email is printed in the server console
//   - SMTP not configured + production   -> email features answer "not available" (503)
//   - SMTP configured                    -> sent for real through nodemailer
//
// Gmail example (.env):
//   SMTP_HOST=smtp.gmail.com
//   SMTP_PORT=465
//   SMTP_USER=yourname@gmail.com
//   SMTP_PASS=your16charapppassword      (Google Account -> Security -> App passwords)
//   EMAIL_FROM="RoktoLagbe <yourname@gmail.com>"

import { ApiError } from "../utils/ApiError.js";
import { parseOrigins } from "../config/security.js";

const isProd = () => process.env.NODE_ENV === "production";
const smtpConfigured = () =>
  Boolean(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS);

export const emailAvailable = () => smtpConfigured() || !isProd();

// Links in emails point at the frontend. CLIENT_URL may list several origins; the first one is used.
export const clientUrl = () => parseOrigins(process.env.CLIENT_URL)[0] || "http://localhost:5173";

let transporterPromise;
const getTransporter = () => {
  // Loaded only when SMTP is configured, so development works without SMTP settings
  transporterPromise ??= import("nodemailer").then(({ default: nodemailer }) => {
    const port = Number(process.env.SMTP_PORT) || 465;
    return nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port,
      secure: port === 465, // 465 = SSL, 587 = STARTTLS
      auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
    });
  });
  return transporterPromise;
};

export const sendEmail = async ({ to, subject, text, html }) => {
  if (!smtpConfigured()) {
    if (isProd()) throw new ApiError(503, "Email is not available right now");
    console.log(`📧 [DEV EMAIL to ${to}] ${subject}\n${text}\n`);
    return;
  }
  try {
    const transporter = await getTransporter();
    await transporter.sendMail({
      from: process.env.EMAIL_FROM || process.env.SMTP_USER,
      to,
      subject,
      text,
      html,
    });
  } catch (err) {
    console.error("Email send failed:", err.message);
    throw new ApiError(502, "Could not send the email. Please try again later.");
  }
};

// ---------- Templates ----------
const escapeHtml = (s = "") =>
  String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

const layout = (title, bodyHtml) => `
<div style="font-family:Arial,sans-serif;max-width:520px;margin:auto;padding:24px;color:#1f2937">
  <h2 style="color:#b91c1c;margin:0 0 16px">RoktoLagbe</h2>
  <h3 style="margin:0 0 12px">${title}</h3>
  ${bodyHtml}
  <p style="font-size:12px;color:#6b7280;margin-top:32px">
    If you did not ask for this, you can ignore this email.
  </p>
</div>`;

const button = (href, label) =>
  `<p><a href="${href}" style="display:inline-block;background:#dc2626;color:#fff;padding:12px 20px;border-radius:8px;text-decoration:none;font-weight:bold">${label}</a></p>
   <p style="font-size:12px;color:#6b7280">Or open this link: <br>${href}</p>`;

export const sendVerificationEmail = (to, name, token) => {
  const link = `${clientUrl()}/verify-email?token=${token}`;
  return sendEmail({
    to,
    subject: "Verify your email for RoktoLagbe",
    text: `Hi ${name},\n\nConfirm your email by opening this link (valid for 24 hours):\n${link}\n`,
    html: layout(
      "Confirm your email",
      `<p>Hi ${escapeHtml(name)},</p>
       <p>Please confirm this email address so you can be listed as a blood donor. The link is valid for 24 hours.</p>
       ${button(link, "Verify email")}`
    ),
  });
};

export const sendPasswordResetEmail = (to, name, token) => {
  const link = `${clientUrl()}/reset-password/${token}`;
  return sendEmail({
    to,
    subject: "Reset your RoktoLagbe password",
    text: `Hi ${name},\n\nReset your password with this link (valid for 10 minutes):\n${link}\n`,
    html: layout(
      "Reset your password",
      `<p>Hi ${escapeHtml(name)},</p>
       <p>Someone asked to reset the password for your account. The link is valid for 10 minutes.</p>
       ${button(link, "Choose a new password")}`
    ),
  });
};
