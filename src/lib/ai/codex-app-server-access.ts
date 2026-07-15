import "server-only";

import { AppError } from "@/lib/errors/app-error";

export function assertCodexAppServerLocalOnly(): void {
  if (process.env.NODE_ENV === "production") {
    throw new AppError(
      "INTERNAL_ERROR",
      "ChatGPTログインのCodex App Serverはローカル開発環境でのみ利用できます。",
      500,
    );
  }

  const configuredUrl = process.env.CODEX_APP_SERVER_URL?.trim();
  if (!configuredUrl) return;

  let url: URL;
  try {
    url = new URL(configuredUrl);
  } catch {
    throw new AppError(
      "INTERNAL_ERROR",
      "CODEX_APP_SERVER_URLには有効なWebSocket URLを指定してください。",
      500,
    );
  }

  const isWebSocket = url.protocol === "ws:" || url.protocol === "wss:";
  const isLoopback =
    url.hostname === "localhost" ||
    url.hostname === "127.0.0.1" ||
    url.hostname === "[::1]" ||
    url.hostname === "::1";

  if (!isWebSocket || !isLoopback) {
    throw new AppError(
      "INTERNAL_ERROR",
      "ChatGPTログインのCodex App ServerはloopbackのWebSocketに限定されています。",
      500,
    );
  }
}
