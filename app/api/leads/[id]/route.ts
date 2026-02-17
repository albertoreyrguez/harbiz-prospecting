import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/auth";
import { LEAD_STATUSES, LeadStatus } from "@/lib/constants";
import { createAdminClient } from "@/lib/supabase/admin";
import { getUserWorkspaceId } from "@/lib/workspace";

function isLeadStatus(value: string): value is LeadStatus {
  return LEAD_STATUSES.includes(value as LeadStatus);
}

type Params = { params: { id: string } };

const SELECT_FRAGMENT =
  "id,status,notes,source_query,confidence,discovered_at,created_at,updated_at,profiles(instagram_handle,full_name,business_type,city,country)";

export async function GET(_: NextRequest, { params }: Params) {
  const user = await getAuthenticatedUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const admin = createAdminClient();
  const workspaceId = await getUserWorkspaceId();

  const { data, error } = await admin
    .from("leads")
    .select(SELECT_FRAGMENT)
    .eq("id", params.id)
    .eq("workspace_id", workspaceId)
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  if (!data) return NextResponse.json({ error: "Lead not found" }, { status: 404 });

  return NextResponse.json({ lead: data });
}

export async function PATCH(request: NextRequest, { params }: Params) {
  const user = await getAuthenticatedUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const payload = (await request.json()) as {
    status?: string;
    notes?: string;
    confidence?: number;
    source_query?: string;
  };

  if (payload.status && !isLeadStatus(payload.status)) {
    return NextResponse.json({ error: "Invalid status" }, { status: 400 });
  }

  const admin = createAdminClient();
  const workspaceId = await getUserWorkspaceId();

  const updates: {
    status?: LeadStatus;
    notes?: string;
    confidence?: number;
    source_query?: string;
  } = {};

  if (payload.status) updates.status = payload.status as LeadStatus;
  if (typeof payload.notes === "string") updates.notes = payload.notes;
  if (typeof payload.confidence === "number") updates.confidence = payload.confidence;
  if (typeof payload.source_query === "string") updates.source_query = payload.source_query;

  const { data, error } = await admin
    .from("leads")
    .update(updates)
    .eq("id", params.id)
    .eq("workspace_id", workspaceId)
    .select(SELECT_FRAGMENT)
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  if (!data) return NextResponse.json({ error: "Lead not found" }, { status: 404 });

  return NextResponse.json({ lead: data });
}

export async function DELETE(_: NextRequest, { params }: Params) {
  const user = await getAuthenticatedUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const admin = createAdminClient();
  const workspaceId = await getUserWorkspaceId();

  const { error } = await admin
    .from("leads")
    .delete()
    .eq("id", params.id)
    .eq("workspace_id", workspaceId);

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  return NextResponse.json({ success: true });
}
