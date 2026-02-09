// lib/workspace.ts
import type { SupabaseClient } from "@supabase/supabase-js";

type WorkspaceMemberRow = {
  workspace_id: string;
  user_id: string;
  role: "owner" | "admin" | "member";
};

// Workspace único (hardcoded, fuente de verdad)
export const SINGLE_WORKSPACE_ID =
  "b6efb6c9-3522-4a1d-9226-d97dd3d5faca";

/**
 * ✅ FUNCIÓN CLAVE (NUEVA)
 * Devuelve SIEMPRE el mismo workspace_id.
 * NO recibe parámetros.
 * Se usa para TODAS las queries nuevas.
 */
export async function getUserWorkspaceId(): Promise<string> {
  return SINGLE_WORKSPACE_ID;
}

// -------------------------------------------------------
// Legacy / fallback (mantiene tu lógica anterior por si
// algún endpoint viejo la usa todavía).
// -------------------------------------------------------
function getDefaultWorkspaceId() {
  // Server-side (Vercel + local). No lo pongas como NEXT_PUBLIC.
  return (process.env.DEFAULT_WORKSPACE_ID ?? "").trim() || null;
}

async function ensureMember(
  admin: SupabaseClient,
  workspaceId: string,
  userId: string
) {
  // Si ya existe, no hacemos nada. Si no existe, lo insertamos como member.
  const { data: existing, error: existingErr } = await admin
    .from("workspace_members")
    .select("workspace_id,user_id,role")
    .eq("workspace_id", workspaceId)
    .eq("user_id", userId)
    .maybeSingle();

  if (existingErr) throw existingErr;

  if (!existing) {
    const { error: insertErr } = await admin
      .from("workspace_members")
      .insert({
        workspace_id: workspaceId,
        user_id: userId,
        role: "member",
      } satisfies WorkspaceMemberRow);

    // si por carrera ya lo insertó otro proceso, lo ignoramos
    if (insertErr && (insertErr as any).code !== "23505") throw insertErr;
  }
}

/**
 * ✅ FUNCIÓN LEGACY (tu implementación anterior)
 * Mantiene membership/validaciones por si algún endpoint la sigue usando.
 * NO la uses en el código nuevo (usa getUserWorkspaceId() sin params).
 */
export async function getUserWorkspaceIdLegacy(
  admin: SupabaseClient,
  userId: string
) {
  const forcedWorkspaceId = getDefaultWorkspaceId();

  // ✅ MODO “UN SOLO WORKSPACE PARA TODOS” (por env var)
  if (forcedWorkspaceId) {
    // (opcional) verifica que el workspace exista
    const { data: ws, error: wsErr } = await admin
      .from("workspaces")
      .select("id")
      .eq("id", forcedWorkspaceId)
      .maybeSingle();

    if (wsErr) throw wsErr;
    if (!ws) {
      throw new Error(
        `DEFAULT_WORKSPACE_ID (${forcedWorkspaceId}) no existe en public.workspaces`
      );
    }

    // Asegura membership (para no romper si activas RLS en el futuro)
    await ensureMember(admin, forcedWorkspaceId, userId);

    return forcedWorkspaceId;
  }

  // -------------------------
  // Fallback (por si no defines env var)
  // -------------------------
  const { data: memberships, error: membershipsError } = await admin
    .from("workspace_members")
    .select("workspace_id,created_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: true });

  if (membershipsError) throw membershipsError;

  const first = memberships?.[0]?.workspace_id;
  if (first) return first;

  // Si no hay membership, crea workspace + membership owner
  const { data: workspace, error: workspaceError } = await admin
    .from("workspaces")
    .insert({ name: "Default workspace" })
    .select("id")
    .single();

  if (workspaceError || !workspace) {
    throw new Error(workspaceError?.message ?? "Failed to create workspace");
  }

  const { error: memberError } = await admin.from("workspace_members").insert({
    workspace_id: workspace.id,
    user_id: userId,
    role: "owner",
  } satisfies WorkspaceMemberRow);

  if (memberError) throw new Error(memberError.message);

  return workspace.id;
}

/**
 * Compat: algunos sitios aún importan getUserWorkspace (viejo).
 * Lo mantenemos para no romper login/bootstrap.
 */
export async function getUserWorkspace(admin: any, userId: string) {
  const id = await getUserWorkspaceIdLegacy(admin, userId);
  return { id, workspaceName: "Harbiz Prospecting" };
}
