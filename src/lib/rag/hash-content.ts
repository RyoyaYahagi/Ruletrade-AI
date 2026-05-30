import { createHash } from "crypto";

export function hashContent(value: string) {
  return createHash("sha256").update(value).digest("hex");
}
