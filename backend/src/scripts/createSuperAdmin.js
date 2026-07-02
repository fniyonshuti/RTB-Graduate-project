import dotenv from 'dotenv';
import mongoose from 'mongoose';
import connectDB from '../config/db.js';
import User from '../models/User.js';
import { hashPassword } from '../utils/password.js';

dotenv.config();

const adminName = process.env.SUPER_ADMIN_NAME || 'System Admin';
const adminEmail = String(process.env.SUPER_ADMIN_EMAIL || '').trim().toLowerCase();
const adminPassword = String(process.env.SUPER_ADMIN_PASSWORD || '');
const adminInstitution = process.env.SUPER_ADMIN_INSTITUTION || 'RTB';
const resetExistingPassword = process.env.SUPER_ADMIN_RESET_PASSWORD === 'true';
const promoteExistingUser = process.env.SUPER_ADMIN_PROMOTE_EXISTING === 'true';

function assertSeedConfig() {
  if (!adminEmail) {
    throw new Error('SUPER_ADMIN_EMAIL is required.');
  }

  if (!adminPassword || adminPassword.length < 6) {
    throw new Error('SUPER_ADMIN_PASSWORD must be at least 6 characters.');
  }
}

function passwordFields() {
  const { passwordHash, passwordSalt } = hashPassword(adminPassword);

  return {
    passwordHash,
    passwordSalt,
    mustChangePassword: true,
    temporaryPasswordExpiresAt: undefined,
    passwordChangedAt: undefined,
  };
}

async function createSuperAdmin() {
  assertSeedConfig();
  await connectDB();

  const existingUser = await User.findOne({ email: adminEmail }).select(
    '+passwordHash +passwordSalt',
  );

  if (existingUser) {
    if (existingUser.role !== 'admin' && !promoteExistingUser) {
      throw new Error(
        `User ${adminEmail} already exists with role "${existingUser.role}". Set SUPER_ADMIN_PROMOTE_EXISTING=true to promote this exact user.`,
      );
    }

    const updates = {
      name: existingUser.name || adminName,
      role: 'admin',
      institution: existingUser.institution || adminInstitution,
      isActive: true,
    };

    if (resetExistingPassword || existingUser.role !== 'admin') {
      Object.assign(updates, passwordFields());
    }

    await User.updateOne({ _id: existingUser._id }, { $set: updates });

    console.log('Superadmin account already exists and was updated safely.');
    console.log(`Email: ${adminEmail}`);
    console.log(`Password reset: ${resetExistingPassword || existingUser.role !== 'admin' ? 'yes' : 'no'}`);
    return;
  }

  const user = await User.create({
    name: adminName,
    email: adminEmail,
    ...passwordFields(),
    role: 'admin',
    institution: adminInstitution,
    isActive: true,
  });

  console.log('Superadmin account created successfully.');
  console.log(`Email: ${user.email}`);
  console.log('The account must change its password after first login.');
}

createSuperAdmin()
  .catch((error) => {
    console.error('Superadmin seed failed:', error.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    await mongoose.disconnect();
  });
