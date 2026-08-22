import { NextResponse } from "next/server";
import {
  createWorkspace,
  listWorkspaces,
  type WorkspaceModule,
} from "@/lib/db/workspace";

export const runtime = "nodejs";

function parseModule(value: string | null): WorkspaceModule | null {
  if (
    value === "invest" ||
    value === "batches" ||
    value === "batches_wholesale"
  ) {
    return value;
  }
  return null;
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const module = parseModule(searchParams.get("module"));
    if (!module) {
      return NextResponse.json(
        {
          error:
            "Query param module=invest|batches|batches_wholesale required",
        },
        { status: 400 },
      );
    }
    const items = await listWorkspaces(module);
    return NextResponse.json(items);
  } catch (error) {
    console.error("GET /api/workspaces failed", error);
    return NextResponse.json(
      { error: "Failed to list workspaces" },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { name?: unknown; module?: unknown };
    const module = parseModule(
      typeof body.module === "string" ? body.module : null,
    );
    if (!module) {
      return NextResponse.json(
        { error: "module must be invest, batches or batches_wholesale" },
        { status: 400 },
      );
    }
    const name = typeof body.name === "string" ? body.name : "";
    const created = await createWorkspace(name, module);
    return NextResponse.json(created, { status: 201 });
  } catch (error) {
    console.error("POST /api/workspaces failed", error);
    return NextResponse.json(
      { error: "Failed to create workspace" },
      { status: 500 },
    );
  }
}
