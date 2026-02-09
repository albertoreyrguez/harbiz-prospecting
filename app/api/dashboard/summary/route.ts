import { NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { getUserWorkspaceId } from "@/lib/workspace";

export async function GET() {
  const user = await getAuthenticatedUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const admin = createAdminClient();

  try {
    const workspaceId = await getUserWorkspaceId();

    const [{ data: leads, error: leadsErr }, { data: searches, error: searchesErr }] =
      await Promise.all([
        admin
          .from("leads")
          .select("status,created_at")
          .eq("workspace_id", workspaceId)
          .order("created_at", { ascending: false }),
        admin
          .from("search_runs")
          .select("id,query,results_count,created_at,filters")
          .eq("workspace_id", workspaceId)
          .order("created_at", { ascending: false })
          .limit(8),
      ]);

    if (leadsErr) throw leadsErr;
    if (searchesErr) throw searchesErr;

    const leadRows = leads ?? [];
    const summary = {
      totalLeads: leadRows.length,
      newLeads: leadRows.filter((lead) => lead.status === "new").length,
      contactedLeads: leadRows.filter((lead) => lead.status === "contacted").length,
      qualifiedLeads: leadRows.filter((lead) => lead.status === "qualified").length,
    };

    return NextResponse.json({
      workspaceId,
      workspaceName: "Harbiz Prospecting",
      summary,
      recentSearches: searches ?? [],
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to load dashboard summary",
      },
      { status: 500 }
    );
  }
}
