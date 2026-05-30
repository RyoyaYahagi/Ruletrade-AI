import { NextRequest, NextResponse } from "next/server";

import { requireUser } from "@/lib/auth/require-user";
import {
  deleteInvestmentMemory,
  getInvestmentMemory,
  upsertInvestmentMemory,
} from "@/features/trading/services/investment-memory-service";
import { UpsertInvestmentMemoryRequestSchema } from "@/schemas/trading/investment-memory-schema";

// ──────────────────────────────────────────────
// GET /api/investment-memory
// ──────────────────────────────────────────────

/**
 * Get the current user's investment memory.
 *
 * Returns the user's stored investment preferences, or 404 if none exists.
 */
export async function GET() {
  const user = await requireUser();

  try {
    const { data } = await getInvestmentMemory(user.id);

    if (!data) {
      return NextResponse.json(
        { error: "Investment memory not found" },
        { status: 404 },
      );
    }

    return NextResponse.json({ data });
  } catch (err) {
    console.error("GET /api/investment-memory failed:", err);
    return NextResponse.json(
      { error: "Failed to fetch investment memory" },
      { status: 500 },
    );
  }
}

// ──────────────────────────────────────────────
// POST /api/investment-memory
// ──────────────────────────────────────────────

/**
 * Create or update the current user's investment memory.
 *
 * Accepts a JSON body matching `UpsertInvestmentMemoryRequestSchema`.
 * If the user already has a record, it is updated; otherwise a new one is created.
 */
export async function POST(request: NextRequest) {
  const user = await requireUser();

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parseResult = UpsertInvestmentMemoryRequestSchema.safeParse(body);
  if (!parseResult.success) {
    return NextResponse.json(
      { error: "Validation failed", details: parseResult.error.format() },
      { status: 400 },
    );
  }

  try {
    const { data } = await upsertInvestmentMemory({
      user_id: user.id,
      risk_tolerance: parseResult.data.riskTolerance,
      preferred_markets: parseResult.data.preferredMarkets,
      time_horizons: parseResult.data.timeHorizons,
      rejected_patterns: parseResult.data.rejectedPatterns,
      standing_constraints: parseResult.data.standingConstraints,
      notes: parseResult.data.notes,
    });

    return NextResponse.json({ data });
  } catch (err) {
    console.error("POST /api/investment-memory failed:", err);
    return NextResponse.json(
      { error: "Failed to upsert investment memory" },
      { status: 500 },
    );
  }
}

// ──────────────────────────────────────────────
// DELETE /api/investment-memory
// ──────────────────────────────────────────────

/**
 * Delete the current user's investment memory.
 *
 * Returns 204 on success, or 404 if no record exists.
 */
export async function DELETE() {
  const user = await requireUser();

  try {
    await deleteInvestmentMemory(user.id);
    return new NextResponse(null, { status: 204 });
  } catch (err) {
    console.error("DELETE /api/investment-memory failed:", err);
    return NextResponse.json(
      { error: "Failed to delete investment memory" },
      { status: 500 },
    );
  }
}
