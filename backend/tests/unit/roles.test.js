import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  ROLES,
  canCreateRole,
  canManageRole,
  creatableRolesFor,
  manageableRolesFor,
} from '../../src/constants/roles.js';

describe('role management rules', () => {
  it('allows super admin to create admin accounts as the next hierarchy level', () => {
    assert.deepEqual(creatableRolesFor(ROLES.SUPER_ADMIN), [ROLES.ADMIN]);
    assert.equal(canCreateRole(ROLES.SUPER_ADMIN, ROLES.ADMIN), true);
    assert.equal(
      canCreateRole(ROLES.SUPER_ADMIN, ROLES.ORGANIZATION_ADMIN),
      false,
    );
    assert.equal(
      canCreateRole(ROLES.SUPER_ADMIN, ROLES.ORGANIZATION_USER),
      false,
    );
  });

  it('allows admin to manage only organization admin accounts', () => {
    assert.deepEqual(manageableRolesFor(ROLES.ADMIN), [
      ROLES.ORGANIZATION_ADMIN,
    ]);
    assert.deepEqual(creatableRolesFor(ROLES.ADMIN), [
      ROLES.ORGANIZATION_ADMIN,
    ]);
    assert.equal(canCreateRole(ROLES.ADMIN, ROLES.ORGANIZATION_ADMIN), true);
    assert.equal(canCreateRole(ROLES.ADMIN, ROLES.ORGANIZATION_USER), false);
    assert.equal(canManageRole(ROLES.ADMIN, ROLES.ORGANIZATION_ADMIN), true);
    assert.equal(canManageRole(ROLES.ADMIN, ROLES.ORGANIZATION_USER), false);
    assert.equal(canManageRole(ROLES.ADMIN, ROLES.ADMIN), false);
  });

  it('allows organization admin to manage only organization user accounts', () => {
    assert.deepEqual(manageableRolesFor(ROLES.ORGANIZATION_ADMIN), [
      ROLES.ORGANIZATION_USER,
    ]);
    assert.deepEqual(creatableRolesFor(ROLES.ORGANIZATION_ADMIN), [
      ROLES.ORGANIZATION_USER,
    ]);
    assert.equal(
      canCreateRole(ROLES.ORGANIZATION_ADMIN, ROLES.ORGANIZATION_USER),
      true,
    );
    assert.equal(
      canCreateRole(ROLES.ORGANIZATION_ADMIN, ROLES.ORGANIZATION_ADMIN),
      false,
    );
    assert.equal(
      canManageRole(ROLES.ORGANIZATION_ADMIN, ROLES.ORGANIZATION_USER),
      true,
    );
    assert.equal(
      canManageRole(ROLES.ORGANIZATION_ADMIN, ROLES.ORGANIZATION_ADMIN),
      false,
    );
    assert.equal(canManageRole(ROLES.ORGANIZATION_ADMIN, ROLES.ADMIN), false);
  });
});
