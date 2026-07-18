import { afterEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { CodexAppServerProvider } from "@/lib/ai/providers/codex-app-server-provider";

type FakeMessage = {
  id?: number;
  method?: string;
  params?: Record<string, unknown>;
};

class FakeWebSocket {
  static sentMessages: FakeMessage[] = [];

  onopen: (() => void) | null = null;
  onerror: (() => void) | null = null;
  onclose: (() => void) | null = null;
  onmessage: ((event: MessageEvent) => void) | null = null;

  constructor() {
    queueMicrotask(() => this.onopen?.());
  }

  send(rawMessage: string) {
    const message = JSON.parse(rawMessage) as FakeMessage;
    FakeWebSocket.sentMessages.push(message);

    if (message.method === "initialize") {
      this.emit({ id: message.id, result: {} });
      return;
    }

    if (message.method === "thread/start") {
      this.emit({ id: message.id, result: { thread: { id: "thread-1" } } });
      return;
    }

    if (message.method === "turn/start") {
      this.emit({ id: message.id, result: { turn: { id: "turn-1" } } });
      queueMicrotask(() => {
        this.emit({
          method: "item/agentMessage/delta",
          params: { delta: '{"answer":"ok"}' },
        });
        this.emit({
          method: "turn/completed",
          params: { turn: { status: "completed" } },
        });
      });
    }
  }

  close() {
    this.onclose?.();
  }

  private emit(message: FakeMessage) {
    this.onmessage?.({ data: JSON.stringify(message) } as MessageEvent);
  }
}

describe("CodexAppServerProvider", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
    FakeWebSocket.sentMessages = [];
  });

  it("App Serverの現在のJSON-RPC手順で構造化出力を返す", async () => {
    vi.stubGlobal("WebSocket", FakeWebSocket);
    vi.stubEnv("CODEX_APP_SERVER_MODEL", "gpt-5.4-mini");
    vi.stubEnv("AI_TIMEOUT_MS", "1000");

    const result = await new CodexAppServerProvider().generateObject({
      taskType: "eval_judge",
      schema: z.object({ answer: z.string() }),
      schemaName: "Answer",
      messages: [
        { role: "system", content: "You are concise." },
        { role: "user", content: "Return the answer." },
      ],
    });

    expect(result.data).toEqual({ answer: "ok" });
    expect(result.meta.provider).toBe("codex-app-server");
    expect(result.meta.model).toBe("gpt-5.4-mini");

    expect(FakeWebSocket.sentMessages.map((message) => message.method)).toEqual([
      "initialize",
      "initialized",
      "thread/start",
      "turn/start",
    ]);
    expect(FakeWebSocket.sentMessages[2]?.params).toMatchObject({
      model: "gpt-5.4-mini",
      sandbox: "read-only",
      approvalPolicy: "never",
      ephemeral: true,
    });
    expect(FakeWebSocket.sentMessages[3]?.params).toMatchObject({
      threadId: "thread-1",
      input: [{ type: "text" }],
      effort: "medium",
    });
    expect(FakeWebSocket.sentMessages[3]?.params?.outputSchema).toMatchObject({
      type: "object",
      properties: {
        answer: { type: "string" },
      },
      required: ["answer"],
    });
  });

  it("rule_draft_generation は軽量推論を使う", async () => {
    vi.stubGlobal("WebSocket", FakeWebSocket);
    vi.stubEnv("CODEX_APP_SERVER_MODEL", "gpt-5.4-mini");
    vi.stubEnv("AI_TIMEOUT_MS", "1000");

    await new CodexAppServerProvider().generateObject({
      taskType: "rule_draft_generation",
      schema: z.object({ answer: z.string() }),
      schemaName: "Answer",
      messages: [{ role: "user", content: "Return the answer." }],
    });

    expect(FakeWebSocket.sentMessages[3]?.params).toMatchObject({
      effort: "low",
    });
  });
});
