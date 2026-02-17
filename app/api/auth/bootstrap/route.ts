import { NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { getUserWorkspaceId } from "@/lib/workspace";

export async function POST() {
  const user = await getAuthenticatedUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Cliente admin (server-side)
  const admin = createAdminClient();

  try {
    // Workspace único compartido
    const workspaceId = await getUserWorkspaceId();

    return NextResponse.json({
      workspaceId,
      workspaceName: "Harbiz Prospecting",
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to bootstrap workspace",
      },
      { status: 500 }
    );
  }
}
