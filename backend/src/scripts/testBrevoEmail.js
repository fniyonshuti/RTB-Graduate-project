import dotenv from 'dotenv';
import { buildPasswordResetUrl, sendPasswordResetEmail } from '../services/emailService.js';

dotenv.config({ quiet: true });

async function main() {
  const recipient =
    process.argv[2] ||
    process.env.EMAIL_TEST_TO ||
    process.env.TEST_EMAIL_TO ||
    process.env.EMAIL_FROM;

  const emailProvider = String(process.env.EMAIL_PROVIDER || 'brevo').toLowerCase();
  const frontendUrl = process.env.FRONTEND_URL || '';
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
    console.error('Missing test recipient. Run: npm run test:brevo -- user@example.com');
    process.exitCode = 1;
    return;
  }

  if (!frontendUrl) {
    console.error('FRONTEND_URL is required to create the test password reset link.');
    process.exitCode = 1;
    return;
  }

  const resetLink = buildPasswordResetUrl(`test-brevo-token-${Date.now()}`);

  try {
    const result = await sendPasswordResetEmail({
      to: recipient,
      name: 'Brevo Test User',
      resetLink,
      expiresInMinutes: passwordResetTokenExpiresMinutes,
    });

    if (!result.sent) {
      console.error('Brevo did not accept the password reset email request.');
      process.exitCode = 1;
      return;
    }

    console.log(`Brevo test email accepted for delivery to ${recipient}.`);
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}

await main();

