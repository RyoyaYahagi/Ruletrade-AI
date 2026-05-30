import { describe, expect, test, vi } from "vitest";
import {
  structuredLog,
  logInfo,
  logWarn,
  logError,
} from "@/lib/observability/structured-logger";

describe("structuredLog", () => {
  test("includes required fields", () => {
    const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});

    structuredLog({ level: "info", message: "test" });

    const logged = JSON.parse(consoleSpy.mock.calls[0][0]);
    expect(logged.level).toBe("info");
    expect(logged.message).toBe("test");
    expect(logged.timestamp).toBeDefined();

    consoleSpy.mockRestore();
  });

  test("logInfo calls structuredLog with info level", () => {
    const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});

    logInfo("hello", { key: "value" });

    const logged = JSON.parse(consoleSpy.mock.calls[0][0]);
    expect(logged.level).toBe("info");
    expect(logged.message).toBe("hello");
    expect(logged.metadata).toEqual({ key: "value" });

    consoleSpy.mockRestore();
  });
});
