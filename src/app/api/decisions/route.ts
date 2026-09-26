import { NextResponse } from "next/server";

import { createDecision } from "@/lib/db";
import { decisionInputSchema } from "@/lib/domain";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const input = decisionInputSchema.parse(await request.json());
    const result = createDecision(input);
    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "判断の保存に失敗しました。",
      },
      { status: 400 },
    );
  }
}
