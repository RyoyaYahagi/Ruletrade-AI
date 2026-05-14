import { AppError } from "@/lib/errors/app-error";
import { requireUser } from "@/lib/auth/require-user";

export async function GET() {
  try {
    const user = await requireUser();

    return Response.json({
      ok: true,
      data: {
        id: user.id,
        email: user.email,
      },
    });
  } catch (error) {
    if (error instanceof AppError) {
      return Response.json(
        {
          ok: false,
          error: {
            code: error.code,
            message: error.message,
          },
        },
        { status: error.status }
      );
    }

    return Response.json(
      {
        ok: false,
        error: {
          code: "INTERNAL_SERVER_ERROR",
          message: "認証状態を確認できませんでした。",
        },
      },
      { status: 500 }
    );
  }
}
