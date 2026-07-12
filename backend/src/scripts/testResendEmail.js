import dotenv from 'dotenv';
import { sendPasswordResetEmail } from '../services/authService.js';

dotenv.config({ quiet: true });

const recipient =
  process.argv[2] ||
  process.env.EMAIL_TEST_TO ||
  process.env.TEST_EMAIL_TO ||
  process.env.EMAIL_FROM;

const emailProvider = process.env.EMAIL_PROVIDER || 'generic';
const frontendUrl = process.env.FRONTEND_URL || '';
const passwordResetTokenExpiresMinutes =
  Number(process.env.PASSWORD_RESET_TOKEN_EXPIRES_MINUTES) || 15;

if (emailProvider !== 'resend') {
  console.error(
    `EMAIL_PROVIDER must be "resend" to run this test. Current value: ${emailProvider}`,
  );
  process.exit(1);
}

if (!recipient) {
  console.error(
    'Missing test recipient. Run: npm run test:resend -- user@example.com',
  );
  process.exit(1);
}

if (!frontendUrl) {
  console.error('FRONTEND_URL is required to create the test password reset link.');
  process.exit(1);
}

const resetLink = `${frontendUrl.replace(
  /\/$/,
  '',
)}/?resetToken=test-resend-token-${Date.now()}`;

try {
  const result = await sendPasswordResetEmail({
    to: recipient,
    name: 'Resend Test User',
    resetLink,
    expiresInMinutes: passwordResetTokenExpiresMinutes,
  });

  console.log(
    `Resend test email sent to ${recipient}. Email API accepted request: ${result.sent}`,
  );
} catch (error) {
  console.error(error.message);
  process.exit(1);
}
