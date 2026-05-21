import fs from "node:fs";
import path from "node:path";

const databasePath = path.resolve(
  process.cwd(),
  ".data",
  path.basename(process.env.SQLITE_DATABASE_FILENAME ?? "ruletrade-mvp.sqlite"),
);

for (const filePath of [
  databasePath,
  `${databasePath}-shm`,
  `${databasePath}-wal`,
]) {
  if (fs.existsSync(filePath)) {
    fs.rmSync(filePath);
    console.log(`Removed ${filePath}`);
  }
}

console.log("SQLite database reset complete.");
