import {
  createOrganization,
  deleteOrganization,
  getOrganizationById,
  listOrganizations,
  listPublicOrganizations,
  updateOrganization,
} from '../services/organizationService.js';
import { asyncHandler } from '../utils/errors.js';
import { sendSuccess } from '../utils/response.js';

export const list = asyncHandler(async (req, res) => {
  const organizations = await listOrganizations(req.query, req.user);
  sendSuccess(res, 'Organizations loaded', organizations);
});

export const listPublic = asyncHandler(async (req, res) => {
  const organizations = await listPublicOrganizations();
  sendSuccess(res, 'Public organizations loaded', organizations);
});

export const getOne = asyncHandler(async (req, res) => {
  const organization = await getOrganizationById(req.params.id, req.user);
  sendSuccess(res, 'Organization loaded', organization);
});

export const create = asyncHandler(async (req, res) => {
  const organization = await createOrganization(req.body);
  sendSuccess(res, 'Organization created', organization, 201);
});

export const update = asyncHandler(async (req, res) => {
  const organization = await updateOrganization(req.params.id, req.body);
  sendSuccess(res, 'Organization updated', organization);
});

export const remove = asyncHandler(async (req, res) => {
  const organization = await deleteOrganization(req.params.id);
  sendSuccess(res, 'Organization disabled', organization);
});
