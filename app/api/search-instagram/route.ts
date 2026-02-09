import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/auth";
import { runInstagramDeepSearch } from "@/lib/search/instagram";
import { createAdminClient } from "@/lib/supabase/admin";
import { getUserWorkspaceId } from "@/lib/workspace";

const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX_REQUESTS = 5;

type RateEntry = {
  count: number;
  windowStart: number;
};

const rateLimitStore = new Map<string, RateEntry>();

function checkRateLimit(userId: string) {
  const now = Date.now();
  const entry = rateLimitStore.get(userId);

  if (!entry || now - entry.windowStart > RATE_LIMIT_WINDOW_MS) {
    rateLimitStore.set(userId, { count: 1, windowStart: now });
    return true;
  }

  if (entry.count >= RATE_LIMIT_MAX_REQUESTS) return false;

  entry.count += 1;
  return true;
}

/**
 * Normaliza y separa country/city a partir de:
 * - payload.country + payload.city (si vienen)
 * - payload.location (si el front sigue usando un solo campo)
 *
 * Reglas:
 * - "Buenos Aires, Argentina" => city="Buenos Aires", country="Argentina"
 * - "Argentina" => country="Argentina", city=null
 * - "Online, Colombia" => country="Colombia", city=null  (online no se guarda como ciudad)
 * - "CDMX" => country="CDMX", city=null (fallback)
 */
function parseLocation(
  input?: string | null,
  explicitCity?: string | null,
  explicitCountry?: string | null
) {
  const countryFromPayload = (explicitCountry ?? "").trim();
  const cityFromPayload = (explicitCity ?? "").trim();

  if (countryFromPayload) {
    return {
      country: countryFromPayload,
      city: cityFromPayload || null,
    };
  }

  const loc = (input ?? "").trim();
  if (!loc) return { country: null, city: null };

  const parts = loc
    .split(",")
    .map((p) => p.trim())
    .filter(Boolean);

  // caso "Online, Colombia" (o cualquier "online, X")
  const first = (parts[0] ?? "").toLowerCase();
  const isOnline = first === "online" || first.includes("online");

  if (parts.length >= 2) {
    const last = parts[parts.length - 1];
    const city = isOnline ? null : parts.slice(0, parts.length - 1).join(", ");
    return { country: last, city: city || null };
  }

  // solo una cosa: la tratamos como "country" para el MVP
  return { country: parts[0], city: null };
}

export async function POST(request: NextRequest) {
  const user = await getAuthenticatedUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!checkRateLimit(user.id)) {
    return NextResponse.json(
      { error: "Too many requests. Please wait and try again." },
      { status: 429 }
    );
  }

  const payload = (await request.json()) as {
    // opcionales
    country?: string;
    city?: string;

    // compat con UI actual
    location?: string;

    keywords?: string;
    profileType?: "PT" | "Center";
    count?: number;

    // opcional: nombre/email del SDR
    actor?: string;
  };

  if (!payload.keywords || !payload.profileType) {
    return NextResponse.json(
      { error: "keywords and profileType are required" },
      { status: 400 }
    );
  }

  if (payload.profileType !== "PT" && payload.profileType !== "Center") {
    return NextResponse.json(
      { error: "profileType must be PT or Center" },
      { status: 400 }
    );
  }

  const count = Math.min(Math.max(Number(payload.count ?? 20), 1), 100);
  const keywords = payload.keywords.trim();

  // Parse location -> country/city
  const { country, city } = parseLocation(payload.location, payload.city, payload.country);

  // Location para buscar: si hay ciudad "city, country", si no "country"
  // Si no pudimos inferir country, usamos el location raw para no bloquear búsquedas.
  const locationForSearch =
    city && country
      ? `${city}, ${country}`
      : country
      ? country
      : (payload.location ?? "").trim();

  if (!locationForSearch) {
    return NextResponse.json(
      { error: "location is required (or provide country)" },
      { status: 400 }
    );
  }

  const actor =
    (payload.actor ?? "").trim() ||
    // @ts-ignore por si user no tiene email
    (user.email ?? user.id);

  try {
    const searchOutput = await runInstagramDeepSearch({
      location: locationForSearch,
      keywords,
      profileType: payload.profileType,
      count,
    });

    const admin = createAdminClient();
    const workspaceId = await getUserWorkspaceId();

    const queryLabel = `${payload.profileType}: ${keywords} @ ${locationForSearch}`;

    // 1) Guardar run
    const { data: run, error: runError } = await admin
      .from("search_runs")
      .insert({
        workspace_id: workspaceId,
        owner_id: user.id,
        query: queryLabel,
        filters: {
          actor,
          profileType: payload.profileType,
          country,
          city,
          locationForSearch,
          keywords,
          queriesTried: searchOutput.queries.length,
          failures: searchOutput.failures.length,
        },
        results_count: searchOutput.selected.length,
      })
      .select("id")
      .single();

    if (runError || !run) {
      return NextResponse.json(
        { error: runError?.message ?? "Failed to create search run" },
        { status: 500 }
      );
    }

    // 2) Guardar perfiles (guardamos country/city)
    const profileRows = searchOutput.selected.map((item) => ({
      instagram_handle: item.handle,
      full_name: null,
      business_type: payload.profileType === "PT" ? "Personal Trainer" : "Fitness Center",
      city,
      country,
      source_payload: {
        source: "serper",
        actor,
        query: item.sourceQuery,
        title: item.title,
        snippet: item.snippet,
        score: item.bestScore,
        search_run_id: run.id,
      },
    }));

    const { data: savedProfiles, error: profilesError } = await admin
      .from("profiles")
      .upsert(profileRows, { onConflict: "instagram_handle" })
      .select("id,instagram_handle");

    if (profilesError || !savedProfiles) {
      return NextResponse.json(
        { error: profilesError?.message ?? "Failed to save profiles" },
        { status: 500 }
      );
    }

    const profileByHandle = new Map(
      (savedProfiles as any[]).map((profile) => [profile.instagram_handle, profile.id])
    );

    // 3) Guardar leads
    const leadRows = searchOutput.selected
      .map((item) => {
        const profileId = profileByHandle.get(item.handle);
        if (!profileId) return null;

        return {
          workspace_id: workspaceId,
          profile_id: profileId,
          owner_id: user.id,
          actor,
          status: "new" as const,
          source_query: item.sourceQuery,
          confidence: Math.min(100, Math.max(0, Math.round(item.bestScore * 10))),
          discovered_at: new Date().toISOString(),
        };
      })
      .filter(Boolean);

    const { data: leads, error: leadsError } = await admin
      .from("leads")
      .upsert(leadRows as any, { onConflict: "workspace_id,profile_id" })
      .select(
        "id,owner_id,actor,status,source_query,confidence,discovered_at,profiles(instagram_handle,full_name,business_type,city,country)"
      );

    if (leadsError) {
      return NextResponse.json({ error: leadsError.message }, { status: 500 });
    }

    return NextResponse.json({
      runId: run.id,
      actor,
      locationForSearch,
      parsed: { country, city },
      queryCount: searchOutput.queries.length,
      failures: searchOutput.failures,
      leads: leads ?? [],
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Search failed unexpectedly" },
      { status: 500 }
    );
  }
}
