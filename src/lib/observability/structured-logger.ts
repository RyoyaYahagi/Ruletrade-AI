import "server-only";

export interface LogEntry {
  level: "info" | "warn" | "error";
  message: string;
  requestId?: string;
  userId?: string | null;
  route?: string;
  errorCode?: string;
  durationMs?: number;
  metadata?: Record<string, unknown>;
  timestamp?: string;
}

export function structuredLog(entry: LogEntry): void {
  const log = {
    ...entry,
    timestamp: entry.timestamp ?? new Date().toISOString(),
  };

  // In development, print readable logs
  // In production, rely on Vercel / Supabase log aggregation
  if (process.env.NODE_ENV !== "production") {
    console.log(JSON.stringify(log));
  }
}

export function logInfo(
  message: string,
  metadata?: Record<string, unknown>,
): void {
  structuredLog({ level: "info", message, metadata });
}

export function logWarn(
  message: string,
  metadata?: Record<string, unknown>,
): void {
  structuredLog({ level: "warn", message, metadata });
}

export function logError(
  message: string,
  metadata?: Record<string, unknown>,
): void {
  structuredLog({ level: "error", message, metadata });
}
