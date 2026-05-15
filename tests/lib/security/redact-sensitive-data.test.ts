import { describe, it, expect } from "vitest";
import { redactSensitiveData } from "@/lib/security/redact-sensitive-data";

describe("redactSensitiveData", () => {
  it("returns null as-is", () => {
    expect(redactSensitiveData(null)).toBeNull();
  });

  it("returns undefined as-is", () => {
    expect(redactSensitiveData(undefined)).toBeUndefined();
  });

  it("returns primitives as-is", () => {
    expect(redactSensitiveData(42)).toBe(42);
    expect(redactSensitiveData(true)).toBe(true);
  });

  it("redacts password field", () => {
    const result = redactSensitiveData({
      username: "test",
      password: "secret123",
    });
    expect(result).toEqual({
      username: "test",
      password: "[REDACTED]",
    });
  });

  it("redacts nested sensitive fields", () => {
    const result = redactSensitiveData({
      user: {
        name: "test",
        api_key: "sk-abc123",
        token: "eyJhbGci...",
      },
    });
    expect(result).toEqual({
      user: {
        name: "test",
        api_key: "[REDACTED]",
        token: "[REDACTED]",
      },
    });
  });

  it("redacts Bearer tokens in strings", () => {
    const result = redactSensitiveData(
      "Authorization: Bearer test-token-123",
    );
    expect(result).toBe("Authorization: [REDACTED]");
  });

  it("redacts arrays", () => {
    const result = redactSensitiveData([
      { name: "a", secret: "x" },
      { name: "b", password: "y" },
    ]);
    expect(result).toEqual([
      { name: "a", secret: "[REDACTED]" },
      { name: "b", password: "[REDACTED]" },
    ]);
  });
});
