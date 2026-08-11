import { NextResponse } from "next/server";
import {
  clearWorkspaceData,
  getWorkspaceData,
  saveWorkspaceData,
} from "@/lib/db/workspace";
import { parseAndValidateAppData } from "@/lib/validateAppData";

export const runtime = "nodejs";

export async function GET() {
  try {
    const data = await getWorkspaceData();
    return NextResponse.json(data);
  } catch (error) {
    console.error("GET /api/workspace failed", error);
    return NextResponse.json(
      { error: "Failed to load workspace" },
      { status: 500 },
    );
  }
}

export async function PUT(request: Request) {
  try {
    const body: unknown = await request.json();
    const parsed = parseAndValidateAppData(body);
    if (!parsed.ok) {
      return NextResponse.json(
        {
          error: "Validation failed",
          issues: parsed.issues.slice(0, 50),
          issueCount: parsed.issues.length,
        },
        { status: 400 },
      );
    }
    const data = await saveWorkspaceData(parsed.data);
    return NextResponse.json(data);
  } catch (error) {
    console.error("PUT /api/workspace failed", error);
    return NextResponse.json(
      { error: "Failed to save workspace" },
      { status: 500 },
    );
  }
}

export async function DELETE() {
  try {
    const data = await clearWorkspaceData();
    return NextResponse.json(data);
  } catch (error) {
    console.error("DELETE /api/workspace failed", error);
    return NextResponse.json(
      { error: "Failed to clear workspace" },
      { status: 500 },
    );
  }
}
