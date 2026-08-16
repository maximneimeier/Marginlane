import { NextResponse } from "next/server";
import {
  clearWorkspaceData,
  deleteWorkspace,
  getWorkspace,
  renameWorkspace,
  saveWorkspaceData,
} from "@/lib/db/workspace";
import { parseAndValidateAppData } from "@/lib/validateAppData";

export const runtime = "nodejs";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_request: Request, context: RouteContext) {
  try {
    const { id } = await context.params;
    const workspace = await getWorkspace(id);
    if (!workspace) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    return NextResponse.json(workspace);
  } catch (error) {
    console.error("GET /api/workspaces/[id] failed", error);
    return NextResponse.json(
      { error: "Failed to load workspace" },
      { status: 500 },
    );
  }
}

export async function PUT(request: Request, context: RouteContext) {
  try {
    const { id } = await context.params;
    const existing = await getWorkspace(id);
    if (!existing) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const body: unknown = await request.json();

    // Rename-only patch: { name: string }
    if (
      body &&
      typeof body === "object" &&
      "name" in body &&
      !("suppliers" in body) &&
      !("companySettings" in body)
    ) {
      const name = (body as { name?: unknown }).name;
      if (typeof name !== "string") {
        return NextResponse.json({ error: "Invalid name" }, { status: 400 });
      }
      const meta = await renameWorkspace(id, name);
      if (!meta) {
        return NextResponse.json({ error: "Rename failed" }, { status: 400 });
      }
      return NextResponse.json(meta);
    }

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
    const data = await saveWorkspaceData(id, parsed.data);
    return NextResponse.json(data);
  } catch (error) {
    console.error("PUT /api/workspaces/[id] failed", error);
    return NextResponse.json(
      { error: "Failed to save workspace" },
      { status: 500 },
    );
  }
}

export async function DELETE(request: Request, context: RouteContext) {
  try {
    const { id } = await context.params;
    const { searchParams } = new URL(request.url);
    const mode = searchParams.get("mode");

    if (mode === "clear") {
      const data = await clearWorkspaceData(id);
      if (!data) {
        return NextResponse.json({ error: "Not found" }, { status: 404 });
      }
      return NextResponse.json(data);
    }

    const ok = await deleteWorkspace(id);
    if (!ok) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("DELETE /api/workspaces/[id] failed", error);
    return NextResponse.json(
      { error: "Failed to delete workspace" },
      { status: 500 },
    );
  }
}
