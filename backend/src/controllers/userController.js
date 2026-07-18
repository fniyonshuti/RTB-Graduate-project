import userService from '../services/userService.js';
import { asyncHandler } from '../services/errorService.js';
import { sendSuccess } from '../services/responseService.js';

class UserController {
  listUsers = asyncHandler(async (req, res) => {
    const users = await userService.listManagedUsers(req.query, req.user);
    sendSuccess(res, 'Users loaded', users);
  });

  getUser = asyncHandler(async (req, res) => {
    const user = await userService.getManagedUser(req.params.id, req.user);
    sendSuccess(res, 'User loaded', user);
  });

  createUser = asyncHandler(async (req, res) => {
    const user = await userService.createManagedUser(req.body, req.user);
    sendSuccess(res, 'User created. Verification email sent to the user.', user, 201);
  });

  updateUser = asyncHandler(async (req, res) => {
    const user = await userService.updateManagedUser(req.params.id, req.body, req.user);
    sendSuccess(res, 'User updated', user);
  });

  deactivateUser = asyncHandler(async (req, res) => {
    const user = await userService.deactivateManagedUser(req.params.id, req.user);
    sendSuccess(res, 'User deactivated', user);
  });

  deleteUser = asyncHandler(async (req, res) => {
    const user = await userService.deleteManagedUser(req.params.id, req.user);
    sendSuccess(res, 'User deleted', user);
  });
}

const userController = new UserController();

export const listUsers = userController.listUsers;
export const getUser = userController.getUser;
export const createUser = userController.createUser;
export const updateUser = userController.updateUser;
export const deactivateUser = userController.deactivateUser;
export const deleteUser = userController.deleteUser;
export default userController;
