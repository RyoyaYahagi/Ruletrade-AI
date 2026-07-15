import "server-only";

import { removeAllLocalStorageForUser } from "@/lib/storage/local-file-storage";

export async function deleteAllUserStorageObjects(params: { userId: string }) {
  await removeAllLocalStorageForUser({
    bucket: "documents",
    userId: params.userId,
  });

  return { deletedCount: 1 };
}
