import dotenv from 'dotenv';
import {
  buildEmailVerificationUrl,
  buildPasswordResetUrl,
  sendEmailVerificationEmail,
  sendPasswordResetEmail,
} from '../services/emailService.js';

dotenv.config({ quiet: true });

async function main() {
  const recipient =
    process.argv[2] ||
    process.env.EMAIL_TEST_TO ||
    process.env.TEST_EMAIL_TO ||
    process.env.EMAIL_FROM;

  const emailProvider = String(process.env.EMAIL_PROVIDER || 'brevo').toLowerCase();
  const frontendUrl = process.env.FRONTEND_URL || '';
  const mode = String(process.argv[3] || 'verification').trim().toLowerCase();
  const passwordResetTokenExpiresMinutes =
    Number(process.env.PASSWORD_RESET_TOKEN_EXPIRES_MINUTES) || 15;

  if (emailProvider !== 'brevo') {
    console.error(
      `EMAIL_PROVIDER must be "brevo" to run this test. Current value: ${emailProvider}`,
    );
    process.exitCode = 1;
    return;
  }

  if (!recipient) {
    console.error('Missing test recipient. Run: npm run test:brevo -- user@example.com verification');
    process.exitCode = 1;
    return;
  }

  if (!frontendUrl) {
    console.error('FRONTEND_URL is required to create the test email link.');
    process.exitCode = 1;
    return;
  }

  if (!['verification', 'reset'].includes(mode)) {
    console.error('Invalid email test mode. Use "verification" or "reset".');
    process.exitCode = 1;
    return;
  }

  try {
    const result = mode === 'verification'
      ? await sendEmailVerificationEmail({
          to: recipient,
          name: 'Brevo Test User',
          verificationLink: buildEmailVerificationUrl(`test-verification-token-${Date.now()}`),
          expiresInMinutes: Number(process.env.EMAIL_VERIFICATION_TOKEN_EXPIRES_MINUTES) || 30,
        })
      : await sendPasswordResetEmail({
          to: recipient,
          name: 'Brevo Test User',
          resetLink: buildPasswordResetUrl(`test-brevo-token-${Date.now()}`),
          expiresInMinutes: passwordResetTokenExpiresMinutes,
        });

    if (!result.sent) {
      console.error(`Brevo did not accept the ${mode} email request.`);
      process.exitCode = 1;
      return;
    }

    console.log(`Brevo ${mode} email accepted for delivery to ${recipient}.`);
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}

await main();


