import dotenv from 'dotenv';
import { AppError } from '../utils/errors.js';

dotenv.config({ quiet: true });

function exposePasswordResetLinkInResponse() {
  return (
    String(
      process.env.EXPOSE_PASSWORD_RESET_LINK_IN_RESPONSE ||
        (process.env.NODE_ENV !== 'production' ? 'true' : 'false'),
    ).toLowerCase() === 'true'
  );
}

function isEmailConfigured() {
  const emailProvider = process.env.EMAIL_PROVIDER || 'generic';
  const emailApiKey = process.env.EMAIL_API_KEY || '';
  const emailFrom = process.env.EMAIL_FROM || '';
  const emailApiUrl = process.env.EMAIL_API_URL || '';

  if (!emailApiKey || !emailFrom) return false;
  if (emailProvider === 'generic' && !emailApiUrl) return false;
  return true;
}

function buildPasswordResetMessage({ name, resetLink, expiresInMinutes }) {
  const safeName = name || 'User';
  const subject = 'Reset your Skills Gap Analysis Tool password';
  const text = [
    `Hello ${safeName},`,
    '',
    'We received a request to reset your Skills Gap Analysis Tool password.',
    `Open this link to create a new password: ${resetLink}`,
    '',
    `This link expires in ${expiresInMinutes} minutes.`,
    'If you did not request this reset, ignore this email.',
  ].join('\n');
  const html = `
    <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #0f172a;">
      <h2>Password reset request</h2>
      <p>Hello ${safeName},</p>
      <p>We received a request to reset your Skills Gap Analysis Tool password.</p>
      <p>
        <a href="${resetLink}" style="display:inline-block;background:#2563eb;color:#ffffff;padding:12px 18px;border-radius:8px;text-decoration:none;font-weight:700;">
          Reset password
        </a>
      </p>
      <p>This link expires in ${expiresInMinutes} minutes.</p>
      <p>If you did not request this reset, ignore this email.</p>
    </div>
  `;

  return { subject, text, html };
}

async function sendWithResend({ to, subject, text, html }) {
  const emailApiKey = process.env.EMAIL_API_KEY || '';
  const emailFrom = process.env.EMAIL_FROM || '';
  const emailFromName = process.env.EMAIL_FROM_NAME || 'Skills Gap Analysis Tool';
  const resendApiUrl = process.env.EMAIL_RESEND_API_URL || '';

  if (!resendApiUrl) {
    throw new AppError('EMAIL_RESEND_API_URL is required when EMAIL_PROVIDER=resend', 500);
  }

  const response = await fetch(resendApiUrl, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${emailApiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: `${emailFromName} <${emailFrom}>`,
      to: [to],
      subject,
      text,
      html,
    }),
  });

  return response;
}

function resendErrorMessage(status, body) {
  const normalizedBody = String(body || '').toLowerCase();

  if (
    status === 403 &&
    (normalizedBody.includes('verify a domain') ||
      normalizedBody.includes('only send testing emails'))
  ) {
    return (
      'Resend is still using a testing sender. Verify a domain in Resend, then set EMAIL_FROM to an address on that verified domain so reset emails can be sent to any recipient.'
    );
  }

  if (status === 401 || status === 403) {
    return 'Resend rejected the email request. Check EMAIL_API_KEY and EMAIL_FROM domain verification.';
  }

  return `Resend failed to send the password reset email with status ${status}.`;
}

function isResendDomainVerificationError(status, body) {
  const normalizedBody = String(body || '').toLowerCase();

  return (
    status === 403 &&
    (normalizedBody.includes('verify a domain') ||
      normalizedBody.includes('only send testing emails'))
  );
}

async function sendWithBrevo({ to, subject, text, html }) {
  const emailApiKey = process.env.EMAIL_API_KEY || '';
  const emailFrom = process.env.EMAIL_FROM || '';
  const emailFromName = process.env.EMAIL_FROM_NAME || 'Skills Gap Analysis Tool';
  const brevoApiUrl = process.env.EMAIL_BREVO_API_URL || '';

  if (!brevoApiUrl) {
    throw new AppError('EMAIL_BREVO_API_URL is required when EMAIL_PROVIDER=brevo', 500);
  }

  const response = await fetch(brevoApiUrl, {
    method: 'POST',
    headers: {
      'api-key': emailApiKey,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify({
      sender: { name: emailFromName, email: emailFrom },
      to: [{ email: to }],
      subject,
      textContent: text,
      htmlContent: html,
    }),
  });

  return response;
}

async function sendWithGenericProvider({ to, subject, text, html, resetLink }) {
  const emailApiUrl = process.env.EMAIL_API_URL || '';
  const emailApiKey = process.env.EMAIL_API_KEY || '';
  const emailFrom = process.env.EMAIL_FROM || '';
  const emailFromName = process.env.EMAIL_FROM_NAME || 'Skills Gap Analysis Tool';
  const response = await fetch(emailApiUrl, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${emailApiKey}`,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify({
      from: emailFrom,
      fromName: emailFromName,
      to,
      subject,
      text,
      html,
      resetLink,
    }),
  });

  return response;
}

export async function sendPasswordResetEmail({ to, name, resetLink, expiresInMinutes }) {
  if (!isEmailConfigured()) {
    if (exposePasswordResetLinkInResponse()) return { sent: false };
    throw new AppError('Email service is not configured for password reset', 500);
  }

  const message = buildPasswordResetMessage({
    name,
    resetLink,
    expiresInMinutes,
  });
  const payload = {
    to,
    resetLink,
    ...message,
  };

  const emailProvider = process.env.EMAIL_PROVIDER || 'generic';
  const response =
    emailProvider === 'resend'
      ? await sendWithResend(payload)
      : emailProvider === 'brevo'
        ? await sendWithBrevo(payload)
        : await sendWithGenericProvider(payload);

  if (!response.ok) {
    const body = await response.text();
    const resendDomainVerificationRequired =
      emailProvider === 'resend' &&
      isResendDomainVerificationError(response.status, body);

    if (resendDomainVerificationRequired && exposePasswordResetLinkInResponse()) {
      return {
        sent: false,
        reason: 'resend_domain_verification_required',
        message: resendErrorMessage(response.status, body),
      };
    }

    const providerMessage =
      emailProvider === 'resend'
        ? resendErrorMessage(response.status, body)
        : `Email API failed to send password reset message: ${response.status}`;

    throw new AppError(
      providerMessage,
      502,
    );
  }

  return { sent: true };
}
