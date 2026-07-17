import { describe, expect, it } from "vitest";

import { MCP_TOOL_NAMES } from "@/app/api/mcp/[transport]/route";

describe("MCP tool allowlist", () => {
  it("does not expose human-only actions", () => {
    expect(MCP_TOOL_NAMES).toEqual([
      "list_rule_sessions",
      "get_rule_session",
      "get_next_question",
      "answer_question",
      "create_rule_session",
      "get_portfolio",
      "list_watchlist",
      "add_watchlist_item",
      "list_notifications",
      "get_today_items",
      "get_ai_usage_summary",
    ]);
    expect(MCP_TOOL_NAMES).not.toContain("finalize_rule");
    expect(MCP_TOOL_NAMES).not.toContain("resolve_notification");
    expect(MCP_TOOL_NAMES).not.toContain("delete_account");
  });
});
