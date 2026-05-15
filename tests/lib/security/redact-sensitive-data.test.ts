import { describe, it, expect } from "vitest";
import { redactSensitiveData } from "@/lib/security/redact-sensitive-data";

describe("redactSensitiveData", () => {
  it("returns null/undefined as-is", () => {
    expect(redactSensitiveData(null)).toBeNull();
    expect(redactSensitiveData(undefined)).toBeUndefined();
  });

  it("returns primitives as-is", () => {
    expect(redactSensitiveData(42)).toBe(42);
    expect(redactSensitiveData(true)).toBe(true);
    expect(redactSensitiveData("hello")).toBe("hello");
  });

  it("redacts password keys", () => {
    const input = { password: "secret123", name: "Alice" };
    const result = redactSensitiveData(input) as Record<string, unknown>;
    expect(result.password).toBe("[REDACTED]");
    expect(result.name).toBe("Alice");
  });

  it("redacts nested token keys", () => {
    const input = { data: { access_token: "abc123", value: 10 } };
    const result = redactSensitiveData(input) as Record<string, unknown>;
    const nested = result.data as Record<string, unknown>;
    expect(nested.access_token).toBe("[REDACTED]");
    expect(nested.value).toBe(10);
  });

  it("redacts Bearer tokens in strings", () => {
    const input = { header: "Authorization: Bearer xyz789" };
    const result = redactSensitiveData(input) as Record<string, unknown>;
    expect(result.header).toBe("Authorization: [REDACTED]");
  });

  it("redacts OpenAI-style API keys", () => {
    const input = { key: "sk-test-fake-key-for-redaction" };
    const result = redactSensitiveData(input) as Record<string, unknown>;
    expect(result.key).toBe("[REDACTED]");
  });

  it("redacts arrays recursively", () => {
    const input = [{ api_key: "secret1" }, { api_key: "secret2" }];
    const result = redactSensitiveData(input) as Array<Record<string, unknown>>;
    expect(result[0].api_key).toBe("[REDACTED]");
    expect(result[1].api_key).toBe("[REDACTED]");
  });
});
