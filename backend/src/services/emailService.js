import { AppError } from './errorService.js';

const BREVO_PROVIDER = 'brevo';
const GENERIC_PROVIDER = 'generic';
const DEFAULT_APP_NAME = 'Competra';
const DEFAULT_EMAIL_TIMEOUT_MS = 15000;

export function booleanEnv(name, fallback = false) {
  const value = String(process.env[name] || '').trim().toLowerCase();
  if (['true', '1', 'yes'].includes(value)) return true;
  if (['false', '0', 'no'].includes(value)) return false;
  return fallback;
}

export function exposePasswordResetLinkInResponse() {
  return booleanEnv(
    'EXPOSE_PASSWORD_RESET_LINK_IN_RESPONSE',
    process.env.NODE_ENV !== 'production',
  );
}

export function escapeHtml(value) {
  return String(value || '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function maskEmail(email) {
  const [name = '', domain = ''] = String(email || '').split('@');
  if (!name || !domain) return 'unknown-recipient';
  const visibleName = name.length <= 2 ? `${name[0] || '*'}***` : `${name.slice(0, 2)}***${name.slice(-1)}`;
  return `${visibleName}@${domain}`;
}
function appName() {
  return String(process.env.APP_NAME || DEFAULT_APP_NAME).trim() || DEFAULT_APP_NAME;
}

function frontendUrl() {
  return String(process.env.FRONTEND_URL || '').trim().replace(/\/$/, '');
}

function emailProvider() {
  return String(process.env.EMAIL_PROVIDER || BREVO_PROVIDER).trim().toLowerCase();
}

function emailTimeoutMs() {
  const value = Number(process.env.EMAIL_REQUEST_TIMEOUT_MS);
  return Number.isFinite(value) && value > 0 ? value : DEFAULT_EMAIL_TIMEOUT_MS;
}

export function buildFrontendUrl(pathAndQuery = '/') {
  const baseUrl = frontendUrl();
  if (!baseUrl) {
    throw new AppError('FRONTEND_URL is required to create email links', 500);
  }

  const normalizedPath = String(pathAndQuery || '/').startsWith('/')
    ? String(pathAndQuery || '/')
    : `/${pathAndQuery}`;
  return `${baseUrl}${normalizedPath}`;
}

export function buildPasswordResetUrl(rawToken) {
  return buildFrontendUrl(`/reset-password?token=${encodeURIComponent(rawToken)}`);
}

export function buildEmailVerificationUrl(rawToken) {
  return buildFrontendUrl(`/verify-email?token=${encodeURIComponent(rawToken)}`);
}

export function buildAssessmentResultUrl(assessmentId) {
  return buildFrontendUrl(`/results/${encodeURIComponent(String(assessmentId))}`);
}

function isEmailConfigured() {
  const provider = emailProvider();
  const emailApiKey = String(process.env.EMAIL_API_KEY || '').trim();
  const emailFrom = String(process.env.EMAIL_FROM || '').trim();
  const emailApiUrl = String(process.env.EMAIL_API_URL || '').trim();
  const brevoApiUrl = String(process.env.EMAIL_BREVO_API_URL || '').trim();

  if (!emailApiKey || !emailFrom) return false;
  if (provider === BREVO_PROVIDER && !brevoApiUrl) return false;
  if (provider === GENERIC_PROVIDER && !emailApiUrl) return false;
  return true;
}

function buildEmailShell({ title, bodyHtml }) {
  const safeAppName = escapeHtml(appName());
  return `
    <div style="margin:0;background:#f8fafc;padding:24px;font-family:Arial,sans-serif;color:#0f172a;line-height:1.6;">
      <div style="max-width:600px;margin:0 auto;background:#ffffff;border:1px solid #dbe4ee;border-radius:16px;overflow:hidden;box-shadow:0 12px 30px rgba(15,23,42,0.08);">
        <div style="background:#023E8A;color:#ffffff;padding:24px 28px;">
          <div style="font-size:14px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;">${safeAppName}</div>
          <h1 style="margin:12px 0 0;font-size:26px;line-height:1.2;">${escapeHtml(title)}</h1>
        </div>
        <div style="padding:28px;">${bodyHtml}</div>
        <div style="background:#f1f5f9;color:#64748b;padding:18px 28px;font-size:13px;">
          Regards,<br />The ${safeAppName} Team
        </div>
      </div>
    </div>`;
}

export function buildPasswordResetEmail({ name, resetLink, expiresInMinutes }) {
  const safeName = escapeHtml(name || 'User');
  const safeResetLink = escapeHtml(resetLink);
  const safeAppName = escapeHtml(appName());
  const subject = `Reset your ${appName()} password`;
  const text = [
    `Hello ${name || 'User'},`,
    '',
    `We received a request to reset the password for your ${appName()} account. Select the link below to create a new password.`,
    resetLink,
    '',
    `This secure link expires in ${expiresInMinutes} minutes and can only be used once.`,
    'If you did not request a password reset, you can safely ignore this email. Your current password will remain unchanged.',
    'For your security, do not share this link with anyone.',
    '',
    `Regards,`,
    `The ${appName()} Team`,
  ].join('\n');

  const html = buildEmailShell({
    title: `Reset your ${appName()} password`,
    bodyHtml: `
      <p style="margin:0 0 16px;">Hello ${safeName},</p>
      <p style="margin:0 0 20px;">We received a request to reset the password for your ${safeAppName} account. Select the button below to create a new password.</p>
      <p style="margin:0 0 22px;"><a href="${safeResetLink}" style="display:inline-block;background:#0077B6;color:#ffffff;padding:12px 18px;border-radius:10px;text-decoration:none;font-weight:700;">Reset password</a></p>
      <p style="margin:0 0 8px;color:#475569;font-size:14px;">If the button does not work, copy and paste this link into your browser:</p>
      <p style="margin:0 0 20px;word-break:break-all;font-size:14px;"><a href="${safeResetLink}" style="color:#0077B6;">${safeResetLink}</a></p>
      <p style="margin:0 0 12px;color:#64748b;font-size:14px;">This secure link expires in ${expiresInMinutes} minutes and can only be used once.</p>
      <p style="margin:0 0 12px;color:#64748b;font-size:14px;">If you did not request a password reset, you can safely ignore this email. Your current password will remain unchanged.</p>
      <p style="margin:0;color:#b42318;font-size:14px;font-weight:700;">For your security, do not share this link with anyone.</p>
    `,
  });

  return { subject, text, html };
}

export function buildEmailVerificationEmail({ name, verificationLink, verificationCode, expiresInMinutes }) {
  const safeName = escapeHtml(name || 'User');
  const safeVerificationLink = escapeHtml(verificationLink || '');
  const safeVerificationCode = escapeHtml(verificationCode || '');
  const safeAppName = escapeHtml(appName());
  const subject = `Verify your ${appName()} email address`;
  const codeInstruction = verificationCode
    ? `Use this verification code in ${appName()}: ${verificationCode}`
    : `Verify your email address by opening the link below.`;
  const text = [
    `Hello ${name || 'User'},`,
    '',
    `Welcome to ${appName()}.`,
    codeInstruction,
    verificationLink ? verificationLink : '',
    '',
    `This secure verification expires in ${expiresInMinutes} minutes and can only be used once.`,
    'If you did not create this account, you can safely ignore this email.',
    '',
    `Regards,`,
    `The ${appName()} Team`,
  ].filter(Boolean).join('\n');

  const codeBlock = verificationCode
    ? `<div style="margin:0 0 22px;padding:18px 20px;border:1px solid #bae6fd;background:#f0f9ff;border-radius:12px;text-align:center;">
        <div style="font-size:13px;color:#475569;margin-bottom:8px;">Your verification code</div>
        <div style="font-size:34px;letter-spacing:8px;font-weight:800;color:#023E8A;">${safeVerificationCode}</div>
      </div>`
    : '';

  const linkBlock = verificationLink
    ? `<p style="margin:0 0 22px;"><a href="${safeVerificationLink}" style="display:inline-block;background:#0077B6;color:#ffffff;padding:12px 18px;border-radius:10px;text-decoration:none;font-weight:700;">Verify email</a></p>
      <p style="margin:0 0 8px;color:#475569;font-size:14px;">If the button does not work, copy and paste this link into your browser:</p>
      <p style="margin:0 0 20px;word-break:break-all;font-size:14px;"><a href="${safeVerificationLink}" style="color:#0077B6;">${safeVerificationLink}</a></p>`
    : '';

  const html = buildEmailShell({
    title: `Verify your ${appName()} email`,
    bodyHtml: `
      <p style="margin:0 0 16px;">Hello ${safeName},</p>
      <p style="margin:0 0 20px;">Welcome to ${safeAppName}. Enter the verification code below in the sign-up screen to activate your account.</p>
      ${codeBlock}
      ${linkBlock}
      <p style="margin:0 0 12px;color:#64748b;font-size:14px;">This secure verification expires in ${expiresInMinutes} minutes and can only be used once.</p>
      <p style="margin:0;color:#64748b;font-size:14px;">If you did not create this account, you can safely ignore this email.</p>
    `,
  });

  return { subject, text, html };
}
function formatPercent(value, fallback = 'Not available') {
  const numberValue = Number(value);
  return Number.isFinite(numberValue) ? `${Math.round(numberValue * 100) / 100}%` : fallback;
}

function summarizeRecommendation(value = '') {
  const summary = String(value || '').replace(/\s+/g, ' ').trim();
  if (!summary) return 'Sign in to view your personalized recommendation and action plan.';
  return summary.length > 260 ? `${summary.slice(0, 257)}...` : summary;
}

export function buildAssessmentResultEmail({
  name,
  competencyTitle,
  finalScore,
  benchmarkScore,
  skillGap,
  gapLevel,
  priority,
  recommendationSummary,
  resultLink,
  completedAt,
}) {
  const safeName = escapeHtml(name || 'User');
  const safeCompetencyTitle = escapeHtml(competencyTitle || 'your competency assessment');
  const safeResultLink = escapeHtml(resultLink);
  const recommendation = summarizeRecommendation(recommendationSummary);
  const safeRecommendation = escapeHtml(recommendation);
  const subject = 'Your Competra assessment result is ready';
  const publishedDate = completedAt ? new Date(completedAt).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' }) : 'Available now';

  const text = [
    `Hello ${name || 'User'},`,
    '',
    `Your assessment result for ${competencyTitle || 'your competency assessment'} is now available.`,
    '',
    'Result summary:',
    `- Final competency score: ${formatPercent(finalScore)}`,
    `- RTB benchmark: ${formatPercent(benchmarkScore)}`,
    `- Skills gap: ${formatPercent(skillGap)}`,
    `- Gap level: ${gapLevel || 'Not available'}`,
    `- Priority: ${priority || 'Not available'}`,
    `- Published: ${publishedDate}`,
    '',
    'Recommendation:',
    recommendation,
    '',
    'Sign in to Competra to view the complete result, supporting details, and recommended actions.',
    resultLink,
    '',
    `Regards,`,
    `The ${appName()} Team`,
  ].join('\n');

  const rows = [
    ['Final competency score', formatPercent(finalScore)],
    ['RTB benchmark', formatPercent(benchmarkScore)],
    ['Skills gap', formatPercent(skillGap)],
    ['Gap level', gapLevel || 'Not available'],
    ['Priority', priority || 'Not available'],
    ['Published', publishedDate],
  ]
    .map(([label, value]) => `<tr><td style="padding:8px 0;color:#64748b;">${escapeHtml(label)}</td><td style="padding:8px 0;text-align:right;font-weight:700;">${escapeHtml(value)}</td></tr>`)
    .join('');

  const html = buildEmailShell({
    title: 'Your assessment result is ready',
    bodyHtml: `
      <p style="margin:0 0 16px;">Hello ${safeName},</p>
      <p style="margin:0 0 18px;">Your assessment result for <strong>${safeCompetencyTitle}</strong> is now available.</p>
      <table role="presentation" style="width:100%;border-collapse:collapse;margin:0 0 20px;">${rows}</table>
      <div style="border-left:4px solid #0077B6;background:#eff6ff;padding:14px 16px;margin:0 0 22px;border-radius:8px;">
        <strong style="display:block;margin-bottom:6px;">Recommendation</strong>
        <span>${safeRecommendation}</span>
      </div>
      <p style="margin:0 0 22px;color:#475569;">Sign in to Competra to view the complete result, supporting details, and recommended actions.</p>
      <p style="margin:0 0 16px;"><a href="${safeResultLink}" style="display:inline-block;background:#0077B6;color:#ffffff;padding:12px 18px;border-radius:10px;text-decoration:none;font-weight:700;">View full result</a></p>
      <p style="margin:0;color:#64748b;font-size:13px;word-break:break-all;">Protected link: <a href="${safeResultLink}" style="color:#0077B6;">${safeResultLink}</a></p>
    `,
  });

  return { subject, text, html };
}

function brevoErrorMessage(status, body) {
  let providerDetail = '';

  try {
    const parsedBody = JSON.parse(body);
    providerDetail = [parsedBody.message, parsedBody.code].filter(Boolean).join(' ');
  } catch {
    providerDetail = String(body || '').slice(0, 240);
  }

  return `Brevo email delivery failed with status ${status}${providerDetail ? `: ${providerDetail}` : ''}`;
}

async function fetchWithTimeout(url, options) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), emailTimeoutMs());

  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timeout);
  }
}

async function sendWithBrevo({ to, toName, subject, text, html, tag }) {
  const emailApiKey = String(process.env.EMAIL_API_KEY || '').trim();
  const emailFrom = String(process.env.EMAIL_FROM || '').trim();
  const emailFromName = String(process.env.EMAIL_FROM_NAME || appName()).trim();
  const emailReplyTo = String(process.env.EMAIL_REPLY_TO || '').trim();
  const brevoApiUrl = String(process.env.EMAIL_BREVO_API_URL || '').trim();

  if (!brevoApiUrl) throw new AppError('Email service is not configured', 500);

  const body = {
    sender: { name: emailFromName, email: emailFrom },
    to: [{ email: to, ...(toName ? { name: toName } : {}) }],
    subject,
    htmlContent: html,
    textContent: text,
    ...(tag ? { tags: [tag] } : {}),
  };

  if (emailReplyTo) {
    body.replyTo = { email: emailReplyTo };
  }

  return fetchWithTimeout(brevoApiUrl, {
    method: 'POST',
    headers: {
      'api-key': emailApiKey,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify(body),
  });
}

async function sendWithGenericProvider({ to, subject, text, html, resetLink }) {
  const emailApiUrl = String(process.env.EMAIL_API_URL || '').trim();
  const emailApiKey = String(process.env.EMAIL_API_KEY || '').trim();
  const emailFrom = String(process.env.EMAIL_FROM || '').trim();
  const emailFromName = String(process.env.EMAIL_FROM_NAME || appName()).trim();

  return fetchWithTimeout(emailApiUrl, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${emailApiKey}`,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify({ from: emailFrom, fromName: emailFromName, to, subject, text, html, resetLink }),
  });
}

async function parseProviderSuccess(response) {
  try {
    const body = await response.json();
    return { messageId: body.messageId || body.message_id || body.id };
  } catch {
    return {};
  }
}

async function sendEmail({ to, toName, subject, text, html, tag, resetLink }) {
  if (!isEmailConfigured()) {
    if (exposePasswordResetLinkInResponse() && tag === 'password-reset') return { sent: false };
    throw new AppError('Email service is not configured', 500);
  }

  const provider = emailProvider();
  const response = provider === BREVO_PROVIDER
    ? await sendWithBrevo({ to, toName, subject, text, html, tag })
    : provider === GENERIC_PROVIDER
      ? await sendWithGenericProvider({ to, subject, text, html, resetLink })
      : null;

  if (!response) {
    throw new AppError('Email service is not configured', 500);
  }

  if (!response.ok) {
    const body = await response.text();
    console.error('Transactional email provider rejected request', {
      provider,
      status: response.status,
      message: provider === BREVO_PROVIDER ? brevoErrorMessage(response.status, body) : `Email API returned ${response.status}`,
      tag,
      recipient: to,
    });
    throw new AppError('Email could not be sent right now. Please try again later.', 502);
  }

  const providerResult = await parseProviderSuccess(response);
  console.info('Transactional email accepted by provider', {
    provider,
    tag,
    recipient: maskEmail(to),
    ...(providerResult.messageId ? { messageId: providerResult.messageId } : {}),
  });

  return {
    sent: true,
    provider,
    ...(providerResult.messageId ? { messageId: providerResult.messageId } : {}),
  };
}

export async function sendEmailVerificationEmail({ to, name, verificationLink, verificationCode, expiresInMinutes }) {
  const message = buildEmailVerificationEmail({ name, verificationLink, verificationCode, expiresInMinutes });
  return sendEmail({
    to,
    toName: name,
    subject: message.subject,
    text: message.text,
    html: message.html,
    tag: 'email-verification',
  });
}
export async function sendPasswordResetEmail({ to, name, resetLink, expiresInMinutes }) {
  const message = buildPasswordResetEmail({ name, resetLink, expiresInMinutes });
  return sendEmail({
    to,
    toName: name,
    resetLink,
    subject: message.subject,
    text: message.text,
    html: message.html,
    tag: 'password-reset',
  });
}

export async function sendAssessmentResultEmail(payload) {
  const message = buildAssessmentResultEmail(payload);
  return sendEmail({
    to: payload.to,
    toName: payload.name,
    subject: message.subject,
    text: message.text,
    html: message.html,
    tag: 'assessment-result',
  });
}

const emailService = {
  buildAssessmentResultEmail,
  buildAssessmentResultUrl,
  buildEmailVerificationEmail,
  buildEmailVerificationUrl,
  buildFrontendUrl,
  buildPasswordResetEmail,
  buildPasswordResetUrl,
  escapeHtml,
  exposePasswordResetLinkInResponse,
  sendAssessmentResultEmail,
  sendEmailVerificationEmail,
  sendPasswordResetEmail,
};

export default emailService;
