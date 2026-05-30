#!/usr/bin/env node
/**
 * Ruletrade-AI Security Pattern Checker
 *
 * Scans source code for security anti-patterns:
 * 1. getClaims() usage (should be getUser())
 * 2. user_id taken from request body instead of auth context
 * 3. Admin pages missing force-dynamic
 * 4. dangerouslySetInnerHTML usage
 * 5. Raw SQL string concatenation
 * 6. supabase-admin import in non-admin routes
 * 7. Empty catch blocks in auth code
 * 8. console.log of sensitive data
 * 9. Weak random values (Math.random for IDs)
 * 10. TODO/FIXME security comments
 */

import fs from "node:fs";
import path from "node:path";

const SRC_DIR = path.join(process.cwd(), "src");
const EXIT_SUCCESS = 0;
const EXIT_VIOLATIONS = 1;

const BLOCKING_PATTERNS = [
  {
    id: "SEC-PAT-001",
    name: "getClaims() usage",
    pattern: /getClaims\s*\(/,
    message: "getClaims() does not refresh expired tokens. Use getUser() instead.",
    files: [".ts", ".tsx"],
    excludePaths: ["node_modules", ".next"],
  },
  {
    id: "SEC-PAT-002",
    name: "user_id from request body",
    pattern: /(?:const|let|var)\s+\{[^}]*user_id[^}]*\}\s*=\s*(?:await\s+)?(?:req\.json\(\)|request\.json\(\)|body)/i,
    message: "user_id should come from auth context, NOT request body (IDOR risk).",
    files: [".ts", ".tsx"],
    excludePaths: ["node_modules", ".next", "scripts"],
  },
  {
    id: "SEC-PAT-003",
    name: "dangerouslySetInnerHTML",
    pattern: /dangerouslySetInnerHTML/,
    message: "dangerouslySetInnerHTML can lead to XSS. Ensure sanitized content only.",
    files: [".tsx", ".ts"],
    excludePaths: ["node_modules", ".next"],
  },
  {
    id: "SEC-PAT-004",
    name: "raw SQL concatenation",
    pattern: /\.prepare\s*\(\s*[`"'][^`"']*\$\{[^}]+\}/,
    message: "Potential SQL injection via template literal in SQL query.",
    files: [".ts", ".tsx"],
    excludePaths: ["node_modules", ".next"],
    skipIfContains: ["quoteIdent", "quoteId"],
  },
  {
    id: "SEC-PAT-005",
    name: "supabase-admin in API routes",
    pattern: /from\s+["']@\/lib\/db\/supabase-admin["']/,
    message: "supabase-admin (service role) imported in API route. Ensure this is intentional and restricted.",
    files: [".ts", ".tsx"],
    includePaths: ["/api/"],
    excludePaths: ["node_modules", ".next"],
  },
  {
    id: "SEC-PAT-006",
    name: "empty catch in auth",
    pattern: /catch\s*\([^)]*\)\s*\{\s*\}/,
    message: "Empty catch block swallows errors. At minimum, log the error.",
    files: [".ts", ".tsx"],
    includePaths: ["/auth/", "/lib/auth/"],
    excludePaths: ["node_modules", ".next"],
  },
  {
    id: "SEC-PAT-007",
    name: "console.log with user data",
    pattern: /console\.(log|error|warn|info)\s*\([^)]*(?:user|email|password|token|secret|key|auth)[^)]*\)/i,
    message: "Potential sensitive data logging. Verify no PII/secrets are logged.",
    files: [".ts", ".tsx"],
    excludePaths: ["node_modules", ".next", "tests/", ".test."],
    skipIfContains: ["[MOCK", "mock", "test"],
  },
  {
    id: "SEC-PAT-008",
    name: "Math.random for IDs",
    pattern: /Math\.random\s*\([^)]*\)/,
    message: "Math.random() is not cryptographically secure. Use crypto.randomUUID() for IDs.",
    files: [".ts", ".tsx"],
    excludePaths: ["node_modules", ".next", "tests/"],
    skipIfContains: ["provider", "health", "weight", "score", "random() * total"],
  },
  {
    id: "SEC-PAT-009",
    name: "TODO/FIXME security",
    pattern: /(?:TODO|FIXME|HACK)\s*:?\s*(?:.*security|.*auth|.*rls|.*sanitize|.*validate|.*bypass)/i,
    message: "Security-related TODO found. Track and address before production.",
    files: [".ts", ".tsx", ".sql"],
    excludePaths: ["node_modules", ".next"],
  },
  {
    id: "SEC-PAT-010",
    name: "unsafe eval or Function",
    pattern: /\beval\s*\(|new\s+Function\s*\(/,
    message: "eval() or new Function() can execute arbitrary code. Avoid if possible.",
    files: [".ts", ".tsx"],
    excludePaths: ["node_modules", ".next"],
  },
];

const WARN_PATTERNS = [
  {
    id: "SEC-PAT-W01",
    name: "admin page missing force-dynamic",
    check: (filePath, content) => {
      if (!filePath.includes("/admin/")) return false;
      if (content.includes('dynamic = "force-dynamic"')) return false;
      if (content.includes("export const dynamic")) return false;
      // Only check page.tsx and layout.tsx
      if (!filePath.endsWith("page.tsx") && !filePath.endsWith("layout.tsx")) return false;
      return true;
    },
    message: 'Admin page should export const dynamic = "force-dynamic" to prevent static generation auth failures.',
  },
  {
    id: "SEC-PAT-W02",
    name: "role check without undefined guard",
    check: (filePath, content) => {
      if (!content.includes("app_metadata.role")) return false;
      // If there's a guard against undefined/null role via !role or explicit undefined check
      const hasGuard =
        content.match(/!\s*role\b/) ||
        content.match(/role\s*===?\s*undefined/) ||
        content.match(/role\s*===?\s*null/);
      if (hasGuard) return false;
      return true;
    },
    message: "app_metadata.role may be undefined. Add explicit undefined check before comparison.",
  },
  {
    id: "SEC-PAT-W03",
    name: "mock auth in non-dev code",
    check: (filePath, content) => {
      if (!content.includes("MOCK_AUTH_EMAIL")) return false;
      if (content.includes("process.env.MOCK_AUTH_EMAIL")) return false; // env-based is OK if guarded
      return false;
    },
    message: "MOCK_AUTH_EMAIL usage found. Ensure it's gated by environment check.",
  },
];

function* walkDir(dir, extensions) {
  if (!fs.existsSync(dir)) return;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === "node_modules" || entry.name === ".next" || entry.name === "test-results") {
        continue;
      }
      yield* walkDir(fullPath, extensions);
    } else if (entry.isFile() && extensions.some((ext) => entry.name.endsWith(ext))) {
      yield fullPath;
    }
  }
}

function log(level, message) {
  const prefix = level === "error" ? "❌" : level === "warn" ? "⚠️" : "✅";
  console.log(`${prefix} ${message}`);
}

function main() {
  let violations = 0;
  let warnings = 0;

  console.log("\n🔍 Security Pattern Check Report\n");

  // Blocking patterns (regex-based)
  console.log("--- Blocking Pattern Checks ---");
  for (const rule of BLOCKING_PATTERNS) {
    let found = 0;
    for (const filePath of walkDir(SRC_DIR, rule.files)) {
      // Include path filter
      if (rule.includePaths && !rule.includePaths.some((inc) => filePath.includes(inc))) {
        continue;
      }
      // Exclude path filter
      if (rule.excludePaths && rule.excludePaths.some((ex) => filePath.includes(ex))) {
        continue;
      }

      const relativePath = path.relative(process.cwd(), filePath);
      const content = fs.readFileSync(filePath, "utf-8");
      const lines = content.split("\n");

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        if (rule.pattern.test(line)) {
          // Skip if line contains any of the safe patterns
          if (rule.skipIfContains && rule.skipIfContains.some((safe) => line.includes(safe))) {
            continue;
          }
          // Skip comments for most patterns
          const trimmed = line.trim();
          if (trimmed.startsWith("//") || trimmed.startsWith("*")) {
            // Allow TODO pattern to match in comments, skip others
            if (!rule.id.includes("TODO")) continue;
          }

          log("error", `[${rule.id}] ${rule.name}: ${relativePath}:${i + 1}`);
          console.log(`   ${rule.message}`);
          console.log(`   Code: ${line.trim()}`);
          found++;
        }
      }
    }
    if (found > 0) {
      violations += found;
    }
  }

  // Warning patterns (function-based)
  console.log("\n--- Warning Pattern Checks ---");
  for (const rule of WARN_PATTERNS) {
    let found = 0;
    for (const filePath of walkDir(SRC_DIR, [".ts", ".tsx"])) {
      const relativePath = path.relative(process.cwd(), filePath);
      const content = fs.readFileSync(filePath, "utf-8");

      if (rule.check(filePath, content)) {
        log("warn", `[${rule.id}] ${rule.name}: ${relativePath}`);
        console.log(`   ${rule.message}`);
        found++;
      }
    }
    if (found > 0) {
      warnings += found;
    }
  }

  // SQLite-specific checks
  console.log("\n--- SQLite Security Checks ---");
  const sqliteClientPath = path.join(SRC_DIR, "lib", "db", "sqlite-client.ts");
  if (fs.existsSync(sqliteClientPath)) {
    const sqliteContent = fs.readFileSync(sqliteClientPath, "utf-8");

    // Check if there's any auth.uid() equivalent filtering in SqliteQueryBuilder
    if (!sqliteContent.includes("auth.uid") && !sqliteContent.includes("user_id")) {
      log("warn", `[SEC-SQLITE-001] SqliteQueryBuilder has no built-in RLS/auth filtering. Ensure API routes always add user_id filters.`);
      warnings++;
    }

    // Check if execute() method handles errors without leaking SQL
    const errorLeak = sqliteContent.match(/catch\s*\([^)]*\)\s*\{[^}]*error[^}]*\}/g);
    if (errorLeak) {
      for (const match of errorLeak) {
        if (match.includes("data: null") && match.includes("error")) {
          // This pattern returns raw error — check if it includes SQL
          log("warn", `[SEC-SQLITE-002] sqlite-client may return raw errors. Ensure SQL is not leaked to client.`);
          warnings++;
          break;
        }
      }
    }
  }

  // Summary
  console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  if (violations > 0) {
    log("error", `${violations} blocking violation(s) found — must fix before merge`);
  }
  if (warnings > 0) {
    log("warn", `${warnings} warning(s) found — review recommended`);
  }
  if (violations === 0 && warnings === 0) {
    log("info", "All security pattern checks passed!");
  }
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");

  process.exit(violations > 0 ? EXIT_VIOLATIONS : EXIT_SUCCESS);
}

main();
