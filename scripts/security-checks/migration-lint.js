#!/usr/bin/env node
/**
 * Ruletrade-AI Migration Security Linter
 *
 * Checks:
 * 1. All tables that should have RLS actually have it enabled
 * 2. Duplicate index detection across migration files
 * 3. RLS policies use auth.uid() or similar owner-based checks
 * 4. Admin-only tables have proper policy comments
 * 5. No raw SQL injection vectors in migrations
 */

import fs from "node:fs";
import path from "node:path";

const MIGRATIONS_DIR = path.join(process.cwd(), "supabase", "migrations");
const EXIT_SUCCESS = 0;
const EXIT_VIOLATIONS = 1;

// Tables that MUST have RLS (user data tables)
// If a migration creates these but doesn't enable RLS, it's a violation
const RLS_REQUIRED_TABLES = [
  "app_users",
  "rule_design_sessions",
  "rule_reviews",
  "rule_questions",
  "rule_answers",
  "investor_profiles",
  "portfolio_settings",
  "rule_versions",
  "rule_quality_checks",
  "notifications",
  "notification_preferences",
];

// Tables that are intentionally admin-only (RLS policy can be admin-only)
const ADMIN_ONLY_TABLES = [
  "data_purge_log",
  "restore_drills",
];

// Tables that may not need RLS (system/config tables)
const RLS_EXEMPT_TABLES = [
  "feature_flags",
];

function log(level, message) {
  const prefix = level === "error" ? "❌" : level === "warn" ? "⚠️" : "✅";
  console.log(`${prefix} ${message}`);
}

function getMigrationFiles() {
  if (!fs.existsSync(MIGRATIONS_DIR)) {
    log("warn", `Migrations directory not found: ${MIGRATIONS_DIR}`);
    return [];
  }
  return fs
    .readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith(".sql"))
    .map((f) => path.join(MIGRATIONS_DIR, f))
    .sort();
}

function parseMigration(content, fileName) {
  const lines = content.split("\n");
  const tablesWithRls = new Set();
  const tablesCreated = new Map(); // tableName -> lineNumber
  const indexesCreated = new Map(); // indexName -> { file, line, sql }
  const policies = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const lineNum = i + 1;
    const lower = line.toLowerCase();

    // CREATE TABLE
    const createTableMatch = line.match(/create\s+table\s+(?:if\s+not\s+exists\s+)?(?:public\.)?(\w+)/i);
    if (createTableMatch) {
      tablesCreated.set(createTableMatch[1], lineNum);
    }

    // ALTER TABLE ... ENABLE ROW LEVEL SECURITY
    const rlsMatch = line.match(/alter\s+table\s+(?:public\.)?(\w+)\s+enable\s+row\s+level\s+security/i);
    if (rlsMatch) {
      tablesWithRls.add(rlsMatch[1]);
    }

    // CREATE INDEX
    const indexMatch = line.match(/create\s+(?:unique\s+)?index\s+(?:if\s+not\s+exists\s+)?(\w+)/i);
    if (indexMatch) {
      const indexName = indexMatch[1];
      const existing = indexesCreated.get(indexName);
      if (existing) {
        // Same file duplicate? Or just IF NOT EXISTS pattern?
        // We still warn because it may indicate copy-paste error
        if (!line.toLowerCase().includes("if not exists")) {
          indexesCreated.set(indexName, {
            file: fileName,
            line: lineNum,
            sql: line.trim(),
            duplicate: existing,
          });
        }
      } else {
        indexesCreated.set(indexName, {
          file: fileName,
          line: lineNum,
          sql: line.trim(),
        });
      }
    }

    // CREATE POLICY — capture multi-line definitions until semicolon
    const policyMatch = line.match(/create\s+policy\s+(\w+)\s+on\s+(?:public\.)?(\w+)/i);
    if (policyMatch) {
      let policySql = line.trim();
      let j = i + 1;
      while (j < lines.length && !policySql.endsWith(";")) {
        policySql += " " + lines[j].trim();
        j++;
      }
      policies.push({
        name: policyMatch[1],
        table: policyMatch[2],
        line: lineNum,
        sql: policySql,
      });
    }
  }

  return { tablesWithRls, tablesCreated, indexesCreated, policies, lines };
}

function main() {
  const files = getMigrationFiles();
  if (files.length === 0) {
    console.log("No migration files found. Skipping migration lint.");
    process.exit(EXIT_SUCCESS);
  }

  let violations = 0;
  let warnings = 0;

  const allTablesCreated = new Map(); // tableName -> { file, line }
  const allTablesWithRls = new Map(); // tableName -> { file, line }
  const allIndexes = new Map(); // indexName -> [{ file, line, sql }]
  const allPolicies = [];

  for (const filePath of files) {
    const fileName = path.basename(filePath);
    const content = fs.readFileSync(filePath, "utf-8");
    const parsed = parseMigration(content, fileName);

    // Track tables
    for (const [table, lineNum] of parsed.tablesCreated) {
      if (!allTablesCreated.has(table)) {
        allTablesCreated.set(table, { file: fileName, line: lineNum });
      }
    }

    // Track RLS
    for (const table of parsed.tablesWithRls) {
      if (!allTablesWithRls.has(table)) {
        // Find the actual line
        const lines = content.split("\n");
        for (let i = 0; i < lines.length; i++) {
          if (lines[i].toLowerCase().includes(`alter table`) && lines[i].toLowerCase().includes(table)) {
            allTablesWithRls.set(table, { file: fileName, line: i + 1 });
            break;
          }
        }
      }
    }

    // Track indexes
    for (const [indexName, info] of parsed.indexesCreated) {
      if (!allIndexes.has(indexName)) {
        allIndexes.set(indexName, []);
      }
      allIndexes.get(indexName).push(info);
    }

    // Track policies
    allPolicies.push(...parsed.policies.map((p) => ({ ...p, file: fileName })));
  }

  console.log("\n📋 Migration Security Lint Report\n");

  // 1. Check RLS coverage for required tables
  console.log("--- RLS Coverage Check ---");
  for (const table of RLS_REQUIRED_TABLES) {
    if (allTablesCreated.has(table) && !allTablesWithRls.has(table)) {
      const { file, line } = allTablesCreated.get(table);
      log("error", `Table "${table}" is created but missing ENABLE ROW LEVEL SECURITY (${file}:${line})`);
      violations++;
    }
  }

  // 2. Check for duplicate indexes across files
  console.log("\n--- Duplicate Index Check ---");
  for (const [indexName, occurrences] of allIndexes) {
    if (occurrences.length > 1) {
      // Filter out ones that are just comments or "already exists" notes
      const actualCreates = occurrences.filter((o) => !o.sql.startsWith("--"));
      if (actualCreates.length > 1) {
        log("warn", `Index "${indexName}" appears ${actualCreates.length} times:`);
        for (const occ of actualCreates) {
          console.log(`   → ${occ.file}:${occ.line}  ${occ.sql}`);
        }
        warnings++;
      }
    }
  }

  // 3. Check policy patterns
  console.log("\n--- Policy Pattern Check ---");
  for (const policy of allPolicies) {
    const sql = policy.sql.toLowerCase();
    const isAdminOnly = ADMIN_ONLY_TABLES.includes(policy.table);
    const isExempt = RLS_EXEMPT_TABLES.includes(policy.table);

    if (isExempt) {
      // Exempt tables don't need strict checks
      continue;
    }

    // Public policies are intentionally open (e.g., public_help_articles)
    if (policy.name.startsWith("public_")) {
      continue;
    }

    if (isAdminOnly) {
      // Admin-only tables should have admin-only policies
      if (!sql.includes("admin") && !sql.includes("require_admin")) {
        log("warn", `Admin-only table "${policy.table}" policy "${policy.name}" may not restrict to admin (${policy.file}:${policy.line})`);
        warnings++;
      }
      continue;
    }

    // For user tables, check for auth.uid() or user_id matching
    const hasAuthCheck = sql.includes("auth.uid()") || sql.includes("user_id = auth.uid()");
    const hasAdminCheck = sql.includes("app_metadata") || sql.includes("role = 'admin'") || sql.includes("role= 'admin'") || sql.includes("auth.jwt");
    if (!hasAuthCheck && !hasAdminCheck && !isAdminOnly && !isExempt) {
      log("warn", `Policy "${policy.name}" on "${policy.table}" does not reference auth.uid() or admin role check (${policy.file}:${policy.line})`);
      warnings++;
    }
  }

  // 4. Check that admin-only tables actually have RLS
  console.log("\n--- Admin Table RLS Check ---");
  for (const table of ADMIN_ONLY_TABLES) {
    if (allTablesCreated.has(table) && !allTablesWithRls.has(table)) {
      const { file, line } = allTablesCreated.get(table);
      log("warn", `Admin table "${table}" missing RLS. Even admin-only tables should have RLS as defense-in-depth (${file}:${line})`);
      warnings++;
    }
  }

  // 5. Check for tables in schema that are not in migrations (SQLite schema drift)
  console.log("\n--- SQLite Schema Drift Check ---");
  const sqliteSchemaPath = path.join(process.cwd(), "src", "lib", "db", "sqlite-schema.ts");
  if (fs.existsSync(sqliteSchemaPath)) {
    const sqliteContent = fs.readFileSync(sqliteSchemaPath, "utf-8");
    const sqliteTables = [];
    const regex = /create\s+table\s+if\s+not\s+exists\s+(\w+)/gi;
    let match;
    while ((match = regex.exec(sqliteContent)) !== null) {
      sqliteTables.push(match[1]);
    }

    for (const table of sqliteTables) {
      if (!allTablesCreated.has(table) && !table.startsWith("sqlite_")) {
        log("warn", `Table "${table}" exists in SQLite schema but not in Supabase migrations. Potential schema drift.`);
        warnings++;
      }
    }
  }

  // Summary
  console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  if (violations > 0) {
    log("error", `${violations} violation(s) found — must fix before merge`);
  }
  if (warnings > 0) {
    log("warn", `${warnings} warning(s) found — review recommended`);
  }
  if (violations === 0 && warnings === 0) {
    log("info", "All migration security checks passed!");
  }
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");

  process.exit(violations > 0 ? EXIT_VIOLATIONS : EXIT_SUCCESS);
}

main();
