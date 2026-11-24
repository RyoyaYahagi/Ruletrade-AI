import { parseArgs } from "node:util";

import {
  issueApiKey,
  listApiKeys,
  revokeApiKey,
} from "@/features/integration/api-keys";
import { openDb } from "@/lib/db/connection";

const usage = `使い方:
  npm run integration:keys -- issue --scope read|write [--days 90]
  npm run integration:keys -- list
  npm run integration:keys -- revoke <grant-id>`;

type Command =
  | { action: "issue"; scope: "read" | "write"; days?: number }
  | { action: "list" }
  | { action: "revoke"; grantId: string };

function parseCommand([action, ...args]: string[]): Command | undefined {
  if (action === "list" && args.length === 0) return { action };
  if (
    action === "revoke" &&
    args.length === 1 &&
    /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(args[0])
  ) {
    return { action, grantId: args[0].toLowerCase() };
  }
  if (action === "issue") {
    const {
      values: { scope, days },
    } = parseArgs({
      args,
      options: { scope: { type: "string" }, days: { type: "string" } },
    });
    if (
      (scope === "read" || scope === "write") &&
      (days === undefined || /^\d+$/.test(days))
    ) {
      return {
        action,
        scope,
        days: days === undefined ? undefined : Number(days),
      };
    }
  }
}

function main() {
  let command: Command | undefined;
  try {
    command = parseCommand(process.argv.slice(2));
  } catch {
    // Argument errors can contain values supplied by the caller.
  }
  if (!command) {
    console.error(usage);
    return 1;
  }

  try {
    process.loadEnvFile(".env.local");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
  }

  const db = openDb();
  try {
    switch (command.action) {
      case "issue":
        process.stdout.write(
          issueApiKey(db, command.scope, command.days) + "\n",
        );
        return 0;
      case "list":
        console.log(JSON.stringify(listApiKeys(db), null, 2));
        return 0;
      case "revoke":
        if (revokeApiKey(db, command.grantId)) return 0;
        console.error("指定された API キーの許可が見つかりません。");
        return 1;
    }
  } finally {
    db.$client.close();
  }
}

try {
  process.exitCode = main();
} catch {
  console.error(
    "API キーの操作に失敗しました。DB の設定と有効期間を確認してください。",
  );
  process.exitCode = 1;
}
