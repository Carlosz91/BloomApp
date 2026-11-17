// Outbound email for transactional messages (password reset).
// Config (env): SMTP_URL (e.g. smtps://user:pass@host:465) and MAIL_FROM.
//  - SMTP_URL set: send through SMTP.
//  - SMTP_URL unset, non-production: nothing is sent; a clearly marked
//    "[DEV MAIL]" line with the code goes to the console (the ONLY place a
//    plain reset code may ever be logged).
//  - SMTP_URL unset, production: log an error WITHOUT the code and skip.
// SMTP credentials are never logged.
const nodemailer = require('nodemailer');

const SMTP_URL = process.env.SMTP_URL || '';
const MAIL_FROM = process.env.MAIL_FROM || 'BloomApp <no-reply@bloomapp.local>';
const IS_PRODUCTION = process.env.NODE_ENV === 'production';

let transporter = null;
function getTransporter() {
  if (!transporter) transporter = nodemailer.createTransport(SMTP_URL);
  return transporter;
}

const escapeHtml = (s) =>
  String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

// Returns true when the message was handed to SMTP, false when skipped/failed.
async function deliver({ to, subject, text, html, devLine }) {
  if (!SMTP_URL) {
    if (IS_PRODUCTION) {
      console.error(`[ERROR] Mailer: SMTP_URL is not configured; email "${subject}" was not sent`);
    } else if (devLine) {
      console.log(devLine);
    } else {
      console.log(`[DEV MAIL] to=${to} subject="${subject}" (SMTP not configured, not sent)`);
    }
    return false;
  }
  try {
    await getTransporter().sendMail({ from: MAIL_FROM, to, subject, text, html });
    return true;
  } catch (err) {
    // Never print the SMTP URL or the full error (it may echo credentials).
    console.error('[ERROR] Mailer send failed:', err.code || 'unknown');
    return false;
  }
}

function sendPasswordResetCode(to, code, ttlMinutes) {
  const text =
    `Hola,\n\nTu código para restablecer la contraseña de BloomApp es: ${code}\n\n` +
    `Vence en ${ttlMinutes} minutos. Si no lo pediste vos, ignorá este correo: tu contraseña no cambia.\n\n` +
    'Equipo BloomApp';
  const html =
    '<p>Hola,</p><p>Tu código para restablecer la contraseña de BloomApp es:</p>' +
    `<p style="font-size:28px;letter-spacing:6px;font-weight:bold">${escapeHtml(code)}</p>` +
    `<p>Vence en ${ttlMinutes} minutos. Si no lo pediste vos, ignorá este correo: tu contraseña no cambia.</p>` +
    '<p>Equipo BloomApp</p>';
  return deliver({
    to,
    subject: 'Tu código para restablecer la contraseña',
    text,
    html,
    devLine: `[DEV MAIL] to=${to} code=${code}`
  });
}

// In production without SMTP, deliver() logs an error that never includes the code.
function sendEmailVerificationCode(to, code, ttlMinutes) {
  const text =
    `Hola,\n\nTu código para verificar tu correo en BloomApp es: ${code}\n\n` +
    `Vence en ${ttlMinutes} minutos. Si no lo pediste vos, ignorá este correo.\n\n` +
    'Equipo BloomApp';
  const html =
    '<p>Hola,</p><p>Tu código para verificar tu correo en BloomApp es:</p>' +
    `<p style="font-size:28px;letter-spacing:6px;font-weight:bold">${escapeHtml(code)}</p>` +
    `<p>Vence en ${ttlMinutes} minutos. Si no lo pediste vos, ignorá este correo.</p>` +
    '<p>Equipo BloomApp</p>';
  return deliver({
    to,
    subject: 'Verificá tu correo en BloomApp',
    text,
    html,
    devLine: `[DEV MAIL] to=${to} code=${code} kind=verify`
  });
}

function sendPasswordChangedNotice(to) {
  const text =
    'Hola,\n\nTu contraseña de BloomApp fue cambiada. Si fuiste vos, no tenés que hacer nada.\n' +
    'Si no reconocés este cambio, restablecé tu contraseña de inmediato o escribinos.\n\nEquipo BloomApp';
  const html =
    '<p>Hola,</p><p>Tu contraseña de BloomApp fue cambiada. Si fuiste vos, no tenés que hacer nada.</p>' +
    '<p>Si no reconocés este cambio, restablecé tu contraseña de inmediato o escribinos.</p><p>Equipo BloomApp</p>';
  return deliver({ to, subject: 'Tu contraseña fue cambiada', text, html });
}

module.exports = { sendPasswordResetCode, sendEmailVerificationCode, sendPasswordChangedNotice };
