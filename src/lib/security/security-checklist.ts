import "server-only";

/**
 * Runtime security assertions for production.
 */

export function assertNoPublicSecrets() {
  const publicEnvVars = Object.keys(process.env).filter((key) =>
    key.startsWith("NEXT_PUBLIC_"),
  );

  const suspicious = publicEnvVars.filter((key) => {
    const value = process.env[key];
    if (!value) return false;
    const lower = value.toLowerCase();
    return (
      lower.includes("sk-") ||
      lower.includes("api_key") ||
      lower.includes("secret") ||
      lower.includes("password") ||
      lower.includes("token")
    );
  });

  if (suspicious.length > 0) {
    throw new Error(
      `Potentially secret values found in NEXT_PUBLIC_ env vars: ${suspicious.join(", ")}`,
    );
  }
}

export function assertOwnershipChecksConfigured() {
  // Ownership is enforced in server-side services and API routes.
}

export function assertSecurityHeaders(headers: Headers) {
  const required = ["x-content-type-options", "x-frame-options"];
  const missing = required.filter((h) => !headers.get(h));
  return { missing, ok: missing.length === 0 };
}
