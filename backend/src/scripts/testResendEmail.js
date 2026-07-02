import { sendPasswordResetEmail } from '../services/emailService.js';
import { env } from '../config/env.js';

const recipient =
  process.argv[2] ||
  process.env.EMAIL_TEST_TO ||
  process.env.TEST_EMAIL_TO ||
  env.emailFrom;

if (env.emailProvider !== 'resend') {
  console.error(
    `EMAIL_PROVIDER must be "resend" to run this test. Current value: ${env.emailProvider}`,
  );
  process.exit(1);
}

if (!recipient) {
  console.error(
    'Missing test recipient. Run: npm run test:resend -- user@example.com',
  );
  process.exit(1);
}

const resetLink = `${env.frontendUrl.replace(
  /\/$/,
  '',
)}/?resetToken=test-resend-token-${Date.now()}`;

try {
  const result = await sendPasswordResetEmail({
    to: recipient,
    name: 'Resend Test User',
    resetLink,
    expiresInMinutes: env.passwordResetTokenExpiresMinutes,
  });

  console.log(
    `Resend test email sent to ${recipient}. Email API accepted request: ${result.sent}`,
  );
} catch (error) {
  console.error(error.message);
  process.exit(1);
}
