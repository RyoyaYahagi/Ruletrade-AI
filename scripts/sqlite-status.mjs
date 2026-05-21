import fs from "node:fs";
import path from "node:path";

const databasePath = path.resolve(
  process.cwd(),
  ".data",
  path.basename(process.env.SQLITE_DATABASE_FILENAME ?? "ruletrade-mvp.sqlite"),
);

if (!fs.existsSync(databasePath)) {
  console.log(`SQLite database has not been created yet: ${databasePath}`);
  process.exit(0);
}

const stats = fs.statSync(databasePath);
console.log(`SQLite database: ${databasePath}`);
console.log(`Size: ${stats.size} bytes`);
