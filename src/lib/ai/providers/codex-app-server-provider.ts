import "server-only";

import { zodToJsonSchema } from "zod-to-json-schema";
import type { z } from "zod";
import { AIProviderError } from "@/lib/ai/ai-provider-error";
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

export function getCodexAppServerUrl(): string {
  const port = process.env.CODEX_APP_SERVER_PORT ?? "8765";
  return `ws://127.0.0.1:${port}`;
}

export function getCodexAppServerModel(): string {
  return process.env.CODEX_APP_SERVER_MODEL ?? DEFAULT_MODEL;
}

type Notification = { method: string; params: unknown };
type NotificationHandler = (msg: Notification) => void;

class AppServerClient {
  private ws: WebSocket;
  private pending = new Map<
    number,
    { resolve: (v: unknown) => void; reject: (e: Error) => void }
  >();
  private handlers: NotificationHandler[] = [];
  private idCounter = 0;

  constructor(ws: WebSocket) {
    this.ws = ws;
    ws.onmessage = (ev) => {
      let msg: Record<string, unknown>;
      try {
        msg = JSON.parse(ev.data as string) as Record<string, unknown>;
      } catch {
        return;
      }
      if ("id" in msg) {
        const id = msg.id as number;
        const handler = this.pending.get(id);
        if (handler) {
          this.pending.delete(id);
          if (msg.error) {
            handler.reject(new Error(JSON.stringify(msg.error)));
          } else {
            handler.resolve(msg.result);
          }
        }
      } else if ("method" in msg) {
        for (const fn of this.handlers) {
          fn({ method: msg.method as string, params: msg.params });
        }
      }
    };
  }

  onNotification(fn: NotificationHandler): () => void {
    this.handlers.push(fn);
    return () => {
      this.handlers = this.handlers.filter((h) => h !== fn);
    };
  }

  request(method: string, params: unknown): Promise<unknown> {
    const id = ++this.idCounter;
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.ws.send(JSON.stringify({ id, method, params }));
    });
  }

  close() {
    this.ws.close();
  }
}

function connect(url: string): Promise<AppServerClient> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(
        new AIProviderError(
          "AI_PROVIDER_REQUEST_FAILED",
          `Codex app server に接続できません (${url})。先に \`codex app-server --listen ws://localhost:PORT\` を起動してください。`,
          undefined,
          false,
        ),
      );
    }, 5_000);

    const ws = new WebSocket(url);

    ws.onopen = () => {
      clearTimeout(timer);
      resolve(new AppServerClient(ws));
    };

    ws.onerror = () => {
      clearTimeout(timer);
      reject(
        new AIProviderError(
          "AI_PROVIDER_REQUEST_FAILED",
          `Codex app server に接続できません (${url})。先に \`codex app-server --listen ws://localhost:PORT\` を起動してください。`,
          undefined,
          false,
        ),
      );
    };
  });
}

async function initialize(client: AppServerClient): Promise<void> {
  await client.request("initialize", {
    clientInfo: {
      name: "ruletrade-ai",
      title: "Ruletrade AI",
      version: "1.0.0",
    },
    capabilities: { experimentalApi: false },
  });
}

async function startThread(
  client: AppServerClient,
  model: string,
  systemPrompt?: string,
): Promise<string> {
  return new Promise((resolve, reject) => {
    const unsub = client.onNotification((msg) => {
      if (msg.method === "thread/started") {
        unsub();
        const thread = (msg.params as { thread: { id: string } }).thread;
        resolve(thread.id);
      } else if (msg.method === "error") {
        unsub();
        reject(new Error(JSON.stringify(msg.params)));
      }
    });

    client
      .request("thread/start", {
        model,
        ephemeral: true,
        experimentalRawEvents: false,
        persistExtendedHistory: false,
        developerInstructions: systemPrompt ?? null,
      })
      .catch((e: unknown) => {
        unsub();
        reject(e);
      });
  });
}

function runTurn(
  client: AppServerClient,
  threadId: string,
  userText: string,
  timeoutMs: number,
  outputSchema?: unknown,
): Promise<{ text: string }> {
  return new Promise((resolve, reject) => {
    let collected = "";

    const timer = setTimeout(() => {
      unsub();
      reject(
        new AIProviderError(
          "AI_PROVIDER_TIMEOUT",
          "Codex app server のターンがタイムアウトしました。",
          undefined,
          true,
        ),
      );
    }, timeoutMs);

    const unsub = client.onNotification((msg) => {
      if (msg.method === "item/agentMessage/delta") {
        collected += (msg.params as { delta: string }).delta;
      } else if (msg.method === "turn/completed") {
        clearTimeout(timer);
        unsub();
        const turn = (
          msg.params as {
            turn?: { status?: string; error?: unknown };
          }
        ).turn;
        if (turn?.status === "failed") {
          reject(
            new AIProviderError(
              "AI_PROVIDER_REQUEST_FAILED",
              "Codex app server のターンが失敗しました。",
              turn.error,
              true,
            ),
          );
          return;
        }
        resolve({ text: collected });
      } else if (msg.method === "error") {
        clearTimeout(timer);
        unsub();
        reject(
          new AIProviderError(
            "AI_PROVIDER_REQUEST_FAILED",
            "Codex app server がエラーを返しました。",
            msg.params,
            true,
          ),
        );
      }
    });

    const turnParams: Record<string, unknown> = {
      threadId,
      input: [{ type: "text", text: userText, text_elements: [] }],
    };
    if (outputSchema !== undefined) {
      turnParams.outputSchema = outputSchema;
    }

    client.request("turn/start", turnParams).catch((e: unknown) => {
      clearTimeout(timer);
      unsub();
      reject(e);
    });
  });
}

function buildUserText(
  messages: Array<{ role: string; content: string }>,
  schemaName?: string,
): string {
  const parts = messages
    .filter((m) => m.role !== "system")
    .map((m) => `${m.role.toUpperCase()}:\n${m.content}`);

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

export class CodexAppServerProvider implements AIProvider {
  private wsUrl: string;
  private model: string;

  constructor() {
    this.wsUrl = getCodexAppServerUrl();
    this.model = getCodexAppServerModel();
  }

  async generateObject<TSchema extends z.ZodType>(
    params: GenerateObjectParams<TSchema>,
  ): Promise<GenerateObjectResult<z.infer<TSchema>>> {
    const startedAt = Date.now();
    const timeoutMs = getAITimeoutMs();
    let client: AppServerClient | null = null;

    try {
      client = await connect(this.wsUrl);
      await initialize(client);

      const systemPrompt = params.messages.find(
        (m) => m.role === "system",
      )?.content;
      const threadId = await startThread(client, this.model, systemPrompt);
      const userText = buildUserText(params.messages, params.schemaName);
      const outputSchema = zodToJsonSchema(
        params.schema as unknown as Parameters<typeof zodToJsonSchema>[0],
        params.schemaName,
      );

      const { text } = await runTurn(
        client,
        threadId,
        userText,
        timeoutMs,
        outputSchema,
      );

      const parsedJson = parseJsonFromText(text);
      const validated = params.schema.safeParse(parsedJson);

      if (!validated.success) {
        throw new AIProviderError(
          "AI_OUTPUT_SCHEMA_INVALID",
          "Codex の出力がスキーマに一致しませんでした。",
          validated.error.flatten(),
        );
      }

      return {
        data: validated.data,
        rawText: text,
        usage: normalizeAIUsage({}),
        meta: {
          provider: "codex-app-server",
          model: this.model,
          taskType: params.taskType,
          promptVersion: params.promptVersion,
          fallbackUsed: false,
          latencyMs: Date.now() - startedAt,
        },
      };
    } catch (error) {
      if (error instanceof AIProviderError) throw error;
      throw new AIProviderError(
        "AI_PROVIDER_REQUEST_FAILED",
        "Codex app server でエラーが発生しました。",
        error,
        true,
      );
    } finally {
      client?.close();
    }
  }

  async generateText(params: GenerateTextParams): Promise<GenerateTextResult> {
    const startedAt = Date.now();
    const timeoutMs = getAITimeoutMs();
    let client: AppServerClient | null = null;

    try {
      client = await connect(this.wsUrl);
      await initialize(client);

      const systemPrompt = params.messages.find(
        (m) => m.role === "system",
      )?.content;
      const threadId = await startThread(client, this.model, systemPrompt);
      const userText = buildUserText(params.messages);

      const { text } = await runTurn(client, threadId, userText, timeoutMs);

      return {
        text,
        usage: normalizeAIUsage({}),
        meta: {
          provider: "codex-app-server",
          model: this.model,
          taskType: params.taskType,
          promptVersion: params.promptVersion,
          fallbackUsed: false,
          latencyMs: Date.now() - startedAt,
        },
      };
    } catch (error) {
      if (error instanceof AIProviderError) throw error;
      throw new AIProviderError(
        "AI_PROVIDER_REQUEST_FAILED",
        "Codex app server でエラーが発生しました。",
        error,
        true,
      );
    } finally {
      client?.close();
    }
  }
}
