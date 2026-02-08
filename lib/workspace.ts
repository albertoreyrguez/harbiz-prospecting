// lib/workspace.ts
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";

type WorkspaceRow = {
  id: string;
  name: string;
  owner_id: string;
};

type WorkspaceInsert = {
  name: string;
  owner_id: string;
};

type MemberInsert = {
  workspace_id: string;
  user_id: string;
  role: string;
};

export async function ensureDefaultWorkspace(
  supabase: SupabaseClient<Database>,
  userId: string
): Promise<WorkspaceRow> {
  if (!userId) throw new Error("ensureDefaultWorkspace: userId is required");

  const newWorkspace: WorkspaceInsert = {
    name: "Mi workspace",
    owner_id: userId,
  };

  const { data: ws, error: wsError } = await (supabase as any)
    .from("workspaces")
    .upsert(newWorkspace, { onConflict: "owner_id" })
    .select("id,name,owner_id")
    .single();

  if (wsError) throw wsError;
  if (!ws) throw new Error("Failed to create or fetch workspace");

  const newMember: MemberInsert = {
    workspace_id: ws.id,
    user_id: userId,
    role: "owner",
  };

  const { error: memberError } = await (supabase as any)
    .from("workspace_members")
    .upsert(newMember, { onConflict: "workspace_id,user_id" });

  if (memberError) throw memberError;

  return ws as WorkspaceRow;
}

export async function getUserWorkspace(
  supabase: SupabaseClient<Database>,
  userId: string
) {
  const ws: WorkspaceRow = await ensureDefaultWorkspace(supabase, userId);

  return {
    workspaceId: ws.id,
    workspaceName: ws.name,
    ownerId: ws.owner_id,
  };
}

export async function getUserWorkspaceId(
  supabase: SupabaseClient<Database>,
  userId: string
) {
  const ws = await getUserWorkspace(supabase, userId);
  return ws.workspaceId;
}
