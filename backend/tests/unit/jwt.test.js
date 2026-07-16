import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';
import { signJwt, verifyJwt } from '../../src/services/authService.js';

const originalJwtSecret = process.env.JWT_SECRET;

describe('JWT utilities', () => {
  before(() => {
    process.env.JWT_SECRET = 'unit-test-jwt-secret-for-auth-service';
  });

  after(() => {
    if (originalJwtSecret === undefined) {
      delete process.env.JWT_SECRET;
      return;
    }

    process.env.JWT_SECRET = originalJwtSecret;
  });
  it('verifies a token signed by the application', () => {
    const token = signJwt({ sub: 'user-id', role: 'normal_user' }, 60);
    const payload = verifyJwt(token);

    assert.equal(payload.sub, 'user-id');
    assert.equal(payload.role, 'normal_user');
  });

  it('rejects malformed signatures as authentication errors', () => {
    const token = signJwt({ sub: 'user-id' }, 60);
    const malformed = `${token.split('.').slice(0, 2).join('.')}.short`;

    assert.throws(() => verifyJwt(malformed), {
      statusCode: 401,
      message: 'Invalid authentication token',
    });
  });
});
