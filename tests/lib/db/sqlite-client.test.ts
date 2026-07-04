import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it, vi } from "vitest";

describe("createSqliteClient", () => {
  const originalEnv = { ...process.env };
  const tempDirs: string[] = [];

  afterEach(() => {
    process.env = originalEnv;
    vi.resetModules();
    for (const tempDir of tempDirs.splice(0)) {
      fs.rmSync(tempDir, { force: true, recursive: true });
    }
  });

  it("updates tables that do not have updated_at columns", async () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "ruletrade-sqlite-"));
    tempDirs.push(tempDir);
    process.env.SQLITE_DATABASE_PATH = path.join(tempDir, "test.sqlite");

    const { createSqliteClient } = await import("@/lib/db/sqlite-client");
    const client = createSqliteClient();

    const insertResult = await client.from("rule_questions").insert({
      user_id: "user-1",
      session_id: "session-1",
      question_key: "investment_thesis",
      question_text: "この銘柄を買いたい理由は何ですか？",
      question_type: "free_text",
      status: "pending",
      display_order: 1,
    });

    const question = Array.isArray(insertResult.data)
      ? insertResult.data[0]
      : insertResult.data;
    expect(question).toMatchObject({ status: "pending" });

    const updateResult = await client
      .from("rule_questions")
      .update({ status: "answered", answered_at: "2026-07-04T03:21:03.000Z" })
      .eq("id", question?.id)
      .eq("user_id", "user-1");

    expect(updateResult.error).toBeNull();

    const fetchResult = await client
      .from("rule_questions")
      .select("id, status, answered_at")
      .eq("id", question?.id)
      .single();

    expect(fetchResult.data).toMatchObject({
      status: "answered",
      answered_at: "2026-07-04T03:21:03.000Z",
    });
  });
});
