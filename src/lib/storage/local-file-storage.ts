import "server-only";

import fs from "node:fs/promises";
import path from "node:path";

const DEFAULT_BUCKET = "documents";

function getStorageRoot() {
  return process.env.LOCAL_STORAGE_PATH ?? path.join(process.cwd(), "data", "storage");
}

function resolveStoragePath(bucket: string, storagePath: string) {
  const root = path.resolve(getStorageRoot(), bucket);
  const resolved = path.resolve(root, storagePath);
  if (resolved !== root && !resolved.startsWith(`${root}${path.sep}`)) {
    throw new Error("Invalid local storage path");
  }
  return resolved;
}

export async function writeLocalStorageFile(params: {
  bucket?: string;
  storagePath: string;
  data: Buffer;
}) {
  const filePath = resolveStoragePath(
    params.bucket ?? DEFAULT_BUCKET,
    params.storagePath,
  );
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, params.data, { flag: "wx" });
}

export async function readLocalStorageFile(params: {
  bucket?: string;
  storagePath: string;
}) {
  return fs.readFile(
    resolveStoragePath(params.bucket ?? DEFAULT_BUCKET, params.storagePath),
  );
}

export async function removeLocalStorageFiles(params: {
  bucket?: string;
  storagePaths: string[];
}) {
  await Promise.all(
    params.storagePaths.map(async (storagePath) => {
      await fs.rm(
        resolveStoragePath(params.bucket ?? DEFAULT_BUCKET, storagePath),
        { force: true },
      );
    }),
  );
}

export async function removeAllLocalStorageForUser(params: {
  bucket?: string;
  userId: string;
}) {
  const userRoot = resolveStoragePath(params.bucket ?? DEFAULT_BUCKET, params.userId);
  await fs.rm(userRoot, { recursive: true, force: true });
}
