import { requireUser } from "@/lib/auth/require-user";
import { apiSuccess } from "@/lib/api/api-response";
import { AppError } from "@/lib/errors/app-error";
import { toErrorResponse } from "@/lib/errors/to-error-response";
import { extractPortfolioPositionsFromImages } from "@/features/portfolio/services/portfolio-position-import-service";

const MAX_FILE_SIZE = 10 * 1024 * 1024;
const MAX_TOTAL_SIZE = 30 * 1024 * 1024;
const MAX_FILE_COUNT = 10;
const ALLOWED_MIME_TYPES = new Set(["image/png", "image/jpeg", "image/webp"]);

export async function POST(request: Request) {
  const requestId = crypto.randomUUID();
  let userId: string | null = null;

  try {
    const user = await requireUser();
    userId = user.id;

    const formData = await request.formData();
    const values = formData.getAll("files");
    const files = values.length > 0 ? values : formData.getAll("file");

    if (files.length === 0) {
      throw new AppError("VALIDATION_ERROR", "画像を1枚以上選択してください。", 400);
    }
    if (files.length > MAX_FILE_COUNT) {
      throw new AppError(
        "VALIDATION_ERROR",
        `画像は${MAX_FILE_COUNT}枚まで選択できます。`,
        400,
      );
    }

    let totalSize = 0;
    const images = [];
    for (const value of files) {
      if (typeof value === "string" || typeof value.arrayBuffer !== "function") {
        throw new AppError("VALIDATION_ERROR", "画像ファイルを指定してください。", 400);
      }
      if (!ALLOWED_MIME_TYPES.has(value.type)) {
        throw new AppError(
          "VALIDATION_ERROR",
          "対応形式はPNG、JPEG、WebPです。",
          400,
        );
      }
      if (value.size > MAX_FILE_SIZE) {
        throw new AppError("VALIDATION_ERROR", "画像1枚は10MBまでです。", 400);
      }

      totalSize += value.size;
      if (totalSize > MAX_TOTAL_SIZE) {
        throw new AppError("VALIDATION_ERROR", "画像の合計サイズは30MBまでです。", 400);
      }

      images.push({
        fileName: value.name,
        mimeType: value.type,
        data: Buffer.from(await value.arrayBuffer()),
      });
    }

    const result = await extractPortfolioPositionsFromImages({
      userId,
      requestId,
      images,
    });

    return apiSuccess(result);
  } catch (error) {
    return toErrorResponse(error, {
      requestId,
      userId,
      route: "/api/portfolio/positions/import",
      method: "POST",
    });
  }
}
