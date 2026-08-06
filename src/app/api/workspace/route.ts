import { NextResponse } from "next/server";
import type { AppData } from "@/lib/types";
import {
  clearWorkspaceData,
  getWorkspaceData,
  saveWorkspaceData,
} from "@/lib/db/workspace";

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
    const body = (await request.json()) as AppData;
    const data = await saveWorkspaceData(body);
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
