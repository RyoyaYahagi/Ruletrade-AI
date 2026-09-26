import { NextResponse } from "next/server";

import { createTransaction } from "@/lib/db";
import { transactionInputSchema } from "@/lib/domain";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const input = transactionInputSchema.parse(await request.json());
    const result = createTransaction(input);
    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "売買履歴の保存に失敗しました。",
      },
      { status: 400 },
    );
  }
}
