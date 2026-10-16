/**
 * TEST-ONLY: lets the existing e2e tests keep saying who they are with
 * `.set('x-role', 'Super Admin')` / `.set('x-org-id', 'org-001')`.
 *
 * The server no longer trusts those headers (AuthMiddleware discards them and
 * reads a signed token instead), so a bare `x-role` would now be anonymous.
 * This setup file intercepts supertest's `.set()` and, whenever a test names a
 * role, signs a real token for it and sends `Authorization: Bearer <token>`.
 * The backend under test sees exactly what a signed-in browser would send.
 *
 * Opt out per request with `.set('x-forge-role', 'Super Admin')`, which sends
 * the raw, unsigned `x-role` header, so tests can prove a forged header does
 * nothing.
 */
// A fixed key, set before token.ts is first loaded, so the key that signs here
// is the one the app under test verifies with.
process.env.JWT_SECRET = process.env.JWT_SECRET || 'e2e-test-secret';
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { signToken } = require('../src/core/auth/token');

// eslint-disable-next-line @typescript-eslint/no-require-imports
const SupertestTest = require('supertest/lib/test');
const originalSet = SupertestTest.prototype.set;

SupertestTest.prototype.set = function (field: any, value?: any) {
  if (field && typeof field === 'object') {
    for (const key of Object.keys(field)) this.set(key, field[key]);
    return this;
  }

  const name = String(field).toLowerCase();

  if (name === 'x-forge-role') return originalSet.call(this, 'x-role', value);
  if (name === 'x-forge-org-id') return originalSet.call(this, 'x-org-id', value);

  if (name === 'x-role' || name === 'x-org-id') {
    if (name === 'x-role') this.__role = value;
    else this.__org = value;
    if (this.__role) {
      originalSet.call(
        this,
        'Authorization',
        `Bearer ${signToken({
          user_id: 'test-user',
          role: this.__role,
          organization_id: this.__org,
        })}`,
      );
    }
    return this;
  }

  return originalSet.apply(this, arguments);
};
