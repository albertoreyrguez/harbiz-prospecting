import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/auth";
import { LEAD_STATUSES, LeadStatus } from "@/lib/constants";
import { createAdminClient } from "@/lib/supabase/admin";
import { getUserWorkspaceId } from "@/lib/workspace";
import { generateHarbizCopy } from "@/lib/harbizCopy";

function isLeadStatus(value: string): value is LeadStatus {
  return LEAD_STATUSES.includes(value as LeadStatus);
}

/**
 * Supabase a veces tipa relaciones como ARRAY aunque sea 1-1.
 * Esto lo normaliza: si viene array -> coge el primero; si viene objeto -> lo devuelve.
 */
function firstProfile(profiles: any) {
  if (!profiles) return null;
  return Array.isArray(profiles) ? profiles[0] ?? null : profiles;
}

/**
 * Convierte owner_id (UUID) -> label humano (email o nombre)
 * Usamos admin.auth.admin.getUserById
 */
async function getOwnerLabels(admin: any, ownerIds: string[]) {
  const unique = Array.from(new Set(ownerIds.filter(Boolean)));
  const map = new Map<string, string>();

  for (const id of unique) {
    try {
      const { data, error } = await admin.auth.admin.getUserById(id);
      if (error || !data?.user) {
        map.set(id, id); // fallback al UUID
        continue;
      }

      const u = data.user;
      const email = u.email ?? "";
      const name =
        (u.user_metadata?.full_name as string) ||
        (u.user_metadata?.name as string) ||
        "";

      // prioridad: nombre > email > uuid
      map.set(id, (name || email || id).trim());
    } catch {
      map.set(id, id);
    }
  }

  return map;
}

export async function GET(request: NextRequest) {
  const user = await getAuthenticatedUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const status = request.nextUrl.searchParams.get("status");
  const search = request.nextUrl.searchParams.get("search")?.toLowerCase().trim();

  const country = request.nextUrl.searchParams.get("country")?.trim();
  const city = request.nextUrl.searchParams.get("city")?.trim();

  // ✅ filtramos por SDR con UUID (pero mostramos label humano)
  const ownerId = request.nextUrl.searchParams.get("ownerId")?.trim();

  const admin = createAdminClient();
  const workspaceId = await getUserWorkspaceId();

  let query = admin
    .from("leads")
    .select(
      "id,owner_id,status,notes,source_query,confidence,discovered_at,created_at,updated_at,display_name,bio,website,generated_copy,profiles(id,instagram_handle,full_name,business_type,city,country)"
    )
    .eq("workspace_id", workspaceId)
    .order("updated_at", { ascending: false });

  // ✅ status
  if (status && isLeadStatus(status)) {
    query = query.eq("status", status);
  }

  // ✅ owner
  if (ownerId && ownerId !== "all") {
    query = query.eq("owner_id", ownerId);
  }

  // ✅ filtros por ubicación (del profile relacionado)
  if (country && country !== "all") {
    query = query.eq("profiles.country", country);
  }

  if (city && city !== "all") {
    query = query.eq("profiles.city", city);
  }

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  // 1) normalizamos profiles
  const normalized = (data ?? []).map((lead: any) => ({
    ...lead,
    profiles: firstProfile(lead.profiles),
  }));

  // 2) filtro search (handle / full_name)
  const filtered = normalized.filter((lead: any) => {
    if (!search) return true;

    const handle = (lead.profiles?.instagram_handle ?? "").toLowerCase();
    const fullName = (lead.profiles?.full_name ?? "").toLowerCase();

    return handle.includes(search) || fullName.includes(search);
  });

  // 3) labels humanos para owner_id
  const ownerIds = filtered.map((l: any) => l.owner_id).filter(Boolean);
  const ownerLabelMap = await getOwnerLabels(admin, ownerIds);

  const withOwnerLabel = filtered.map((lead: any) => ({
    ...lead,
    owner_label: ownerLabelMap.get(lead.owner_id) ?? lead.owner_id,
  }));

  return NextResponse.json({ leads: withOwnerLabel });
}

export async function POST(request: NextRequest) {
  const user = await getAuthenticatedUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const payload = (await request.json()) as {
    profile_id?: string;
    status?: LeadStatus;
    notes?: string;
    source_query?: string;
    confidence?: number;
  };

  if (!payload.profile_id) {
    return NextResponse.json({ error: "profile_id is required" }, { status: 400 });
  }

  if (payload.status && !isLeadStatus(payload.status)) {
    return NextResponse.json({ error: "Invalid status" }, { status: 400 });
  }

  const admin = createAdminClient();
  const workspaceId = await getUserWorkspaceId();

  // 1) Traemos info del profile para poder generar copy (bio, nombre, etc.)
  const { data: profileRow, error: profileErr } = await admin
    .from("profiles")
    .select("id,instagram_handle,full_name,bio,website,business_type,city,country")
    .eq("id", payload.profile_id)
    .single();

  if (profileErr) {
    return NextResponse.json({ error: profileErr.message }, { status: 400 });
  }

  // 2) Email del owner (SDR) para sacar el nombre desde el email
  let ownerEmail = "";
  try {
    const { data: u } = await admin.auth.admin.getUserById(user.id);
    ownerEmail = u?.user?.email ?? "";
  } catch {}

  // 3) Generamos el copy (si no hay bio, saldrá más genérico y sin detalle)
  const generated_copy = generateHarbizCopy({
    ownerEmail,
    displayName: profileRow?.full_name ?? "",
    bio: profileRow?.bio ?? "",
  });

  const { data, error } = await admin
    .from("leads")
    .insert({
      workspace_id: workspaceId,
      profile_id: payload.profile_id,
      owner_id: user.id,
      status: payload.status ?? "new",
      notes: payload.notes ?? null,
      source_query: payload.source_query ?? null,
      confidence: payload.confidence ?? null,

      // ✅ nuevas columnas para la herramienta
      display_name: profileRow?.full_name ?? null,
      bio: profileRow?.bio ?? null,
      website: profileRow?.website ?? null,
      generated_copy,

      discovered_at: new Date().toISOString(),
    })
    .select(
      "id,owner_id,status,notes,source_query,confidence,discovered_at,created_at,updated_at,display_name,bio,website,generated_copy,profiles(id,instagram_handle,full_name,business_type,city,country)"
    )
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  const normalized = data
    ? {
        ...data,
        profiles: firstProfile((data as any).profiles),
      }
    : data;

  // ponemos label humano del owner también
  let owner_label = normalized?.owner_id ?? null;
  try {
    if (normalized?.owner_id) {
      const { data: u } = await admin.auth.admin.getUserById(normalized.owner_id);
      const email = u?.user?.email ?? "";
      const name =
        (u?.user?.user_metadata?.full_name as string) ||
        (u?.user?.user_metadata?.name as string) ||
        "";
      owner_label = (name || email || normalized.owner_id).trim();
    }
  } catch {}

  return NextResponse.json({ lead: { ...normalized, owner_label } }, { status: 201 });
}
