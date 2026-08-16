import { NextResponse } from "next/server";

export const runtime = "nodejs";

/**
 * Legacy single-workspace API — absichtlich deaktiviert.
 * Jedes Produkt/Projekt hat eine eigene DB-Zeile unter /api/workspaces/[id].
 */
export async function GET() {
  return NextResponse.json(
    {
      error:
        "Shared workspace API removed. Use /api/workspaces?module=… and /api/workspaces/[id].",
    },
    { status: 410 },
  );
}

export async function PUT() {
  return GET();
}

export async function DELETE() {
  return GET();
}
