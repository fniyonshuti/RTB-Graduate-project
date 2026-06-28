import {
  createManagedUser,
  deactivateManagedUser,
  getManagedUser,
  listManagedUsers,
  updateManagedUser,
} from '../services/userService.js';
import { asyncHandler } from '../utils/errors.js';
import { sendSuccess } from '../utils/response.js';

export const listUsers = asyncHandler(async (req, res) => {
  const users = await listManagedUsers(req.query);
  sendSuccess(res, 'Users loaded', users);
});

export const getUser = asyncHandler(async (req, res) => {
  const user = await getManagedUser(req.params.id);
  sendSuccess(res, 'User loaded', user);
});

export const createUser = asyncHandler(async (req, res) => {
  const user = await createManagedUser(req.body);
  sendSuccess(res, 'User created', user, 201);
});

export const updateUser = asyncHandler(async (req, res) => {
  const user = await updateManagedUser(req.params.id, req.body);
  sendSuccess(res, 'User updated', user);
});

export const deactivateUser = asyncHandler(async (req, res) => {
  const user = await deactivateManagedUser(req.params.id);
  sendSuccess(res, 'User deactivated', user);
});
