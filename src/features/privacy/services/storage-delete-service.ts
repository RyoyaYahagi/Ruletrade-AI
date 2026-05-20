import "server-only";

import { createServerClient } from "@/lib/db/supabase-server";

export async function deleteAllUserStorageObjects(params: { userId: string }) {
  const supabase = await createServerClient();

  const bucket = "documents";
  const prefix = params.userId;

  const { data: folders, error: listError } = await supabase.storage
    .from(bucket)
    .list(prefix, { limit: 1000, offset: 0 });

  if (listError) {
    throw listError;
  }

  const pathsToDelete: string[] = [];

  for (const folder of folders ?? []) {
    const folderPath = `${prefix}/${folder.name}`;
    const { data: files } = await supabase.storage
      .from(bucket)
      .list(folderPath, { limit: 1000, offset: 0 });
    for (const file of files ?? []) {
      pathsToDelete.push(`${folderPath}/${file.name}`);
    }
  }

  if (pathsToDelete.length > 0) {
    const { error: removeError } = await supabase.storage
      .from(bucket)
      .remove(pathsToDelete);
    if (removeError) {
      throw removeError;
    }
  }

  return { deletedCount: pathsToDelete.length };
}
