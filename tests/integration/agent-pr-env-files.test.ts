import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

import { expect, it } from "vitest";

const cwd = fileURLToPath(new URL("../../", import.meta.url));

function checkIgnore(path: string) {
  return spawnSync("git", ["check-ignore", "--no-index", "--", path], {
    cwd,
    encoding: "utf8",
  });
}

function checkAgentPr(...paths: string[]) {
  return spawnSync("bash", ["scripts/check-agent-pr-env-files.sh"], {
    cwd,
    encoding: "utf8",
    input: paths.join("\0") + "\0",
  });
}

it.each([".env.local", ".env.production", ".env.development"])(
  "ignores %s locally and rejects it in agent PRs",
  (filename) => {
    expect(checkIgnore(filename).status).toBe(0);
    expect(checkAgentPr(filename).status).toBe(1);
    expect(checkAgentPr("nested folder/" + filename).status).toBe(1);
  },
);

it("allows checked-in environment examples through both checks", () => {
  expect(checkIgnore(".env.example").status).toBe(1);
  expect(checkAgentPr(".env.example", "docs/.env.production.md").status).toBe(
    0,
  );
});
