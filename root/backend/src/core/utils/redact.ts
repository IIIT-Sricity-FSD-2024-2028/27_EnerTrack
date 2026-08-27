/**
 * Redaction helper for anything that gets written to a log.
 *
 * WHY THIS EXISTS
 * ───────────────
 * LoggerMiddleware writes every request body to logs/custom-debug-*.log and
 * to the console. POST /api/users/login carries a plaintext password in that
 * body, so before this existed, every login attempt wrote the user's password
 * to disk in the clear — where it stayed until the 7-day cleanup removed it.
 *
 * Logs get copied around, pasted into chat, and committed by accident. A
 * credential that reaches a log file should be treated as compromised, so the
 * fix is to make sure it never arrives in the first place.
 */

/**
 * Field names whose values must never be logged.
 *
 * Matched case-insensitively as a SUBSTRING, so "password" also covers
 * "newPassword", "confirm_password" and "oldPassword" without listing each.
 */
const SENSITIVE_KEY_PATTERNS = [
  "password",
  "passwd",
  "secret",
  "token",
  "apikey",
  "api_key",
  "authorization",
  "auth",
  "credential",
  "sessionid",
  "session_id",
  "cookie",
];

export const REDACTED = "[REDACTED]";

/** True when a field name looks like it holds a credential. */
export function isSensitiveKey(key: string): boolean {
  const normalised = key.toLowerCase().replace(/[-_\s]/g, "");
  return SENSITIVE_KEY_PATTERNS.some((pattern) =>
    normalised.includes(pattern.replace(/[-_]/g, "")),
  );
}

/**
 * Returns a deep copy of `value` with every sensitive field replaced by
 * "[REDACTED]".
 *
 * Copies rather than mutating: the request body is handed to the controller
 * after the logger has seen it, so editing it in place would break login by
 * replacing the real password with the mask before the service could check it.
 *
 * @param value  Any request or response payload
 * @param depth  Guard against deeply nested or self-referencing objects
 */
export function redactSensitive(value: unknown, depth = 0): unknown {
  if (depth > 10) return "[TRUNCATED: too deep]";
  if (value === null || value === undefined) return value;

  if (Array.isArray(value)) {
    return value.map((item) => redactSensitive(item, depth + 1));
  }

  if (typeof value === "object") {
    // Buffers and streams are binary; summarise rather than dump them.
    if (Buffer.isBuffer(value)) return `[Buffer ${value.length} bytes]`;

    const out: Record<string, unknown> = {};
    for (const [key, val] of Object.entries(value as Record<string, unknown>)) {
      out[key] = isSensitiveKey(key) ? REDACTED : redactSensitive(val, depth + 1);
    }
    return out;
  }

  return value;
}

/**
 * Convenience wrapper for the common "stringify a body for a one-line log"
 * case. Returns the redacted JSON, or a placeholder if it cannot be
 * serialised (circular references, for instance).
 */
export function redactedJson(value: unknown): string {
  try {
    return JSON.stringify(redactSensitive(value));
  } catch {
    return "[UNSERIALISABLE]";
  }
}
