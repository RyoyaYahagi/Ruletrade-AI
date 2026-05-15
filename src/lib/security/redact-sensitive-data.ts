const SENSITIVE_KEY_PATTERNS = [
  "password",
  "passcode",
  "token",
  "access_token",
  "refresh_token",
  "authorization",
  "secret",
  "api_key",
  "apikey",
  "service_role",
  "private_key",
  "credential",
  "connection_string",
];

const SENSITIVE_VALUE_PATTERNS = [
  /Bearer\s+[A-Za-z0-9._\-]+/gi,
  /sk-[A-Za-z0-9_\-]+/g,
  /AIza[0-9A-Za-z_\-]+/g,
  /eyJ[A-Za-z0-9_\-]+\.[A-Za-z0-9_\-]+\.[A-Za-z0-9_\-]+/g,
];

export function redactSensitiveData(value: unknown): unknown {
  if (value === null || value === undefined) {
    return value;
  }

  if (typeof value === "string") {
    return redactString(value);
  }

  if (typeof value === "number" || typeof value === "boolean") {
    return value;
  }

  if (Array.isArray(value)) {
    return value.map((item) => redactSensitiveData(item));
  }

  if (typeof value === "object") {
    const result: Record<string, unknown> = {};

    for (const [key, nestedValue] of Object.entries(value)) {
      if (isSensitiveKey(key)) {
        result[key] = "[REDACTED]";
      } else {
        result[key] = redactSensitiveData(nestedValue);
      }
    }

    return result;
  }

  return value;
}

function isSensitiveKey(key: string) {
  const normalized = key.toLowerCase();

  return SENSITIVE_KEY_PATTERNS.some((pattern) =>
    normalized.includes(pattern)
  );
}

function redactString(value: string) {
  let result = value;

  for (const pattern of SENSITIVE_VALUE_PATTERNS) {
    result = result.replace(pattern, "[REDACTED]");
  }

  return result;
}
