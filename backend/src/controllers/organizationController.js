import organizationService from '../services/organizationService.js';
import { asyncHandler } from '../services/errorService.js';
import { sendSuccess } from '../services/responseService.js';

class OrganizationController {
  list = asyncHandler(async (req, res) => {
    const organizations = await organizationService.listOrganizations(req.query, req.user);
    sendSuccess(res, 'Organizations loaded', organizations);
  });

  listPublic = asyncHandler(async (req, res) => {
    const organizations = await organizationService.listPublicOrganizations();
    sendSuccess(res, 'Public organizations loaded', organizations);
  });

  getOne = asyncHandler(async (req, res) => {
    const organization = await organizationService.getOrganizationById(req.params.id, req.user);
    sendSuccess(res, 'Organization loaded', organization);
  });

  create = asyncHandler(async (req, res) => {
    const organization = await organizationService.createOrganization(req.body);
    sendSuccess(res, 'Organization created', organization, 201);
  });

  update = asyncHandler(async (req, res) => {
    const organization = await organizationService.updateOrganization(req.params.id, req.body);
    sendSuccess(res, 'Organization updated', organization);
  });

  remove = asyncHandler(async (req, res) => {
    const organization = await organizationService.deleteOrganization(req.params.id);
    sendSuccess(res, 'Organization disabled', organization);
  });
}

const organizationController = new OrganizationController();

export const list = organizationController.list;
export const listPublic = organizationController.listPublic;
export const getOne = organizationController.getOne;
export const create = organizationController.create;
export const update = organizationController.update;
export const remove = organizationController.remove;
export default organizationController;