import {
  createManagedUser,
  deactivateManagedUser,
  deleteManagedUser,
  getManagedUser,
  listManagedUsers,
  resetManagedUserTemporaryPassword,
  updateManagedUser,
} from '../services/userService.js';
import { asyncHandler } from '../utils/errors.js';
import { sendSuccess } from '../utils/response.js';

export const listUsers = asyncHandler(async (req, res) => {
  const users = await listManagedUsers(req.query, req.user);
  sendSuccess(res, 'Users loaded', users);
});

export const getUser = asyncHandler(async (req, res) => {
  const user = await getManagedUser(req.params.id, req.user);
  sendSuccess(res, 'User loaded', user);
});

export const createUser = asyncHandler(async (req, res) => {
  const user = await createManagedUser(req.body, req.user);
  sendSuccess(res, 'User created', user, 201);
});

export const updateUser = asyncHandler(async (req, res) => {
  const user = await updateManagedUser(req.params.id, req.body, req.user);
  sendSuccess(res, 'User updated', user);
});

export const deactivateUser = asyncHandler(async (req, res) => {
  const user = await deactivateManagedUser(req.params.id, req.user);
  sendSuccess(res, 'User deactivated', user);
});

export const deleteUser = asyncHandler(async (req, res) => {
  const user = await deleteManagedUser(req.params.id, req.user);
  sendSuccess(res, 'User deleted', user);
});

export const resetUserTemporaryPassword = asyncHandler(async (req, res) => {
  const result = await resetManagedUserTemporaryPassword(req.params.id, req.user);
  sendSuccess(res, 'Temporary password reset successfully', result);
});
