import test from 'node:test';
import assert from 'node:assert/strict';
import authService, {
  assertStrongPassword,
  assertVerificationResendAllowed,
  hashToken,
  validateStoredEmailVerificationToken,
} from '../../src/services/authService.js';
import {
  buildEmailVerificationUrl,
  buildPasswordResetUrl,
  sendEmailVerificationEmail,
  sendPasswordResetEmail,
} from '../../src/services/emailService.js';

test('auth service default export exposes Google login handler', () => {
  assert.equal(typeof authService.loginWithGoogle, 'function');
});

test('Google login fails clearly when GOOGLE_CLIENT_ID is missing', async () => {
  const originalClientId = process.env.GOOGLE_CLIENT_ID;
  delete process.env.GOOGLE_CLIENT_ID;

  try {
    await assert.rejects(
      () => authService.loginWithGoogle('fake-google-credential'),
      (error) => {
        assert.equal(error.statusCode, 503);
        assert.match(error.message, /GOOGLE_CLIENT_ID/);
        return true;
      },
    );
  } finally {
    if (originalClientId === undefined) {
      delete process.env.GOOGLE_CLIENT_ID;
    } else {
      process.env.GOOGLE_CLIENT_ID = originalClientId;
    }
  }
});

test('Google login rejects unverifiable credentials with a helpful message', async () => {
  const originalClientId = process.env.GOOGLE_CLIENT_ID;
  process.env.GOOGLE_CLIENT_ID = 'test-client-id.apps.googleusercontent.com';

  const originalConsoleError = console.error;
  console.error = () => {};

  try {
    await assert.rejects(
      () => authService.loginWithGoogle('fake-google-credential'),
      (error) => {
        assert.equal(error.statusCode, 401);
        assert.match(error.message, /could not be verified/);
        return true;
      },
    );
  } finally {
    console.error = originalConsoleError;
    if (originalClientId === undefined) {
      delete process.env.GOOGLE_CLIENT_ID;
    } else {
      process.env.GOOGLE_CLIENT_ID = originalClientId;
    }
  }
});


test('password reset URL points to the frontend reset page with token', () => {
  const originalFrontendUrl = process.env.FRONTEND_URL;
  process.env.FRONTEND_URL = 'https://rtb-graduate-project.vercel.app/';

  try {
    const resetUrl = buildPasswordResetUrl('abc 123');
    assert.equal(
      resetUrl,
      'https://rtb-graduate-project.vercel.app/reset-password?token=abc%20123',
    );
  } finally {
    if (originalFrontendUrl === undefined) {
      delete process.env.FRONTEND_URL;
    } else {
      process.env.FRONTEND_URL = originalFrontendUrl;
    }
  }
});

test('Brevo password reset sends the correct email payload', async () => {
  const originalEnv = {
    EMAIL_PROVIDER: process.env.EMAIL_PROVIDER,
    EMAIL_API_KEY: process.env.EMAIL_API_KEY,
    EMAIL_FROM: process.env.EMAIL_FROM,
    EMAIL_FROM_NAME: process.env.EMAIL_FROM_NAME,
    EMAIL_BREVO_API_URL: process.env.EMAIL_BREVO_API_URL,
    EXPOSE_PASSWORD_RESET_LINK_IN_RESPONSE: process.env.EXPOSE_PASSWORD_RESET_LINK_IN_RESPONSE,
  };
  const originalFetch = global.fetch;
  let capturedUrl;
  let capturedOptions;

  process.env.EMAIL_PROVIDER = 'brevo';
  process.env.EMAIL_API_KEY = 'test-brevo-key';
  process.env.EMAIL_FROM = 'no-reply@example.com';
  process.env.EMAIL_FROM_NAME = 'Competra';
  process.env.EMAIL_BREVO_API_URL = 'https://api.brevo.com/v3/smtp/email';
  process.env.EXPOSE_PASSWORD_RESET_LINK_IN_RESPONSE = 'false';

  global.fetch = async (url, options) => {
    capturedUrl = url;
    capturedOptions = options;
    return { ok: true, status: 201, text: async () => '' };
  };

  try {
    const result = await sendPasswordResetEmail({
      to: 'learner@example.com',
      name: 'Learner User',
      resetLink: 'https://competra.example/reset?token=abc',
      expiresInMinutes: 15,
    });

    assert.equal(result.sent, true);
    assert.equal(capturedUrl, 'https://api.brevo.com/v3/smtp/email');
    assert.equal(capturedOptions.method, 'POST');
    assert.equal(capturedOptions.headers['api-key'], 'test-brevo-key');

    const body = JSON.parse(capturedOptions.body);
    assert.deepEqual(body.sender, { name: 'Competra', email: 'no-reply@example.com' });
    assert.deepEqual(body.to, [{ email: 'learner@example.com', name: 'Learner User' }]);
    assert.deepEqual(body.tags, ['password-reset']);
    assert.match(body.subject, /Reset your Competra password/);
    assert.match(body.textContent, /https:\/\/competra\.example\/reset\?token=abc/);
    assert.match(body.htmlContent, /Reset password/);
  } finally {
    global.fetch = originalFetch;
    Object.entries(originalEnv).forEach(([key, value]) => {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    });
  }
});

test('Brevo sender and API key errors are clear', async () => {
  const originalConsoleError = console.error;
  const originalEnv = {
    EMAIL_PROVIDER: process.env.EMAIL_PROVIDER,
    EMAIL_API_KEY: process.env.EMAIL_API_KEY,
    EMAIL_FROM: process.env.EMAIL_FROM,
    EMAIL_BREVO_API_URL: process.env.EMAIL_BREVO_API_URL,
    EXPOSE_PASSWORD_RESET_LINK_IN_RESPONSE: process.env.EXPOSE_PASSWORD_RESET_LINK_IN_RESPONSE,
  };
  const originalFetch = global.fetch;

  process.env.EMAIL_PROVIDER = 'brevo';
  process.env.EMAIL_API_KEY = 'test-brevo-key';
  process.env.EMAIL_FROM = 'unverified@example.com';
  process.env.EMAIL_BREVO_API_URL = 'https://api.brevo.com/v3/smtp/email';
  process.env.EXPOSE_PASSWORD_RESET_LINK_IN_RESPONSE = 'false';

  console.error = () => {};

  global.fetch = async () => ({
    ok: false,
    status: 400,
    text: async () => JSON.stringify({ message: 'sender is not valid' }),
  });

  try {
    await assert.rejects(
      () => sendPasswordResetEmail({
        to: 'learner@example.com',
        name: 'Learner User',
        resetLink: 'https://competra.example/reset?token=abc',
        expiresInMinutes: 15,
      }),
      (error) => {
        assert.equal(error.statusCode, 502);
        assert.match(error.message, /Email could not be sent/i);
        return true;
      },
    );
  } finally {
    global.fetch = originalFetch;
    console.error = originalConsoleError;
    Object.entries(originalEnv).forEach(([key, value]) => {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    });
  }
});





test('strong password policy accepts valid passwords and rejects weak passwords', () => {
  assert.doesNotThrow(() => assertStrongPassword('StrongPass1!'));
  assert.throws(
    () => assertStrongPassword('weakpass'),
    /uppercase, lowercase, number, special character, and no spaces/,
  );
  assert.throws(
    () => assertStrongPassword('Strong Pass1!'),
    /no spaces/,
  );
});

test('email verification URL points to the frontend verification page', () => {
  const originalFrontendUrl = process.env.FRONTEND_URL;
  process.env.FRONTEND_URL = 'https://rtb-graduate-project.vercel.app/';

  try {
    const verificationUrl = buildEmailVerificationUrl('verify token');
    assert.equal(
      verificationUrl,
      'https://rtb-graduate-project.vercel.app/verify-email?token=verify%20token',
    );
  } finally {
    if (originalFrontendUrl === undefined) delete process.env.FRONTEND_URL;
    else process.env.FRONTEND_URL = originalFrontendUrl;
  }
});

test('email verification token validation handles success, wrong, expired, and reused tokens', () => {
  const rawToken = 'secure-verification-token-123';
  const validUser = {
    isEmailVerified: false,
    emailVerificationTokenHash: hashToken(rawToken),
    emailVerificationExpiresAt: new Date(Date.now() + 30_000),
  };

  assert.equal(validateStoredEmailVerificationToken(validUser, rawToken), true);
  assert.throws(() => validateStoredEmailVerificationToken(validUser, 'wrong-token'), /invalid or expired/);
  assert.throws(
    () => validateStoredEmailVerificationToken({ ...validUser, emailVerificationExpiresAt: new Date(Date.now() - 1000) }, rawToken),
    /invalid or expired/,
  );
  assert.throws(
    () => validateStoredEmailVerificationToken({ ...validUser, emailVerificationUsedAt: new Date() }, rawToken),
    /already been used/,
  );
});

test('email verification resend is rate limited', () => {
  const now = new Date('2026-07-18T10:00:00.000Z');
  assert.doesNotThrow(() => assertVerificationResendAllowed({ emailVerificationLastSentAt: new Date('2026-07-18T09:58:00.000Z') }, now));
  assert.throws(
    () => assertVerificationResendAllowed({ emailVerificationLastSentAt: new Date('2026-07-18T09:59:45.000Z') }, now),
    /Please wait/,
  );
});

test('Brevo email verification sends the correct email payload', async () => {
  const originalEnv = {
    EMAIL_PROVIDER: process.env.EMAIL_PROVIDER,
    EMAIL_API_KEY: process.env.EMAIL_API_KEY,
    EMAIL_FROM: process.env.EMAIL_FROM,
    EMAIL_FROM_NAME: process.env.EMAIL_FROM_NAME,
    EMAIL_BREVO_API_URL: process.env.EMAIL_BREVO_API_URL,
    EXPOSE_PASSWORD_RESET_LINK_IN_RESPONSE: process.env.EXPOSE_PASSWORD_RESET_LINK_IN_RESPONSE,
  };
  const originalFetch = global.fetch;
  let capturedOptions;

  process.env.EMAIL_PROVIDER = 'brevo';
  process.env.EMAIL_API_KEY = 'test-brevo-key';
  process.env.EMAIL_FROM = 'no-reply@example.com';
  process.env.EMAIL_FROM_NAME = 'Competra';
  process.env.EMAIL_BREVO_API_URL = 'https://api.brevo.com/v3/smtp/email';
  process.env.EXPOSE_PASSWORD_RESET_LINK_IN_RESPONSE = 'false';

  global.fetch = async (url, options) => {
    capturedOptions = options;
    return { ok: true, status: 201, json: async () => ({ messageId: 'test-message-id' }) };
  };

  try {
    const result = await sendEmailVerificationEmail({
      to: 'learner@example.com',
      name: 'Learner User',
      verificationLink: 'https://competra.example/verify-email?token=abc',
      expiresInMinutes: 30,
    });

    assert.equal(result.sent, true);
    const body = JSON.parse(capturedOptions.body);
    assert.deepEqual(body.to, [{ email: 'learner@example.com', name: 'Learner User' }]);
    assert.deepEqual(body.tags, ['email-verification']);
    assert.match(body.subject, /Verify your Competra email address/);
    assert.match(body.textContent, /verify-email\?token=abc/);
    assert.match(body.htmlContent, /Verify email/);
  } finally {
    global.fetch = originalFetch;
    Object.entries(originalEnv).forEach(([key, value]) => {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    });
  }
});