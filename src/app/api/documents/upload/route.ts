import { requireUser } from "@/lib/auth/require-user";
import { apiCreated } from "@/lib/api/api-response";
import { toErrorResponse } from "@/lib/errors/to-error-response";
import { AppError } from "@/lib/errors/app-error";
import { uploadDocument } from "@/features/documents/services/document-upload-service";

export async function POST(request: Request) {
  const requestId = crypto.randomUUID();
  let userId: string | null = null;

  try {
    const user = await requireUser();
    userId = user.id;

    const formData = await request.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      throw new AppError("VALIDATION_ERROR", "ファイルが必要です。", 400);
    }

    const maxSize = 10 * 1024 * 1024;
    if (file.size > maxSize) {
      throw new AppError(
        "VALIDATION_ERROR",
        "ファイルサイズは10MBまでです。",
        400,
      );
    }

    const allowedMimeTypes = ["application/pdf", "text/plain", "text/markdown"];
    if (!allowedMimeTypes.includes(file.type)) {
      throw new AppError(
        "VALIDATION_ERROR",
        "対応していないファイル形式です。",
        400,
      );
    }

    const buffer = Buffer.from(await file.arrayBuffer());

    const title = (formData.get("title") as string) || file.name;
    const documentType = (formData.get("documentType") as string) || "other";
    const documentKind = ((formData.get("documentKind") as string) || "note") as "note" | "earnings_report";
    const fiscalPeriod = (formData.get("fiscalPeriod") as string) || undefined;
    const ticker = (formData.get("ticker") as string) || undefined;
    const companyName = (formData.get("companyName") as string) || undefined;
    const sourceUrl = (formData.get("sourceUrl") as string) || undefined;

    const result = await uploadDocument({
      userId: user.id,
      file: buffer,
      title,
      originalFilename: file.name,
      mimeType: file.type,
      fileSizeBytes: file.size,
      documentType,
      documentKind,
      fiscalPeriod,
      ticker,
      companyName,
      sourceUrl,
    });

    return apiCreated({
      document: {
        id: result.documentId,
        storagePath: result.storagePath,
      },
    });
  } catch (error) {
    return toErrorResponse(error, {
      requestId,
      userId,
      route: "/api/documents/upload",
      method: "POST",
    });
  }
}
