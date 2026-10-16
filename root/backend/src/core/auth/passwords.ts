import * as bcrypt from "bcryptjs";

/** Cheap under test so the suite stays fast; a normal cost everywhere else. */
const ROUNDS = process.env.NODE_ENV === "test" || process.env.JEST_WORKER_ID ? 4 : 8;

const BCRYPT_FORMAT = /^\$2[aby]\$\d{2}\$.{53}$/;

/**
 * Turns a password into the hash that is stored.
 *
 * Idempotent on purpose: an audit request's password is hashed when it is
 * submitted, and approving the request passes that same value on to the new
 * user record. Hashing a hash would make the account impossible to sign in to.
 */
export function hashPassword(password: string): string {
  if (BCRYPT_FORMAT.test(password)) return password;
  return bcrypt.hashSync(password, ROUNDS);
}

/** True when `password` is what `stored` was made from. */
export function verifyPassword(password: string, stored: string | undefined): boolean {
  if (!stored || !BCRYPT_FORMAT.test(stored)) return false;
  return bcrypt.compareSync(password, stored);
}
