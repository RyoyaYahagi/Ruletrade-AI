import "server-only";

/**
 * Basic input sanitization helpers.
 */

const CONTROL_CHARS = /[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/g;

export function sanitizeString(input: string): string {
  return input.replace(CONTROL_CHARS, "").trim();
}

export function sanitizeObject(
  input: Record<string, unknown>,
): Record<string, unknown> {
  const result = { ...input };
  for (const key of Object.keys(result)) {
    const value = result[key];
    if (typeof value === "string") {
      result[key] = sanitizeString(value);
    }
  }
  return result;
}

export function assertSafeId(id: string): string {
  if (!/^[a-f0-9-]{36}$/i.test(id) && !/^[a-zA-Z0-9_-]{1,64}$/.test(id)) {
    throw new Error("Invalid identifier format.");
  }
  return id;
}
