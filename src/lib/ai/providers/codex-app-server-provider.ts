import "server-only";

import { z } from "zod";
import { AIProviderError } from "@/lib/ai/ai-provider-error";
import { assertCodexAppServerLocalOnly } from "@/lib/ai/codex-app-server-access";
import { getAITimeoutMs } from "@/lib/ai/model-config";
import type {
  AIProvider,
  GenerateObjectParams,
  GenerateObjectResult,
  GenerateTextParams,
  GenerateTextResult,
} from "@/lib/ai/provider";
import { normalizeAIUsage } from "@/lib/ai/usage/token-usage";

const DEFAULT_MODEL = "gpt-5.4-mini";
const CONNECTION_TIMEOUT_MS = 5_000;
const MIN_TURN_TIMEOUT_MS = 60_000;
const CODEX_REASONING_EFFORT = "medium";

export type CodexAppServerLoginMode = "browser" | "device-code";

export type CodexAccountStatus = {
  authenticated: boolean;
  authMode: string | null;
  planType: string | null;
};

export type CodexChatGPTLogin =
  | {
      mode: "browser";
      loginId: string;
      authUrl: string;
    }
  | {
      mode: "device-code";
      loginId: string;
      verificationUrl: string;
      userCode: string;
    };

type Notification = { method: string; params?: unknown };
type NotificationHandler = (message: Notification) => void;
type RpcError = { code?: number; message?: string; data?: unknown };

type RpcResult = Record<string, unknown>;
type JsonSchema = {
  type?: string;
  properties?: Record<string, JsonSchema>;
  required?: string[];
  items?: JsonSchema;
  anyOf?: JsonSchema[];
  oneOf?: JsonSchema[];
  [key: string]: unknown;
};

class AppServerRpcError extends Error {
  constructor(public readonly rpcError: RpcError) {
    super(rpcError.message ?? "Codex app server RPC request failed.");
    this.name = "AppServerRpcError";
  }
}

export class CodexAppServerClient {
  private readonly pending = new Map<
    number,
    { resolve: (value: unknown) => void; reject: (error: Error) => void }
  >();
  private readonly handlers: NotificationHandler[] = [];
  private nextRequestId = 0;

  constructor(private readonly ws: WebSocket) {
    ws.onmessage = (event) => {
      let message: Record<string, unknown>;
      try {
        message = JSON.parse(event.data as string) as Record<string, unknown>;
      } catch {
        return;
      }

      if (typeof message.id === "number") {
        const handler = this.pending.get(message.id);
        if (!handler) return;

        this.pending.delete(message.id);
        if (message.error) {
          handler.reject(new AppServerRpcError(message.error as RpcError));
        } else {
          handler.resolve(message.result);
        }
        return;
      }

      if (typeof message.method === "string") {
        const notification = {
          method: message.method,
          params: message.params,
        };
        for (const handler of this.handlers) {
          handler(notification);
        }
      }
    };
  }

  onNotification(handler: NotificationHandler): () => void {
    this.handlers.push(handler);
    return () => {
      const index = this.handlers.indexOf(handler);
      if (index >= 0) this.handlers.splice(index, 1);
    };
  }

  request<T = unknown>(method: string, params?: unknown): Promise<T> {
    const id = ++this.nextRequestId;
    return new Promise<T>((resolve, reject) => {
      this.pending.set(id, {
        resolve: (value) => resolve(value as T),
        reject,
      });
      try {
        this.ws.send(
          JSON.stringify({
            id,
            method,
            ...(params === undefined ? {} : { params }),
          }),
        );
      } catch (error) {
        this.pending.delete(id);
        reject(error instanceof Error ? error : new Error(String(error)));
      }
    });
  }

  notify(method: string, params?: unknown): void {
    this.ws.send(
      JSON.stringify({
        method,
        ...(params === undefined ? {} : { params }),
      }),
    );
  }

  close(): void {
    this.ws.close();
  }
}

export function getCodexAppServerUrl(): string {
  const configuredUrl = process.env.CODEX_APP_SERVER_URL?.trim();
  if (configuredUrl) return configuredUrl;

  const port = process.env.CODEX_APP_SERVER_PORT ?? "8765";
  return `ws://127.0.0.1:${port}`;
}

export function getCodexAppServerModel(): string {
  return process.env.CODEX_APP_SERVER_MODEL ?? DEFAULT_MODEL;
}

export function connectCodexAppServer(
  url = getCodexAppServerUrl(),
): Promise<CodexAppServerClient> {
  assertCodexAppServerLocalOnly();
  return new Promise((resolve, reject) => {
    let settled = false;
    const ws = new WebSocket(url);
    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      ws.close();
      reject(createConnectionError(url));
    }, CONNECTION_TIMEOUT_MS);

    const fail = () => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      reject(createConnectionError(url));
    };

    ws.onopen = () => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve(new CodexAppServerClient(ws));
    };
    ws.onerror = fail;
    ws.onclose = fail;
  });
}

export async function initializeCodexAppServer(
  client: CodexAppServerClient,
): Promise<void> {
  await client.request("initialize", {
    clientInfo: {
      name: "ruletrade-ai",
      title: "Ruletrade AI",
      version: "1.0.0",
    },
    capabilities: { experimentalApi: false },
  });

  // The protocol requires this notification before any subsequent request.
  client.notify("initialized", {});
}

async function withCodexAppServer<T>(
  operation: (client: CodexAppServerClient) => Promise<T>,
): Promise<T> {
  const client = await connectCodexAppServer();
  try {
    await initializeCodexAppServer(client);
    return await operation(client);
  } finally {
    client.close();
  }
}

export async function readCodexAccount(): Promise<CodexAccountStatus> {
  return withCodexAppServer(async (client) => {
    const response = await client.request<{
      account?: { type?: string; planType?: string } | null;
    }>("account/read", { refreshToken: true });
    const account = response.account;

    return {
      authenticated: Boolean(account?.type),
      authMode: account?.type ?? null,
      planType: account?.planType ?? null,
    };
  });
}

export async function startCodexChatGPTLogin(
  mode: CodexAppServerLoginMode = "browser",
): Promise<CodexChatGPTLogin> {
  return withCodexAppServer(async (client) => {
    if (mode === "device-code") {
      const response = await client.request<{
        type?: string;
        loginId?: string;
        verificationUrl?: string;
        userCode?: string;
      }>("account/login/start", { type: "chatgptDeviceCode" });

      if (!response.loginId || !response.verificationUrl || !response.userCode) {
        throw new AIProviderError(
          "AI_PROVIDER_REQUEST_FAILED",
          "Codex app server がデバイスコードログイン情報を返しませんでした。",
          response,
          false,
        );
      }

      return {
        mode,
        loginId: response.loginId,
        verificationUrl: response.verificationUrl,
        userCode: response.userCode,
      };
    }

    const response = await client.request<{
      type?: string;
      loginId?: string;
      authUrl?: string;
    }>("account/login/start", {
      type: "chatgpt",
      useHostedLoginSuccessPage: true,
      appBrand: "chatgpt",
    });

    if (!response.loginId || !response.authUrl) {
      throw new AIProviderError(
        "AI_PROVIDER_REQUEST_FAILED",
        "Codex app server がChatGPTログインURLを返しませんでした。",
        response,
        false,
      );
    }

    return { mode, loginId: response.loginId, authUrl: response.authUrl };
  });
}

async function startThread(
  client: CodexAppServerClient,
  model: string,
  systemPrompt?: string,
): Promise<string> {
  const response = await client.request<RpcResult>("thread/start", {
    model,
    ephemeral: true,
    sandbox: "read-only",
    approvalPolicy: "never",
    developerInstructions: systemPrompt ?? null,
    serviceName: "ruletrade-ai",
  });
  const threadId =
    response?.thread &&
    typeof response.thread === "object" &&
    "id" in response.thread &&
    typeof response.thread.id === "string"
      ? response.thread.id
      : null;

  if (!threadId) {
    throw new AIProviderError(
      "AI_PROVIDER_REQUEST_FAILED",
      "Codex app server がスレッドIDを返しませんでした。",
      response,
      false,
    );
  }

  return threadId;
}

function runTurn(
  client: CodexAppServerClient,
  threadId: string,
  userText: string,
  timeoutMs: number,
  outputSchema?: unknown,
  taskType?: string,
): Promise<{ text: string }> {
  return new Promise((resolve, reject) => {
    let collected = "";
    let finished = false;

    const finish = (callback: () => void) => {
      if (finished) return;
      finished = true;
      clearTimeout(timer);
      unsubscribe();
      callback();
    };

    const timer = setTimeout(() => {
      finish(() =>
        reject(
          new AIProviderError(
            "AI_PROVIDER_TIMEOUT",
            "Codex app server のターンがタイムアウトしました。",
            undefined,
            true,
          ),
        ),
      );
    }, timeoutMs);

    const unsubscribe = client.onNotification((message) => {
      if (message.method === "item/agentMessage/delta") {
        const params = message.params as { delta?: unknown } | undefined;
        if (typeof params?.delta === "string") collected += params.delta;
        return;
      }

      if (message.method === "turn/completed") {
        const turn = (message.params as { turn?: { status?: string; error?: unknown } } | undefined)
          ?.turn;
        if (turn?.status === "failed") {
          finish(() =>
            reject(
              new AIProviderError(
                "AI_PROVIDER_REQUEST_FAILED",
                "Codex app server のターンが失敗しました。",
                turn.error,
                true,
              ),
            ),
          );
          return;
        }

        finish(() => resolve({ text: collected }));
        return;
      }

      if (message.method === "error") {
        finish(() =>
          reject(
            new AIProviderError(
              "AI_PROVIDER_REQUEST_FAILED",
              "Codex app server がエラーを返しました。",
              message.params,
              true,
            ),
          ),
        );
      }
    });

    const turnParams: Record<string, unknown> = {
      threadId,
      input: [{ type: "text", text: userText }],
      effort: taskType === "rule_draft_generation" ? "low" : CODEX_REASONING_EFFORT,
    };
    if (outputSchema !== undefined) turnParams.outputSchema = outputSchema;

    client.request("turn/start", turnParams).catch((error: unknown) => {
      finish(() => reject(error instanceof Error ? error : new Error(String(error))));
    });
  });
}

function buildUserText(
  messages: Array<{ role: string; content: string | Array<{ type: string; text?: string }> }>,
  schemaName?: string,
): string {
  const parts = messages.map((message) => {
    const content =
      typeof message.content === "string"
        ? message.content
        : message.content
            .map((part) => part.text ?? "[画像入力]")
            .join("\n");
    return `${message.role.toUpperCase()}:\n${content}`;
  });

  if (schemaName) {
    parts.push(`Return only valid JSON matching the ${schemaName} schema.`);
  }

  return parts.join("\n\n");
}

function parseJsonFromText(text: string): unknown {
  const trimmed = text.trim();
  const start = trimmed.indexOf("{");
  const end = trimmed.lastIndexOf("}");
  if (start === -1 || end === -1) {
    throw new AIProviderError(
      "AI_OUTPUT_PARSE_FAILED",
      "Codex の出力にJSONが含まれていませんでした。",
      { rawText: text },
    );
  }

  try {
    return JSON.parse(trimmed.slice(start, end + 1));
  } catch {
    throw new AIProviderError(
      "AI_OUTPUT_PARSE_FAILED",
      "Codex の出力をJSONとして解析できませんでした。",
      { rawText: text },
    );
  }
}

function toCodexOutputSchema(schema: z.ZodType): {
  original: JsonSchema;
  strict: JsonSchema;
} {
  const original = z.toJSONSchema(schema, { target: "draft-7" }) as JsonSchema;
  return { original, strict: makeStrictJsonSchema(original) };
}

function makeStrictJsonSchema(schema: JsonSchema): JsonSchema {
  const transformed: JsonSchema = { ...schema };

  if (schema.properties) {
    const required = new Set(schema.required ?? []);
    transformed.properties = Object.fromEntries(
      Object.entries(schema.properties).map(([key, propertySchema]) => {
        const transformedProperty = makeStrictJsonSchema(propertySchema);
        return [
          key,
          required.has(key)
            ? transformedProperty
            : {
                anyOf: [transformedProperty, { type: "null" }],
              },
        ];
      }),
    );
    transformed.required = Object.keys(schema.properties);
  }

  if (schema.items) {
    transformed.items = makeStrictJsonSchema(schema.items);
  }

  if (schema.anyOf) {
    transformed.anyOf = schema.anyOf.map(makeStrictJsonSchema);
  }

  if (schema.oneOf) {
    transformed.oneOf = schema.oneOf.map(makeStrictJsonSchema);
  }

  return transformed;
}

function restoreOptionalJsonValues(value: unknown, schema: JsonSchema): unknown {
  if (Array.isArray(value) && schema.items) {
    return value.map((item) => restoreOptionalJsonValues(item, schema.items!));
  }

  if (!isJsonRecord(value)) return value;

  if (schema.anyOf) {
    const objectSchema = schema.anyOf.find((candidate) => candidate.type === "object");
    return objectSchema
      ? restoreOptionalJsonValues(value, objectSchema)
      : value;
  }

  if (!schema.properties) return value;

  const required = new Set(schema.required ?? []);
  const restored = { ...value };
  for (const [key, propertySchema] of Object.entries(schema.properties)) {
    if (!(key in restored)) continue;
    if (!required.has(key) && restored[key] === null) {
      delete restored[key];
      continue;
    }
    restored[key] = restoreOptionalJsonValues(restored[key], propertySchema);
  }
  return restored;
}

function isJsonRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function createConnectionError(url: string): AIProviderError {
  return new AIProviderError(
    "AI_PROVIDER_REQUEST_FAILED",
    `Codex app server に接続できません (${url})。先に \`npm run codex:app-server\` を起動してください。`,
    undefined,
    false,
  );
}

function normalizeProviderError(error: unknown): AIProviderError {
  if (error instanceof AIProviderError) return error;
  if (error instanceof AppServerRpcError) {
    return new AIProviderError(
      error.rpcError.code === -32001
        ? "AI_PROVIDER_RATE_LIMITED"
        : "AI_PROVIDER_REQUEST_FAILED",
      error.message,
      error.rpcError,
      error.rpcError.code === -32001 || error.rpcError.code === -32603,
    );
  }

  return new AIProviderError(
    "AI_PROVIDER_REQUEST_FAILED",
    "Codex app server でエラーが発生しました。",
    error,
    true,
  );
}

export class CodexAppServerProvider implements AIProvider {
  private readonly model: string;

  constructor(model?: string) {
    this.model = model ?? getCodexAppServerModel();
  }

  async generateObject<TSchema extends z.ZodType>(
    params: GenerateObjectParams<TSchema>,
  ): Promise<GenerateObjectResult<z.infer<TSchema>>> {
    const startedAt = Date.now();
    const timeoutMs = Math.max(getAITimeoutMs(), MIN_TURN_TIMEOUT_MS);

    try {
      const text = await withCodexAppServer(async (client) => {
        const systemContent = params.messages.find(
          (message) => message.role === "system",
        )?.content;
        const systemPrompt =
          typeof systemContent === "string" ? systemContent : undefined;
        const threadId = await startThread(client, this.model, systemPrompt);
        const outputSchema = toCodexOutputSchema(params.schema);
        const result = await runTurn(
          client,
          threadId,
          buildUserText(params.messages, params.schemaName),
          timeoutMs,
          outputSchema.strict,
          params.taskType,
        );
        return {
          text: result.text,
          originalSchema: outputSchema.original,
        };
      });

      const parsed = params.schema.safeParse(
        restoreOptionalJsonValues(parseJsonFromText(text.text), text.originalSchema),
      );
      if (!parsed.success) {
        throw new AIProviderError(
          "AI_OUTPUT_SCHEMA_INVALID",
          "Codex の出力がスキーマに一致しませんでした。",
          parsed.error.flatten(),
        );
      }

      return {
        data: parsed.data,
        rawText: text.text,
        usage: normalizeAIUsage({}),
        meta: {
          provider: "codex-app-server",
          model: this.model,
          taskType: params.taskType,
          agentName: params.agentName,
          promptVersion: params.promptVersion,
          fallbackUsed: false,
          latencyMs: Date.now() - startedAt,
        },
      };
    } catch (error) {
      throw normalizeProviderError(error);
    }
  }

  async generateText(params: GenerateTextParams): Promise<GenerateTextResult> {
    const startedAt = Date.now();
    const timeoutMs = Math.max(getAITimeoutMs(), MIN_TURN_TIMEOUT_MS);

    try {
      const text = await withCodexAppServer(async (client) => {
        const systemContent = params.messages.find(
          (message) => message.role === "system",
        )?.content;
        const systemPrompt =
          typeof systemContent === "string" ? systemContent : undefined;
        const threadId = await startThread(client, this.model, systemPrompt);
        const result = await runTurn(
          client,
          threadId,
          buildUserText(params.messages),
          timeoutMs,
        );
        return result.text;
      });

      return {
        text,
        usage: normalizeAIUsage({}),
        meta: {
          provider: "codex-app-server",
          model: this.model,
          taskType: params.taskType,
          agentName: params.agentName,
          promptVersion: params.promptVersion,
          fallbackUsed: false,
          latencyMs: Date.now() - startedAt,
        },
      };
    } catch (error) {
      throw normalizeProviderError(error);
    }
  }
}
