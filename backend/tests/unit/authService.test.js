import test from 'node:test';
import assert from 'node:assert/strict';
import authService from '../../src/services/authService.js';

test('auth service default export exposes Google login handler', () => {
  assert.equal(typeof authService.loginWithGoogle, 'function');
});
