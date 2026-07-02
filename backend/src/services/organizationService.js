import Organization from '../models/Organization.js';
import User from '../models/User.js';
import { AppError } from '../utils/errors.js';

function organizationIdOf(user) {
  return user?.organization?._id || user?.organization;
}

export function listOrganizations(filters = {}, user) {
  const query = {};

  if (user?.role === 'org_admin') {
    query._id = organizationIdOf(user);
  }

  if (filters.status) query.status = filters.status;

  return Organization.find(query).sort({ name: 1 });
}

export function listPublicOrganizations() {
  return Organization.find({ status: 'active' })
    .select('name district type status')
    .sort({ name: 1 });
}

export async function getOrganizationById(organizationId, user) {
  const query = { _id: organizationId };

  if (user?.role === 'org_admin') {
    query._id = organizationIdOf(user);
  }

  const organization = await Organization.findOne(query);

  if (!organization) {
    throw new AppError('Organization was not found', 404);
  }

  return organization;
}

export async function createOrganization(payload) {
  const { name, district, type, contactEmail, phone, address, status } = payload;

  if (!name) {
    throw new AppError('Organization name is required', 400);
  }

  const existing = await Organization.findOne({
    name: name.trim(),
  });

  if (existing) {
    throw new AppError('Organization name is already registered', 409);
  }

  return Organization.create({
    name,
    district,
    type,
    contactEmail,
    phone,
    address,
    status,
  });
}

export async function updateOrganization(organizationId, payload) {
  const allowedUpdates = [
    'name',
    'district',
    'type',
    'contactEmail',
    'phone',
    'address',
    'status',
  ];
  const updates = {};

  allowedUpdates.forEach((field) => {
    if (payload[field] !== undefined) updates[field] = payload[field];
  });

  const organization = await Organization.findByIdAndUpdate(
    organizationId,
    updates,
    { new: true, runValidators: true },
  );

  if (!organization) {
    throw new AppError('Organization was not found', 404);
  }

  if (updates.name) {
    await User.updateMany(
      { organization: organization._id },
      { institution: organization.name },
    );
  }

  return organization;
}

export async function deleteOrganization(organizationId) {
  const activeUsers = await User.countDocuments({
    organization: organizationId,
    isActive: true,
  });

  if (activeUsers > 0) {
    throw new AppError(
      'Organization has active users. Deactivate or move users before disabling it.',
      400,
    );
  }

  const organization = await Organization.findByIdAndUpdate(
    organizationId,
    { status: 'inactive' },
    { new: true },
  );

  if (!organization) {
    throw new AppError('Organization was not found', 404);
  }

  return organization;
}
