import { randomBytes } from "crypto";
import * as jwt from "jsonwebtoken";

/**
 * Signing key. Set JWT_SECRET to keep sessions across restarts. Without it a
 * random key is made at startup, so a restart signs everyone out, which matches
 * the in-memory data being reset at the same moment.
 */
const SECRET = process.env.JWT_SECRET || randomBytes(48).toString("hex");

/** How long a sign-in lasts. */
const EXPIRES_IN = process.env.JWT_EXPIRES_IN || "8h";

export interface TokenClaims {
  /** user_id */
  sub: string;
  role: string;
  /** organization_id; absent for EnerTrack staff, who have no organisation. */
  org?: string;
}

export function signToken(user: {
  user_id: string;
  role: string;
  organization_id?: string | null;
}): string {
  const claims: TokenClaims = {
    sub: user.user_id,
    role: user.role,
    ...(user.organization_id ? { org: user.organization_id } : {}),
  };
  return jwt.sign(claims, SECRET, {
    algorithm: "HS256",
    expiresIn: EXPIRES_IN as jwt.SignOptions["expiresIn"],
  });
}

/** Returns the claims, or null when the token is forged, malformed or expired. */
export function verifyToken(token: string): TokenClaims | null {
  try {
    const decoded = jwt.verify(token, SECRET, { algorithms: ["HS256"] });
    if (typeof decoded === "string" || !decoded.sub || !decoded.role) return null;
    return decoded as unknown as TokenClaims;
  } catch {
    return null;
  }
}
