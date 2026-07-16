import test from 'node:test';
import assert from 'node:assert/strict';
import authService from '../../src/services/authService.js';
import { sendPasswordResetEmail } from '../../src/services/emailService.js';

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




