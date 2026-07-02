import { env } from '../config/env.js';
import { AppError } from '../utils/errors.js';

function isEmailConfigured() {
  if (!env.emailApiKey || !env.emailFrom) return false;
  if (env.emailProvider === 'generic' && !env.emailApiUrl) return false;
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
  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${env.emailApiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: `${env.emailFromName} <${env.emailFrom}>`,
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
  const response = await fetch('https://api.brevo.com/v3/smtp/email', {
    method: 'POST',
    headers: {
      'api-key': env.emailApiKey,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify({
      sender: { name: env.emailFromName, email: env.emailFrom },
      to: [{ email: to }],
      subject,
      textContent: text,
      htmlContent: html,
    }),
  });

  return response;
}

async function sendWithGenericProvider({ to, subject, text, html, resetLink }) {
  const response = await fetch(env.emailApiUrl, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${env.emailApiKey}`,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify({
      from: env.emailFrom,
      fromName: env.emailFromName,
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
    if (env.exposePasswordResetLinkInResponse) return { sent: false };
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

  const response =
    env.emailProvider === 'resend'
      ? await sendWithResend(payload)
      : env.emailProvider === 'brevo'
        ? await sendWithBrevo(payload)
        : await sendWithGenericProvider(payload);

  if (!response.ok) {
    const body = await response.text();
    const resendDomainVerificationRequired =
      env.emailProvider === 'resend' &&
      isResendDomainVerificationError(response.status, body);

    if (resendDomainVerificationRequired && env.exposePasswordResetLinkInResponse) {
      return {
        sent: false,
        reason: 'resend_domain_verification_required',
        message: resendErrorMessage(response.status, body),
      };
    }

    const providerMessage =
      env.emailProvider === 'resend'
        ? resendErrorMessage(response.status, body)
        : `Email API failed to send password reset message: ${response.status}`;

    throw new AppError(
      providerMessage,
      502,
    );
  }

  return { sent: true };
}
