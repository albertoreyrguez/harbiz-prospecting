import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/auth";
import { runInstagramDeepSearch } from "@/lib/search/instagram";
import { createAdminClient } from "@/lib/supabase/admin";
import { getUserWorkspaceId } from "@/lib/workspace";
import { getOpenAIClient, getOpenAIModel } from "@/lib/openai";
import { generateHarbizCopy } from "@/lib/harbizCopy";

export const runtime = "nodejs";

const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX_REQUESTS = 5;

type RateEntry = { count: number; windowStart: number };
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

function parseLocation(input?: string | null, explicitCity?: string | null, explicitCountry?: string | null) {
  const countryFromPayload = (explicitCountry ?? "").trim();
  const cityFromPayload = (explicitCity ?? "").trim();

  if (countryFromPayload) return { country: countryFromPayload, city: cityFromPayload || null };

  const loc = (input ?? "").trim();
  if (!loc) return { country: null, city: null };

  const parts = loc.split(",").map((p) => p.trim()).filter(Boolean);
  const first = (parts[0] ?? "").toLowerCase();
  const isOnline = first === "online" || first.includes("online");

  if (parts.length >= 2) {
    const last = parts[parts.length - 1];
    const city = isOnline ? null : parts.slice(0, parts.length - 1).join(", ");
    return { country: last, city: city || null };
  }

  return { country: parts[0], city: null };
}

async function mapWithConcurrency<T, R>(items: T[], limit: number, fn: (item: T, idx: number) => Promise<R>) {
  const results: R[] = new Array(items.length) as any;
  let nextIndex = 0;

  async function worker() {
    while (true) {
      const idx = nextIndex++;
      if (idx >= items.length) return;
      results[idx] = await fn(items[idx], idx);
    }
  }

  const workers = Array.from({ length: Math.min(limit, items.length) }, () => worker());
  await Promise.all(workers);
  return results;
}

function safeText(v: any) {
  return typeof v === "string" ? v : "";
}

function normalizeHandle(handle: string) {
  return safeText(handle).replace(/^@/, "").trim();
}

function getSdrNameFromActor(actor: string) {
  const local = (actor || "").split("@")[0] || "";
  const first = local.split(/[._-]/)[0] || local;
  if (!first) return "Equipo Harbiz";
  if (first.toLowerCase().startsWith("alberto")) return "Alberto";
  return first.charAt(0).toUpperCase() + first.slice(1);
}

async function generateCopyOpenAIPlain(input: {
  actor: string;
  profileType: "PT" | "Center";
  handle: string;
  title: string;
  snippet: string;
  country: string | null;
  city: string | null;
}) {
  const fallback = generateHarbizCopy({
    ownerEmail: input.actor,
    displayName: input.title || "",
    bio: input.snippet || "",
  });

  const SDR_NAME = getSdrNameFromActor(input.actor);

  try {
    const openai = await getOpenAIClient();
const model = getOpenAIModel();
    const prompt = `
Escribe 1 DM corto en español neutro para IG, en frío.

Reglas:
- NO inventes datos. Usa solo el título y el snippet.
- NO uses "¿". Solo "?" al final.
- Máximo 3 líneas. Sin emojis. Nada de comillas.
- Si no tienes nombre, no lo inventes.
- Personaliza SIEMPRE con 1 HOOK real sacado del snippet/título (nicho, modalidad, identidad o promesa). Reescríbelo en tus palabras (no lo cites literal).
- Estilo: humano, natural, sin pitch largo.
- Empieza exactamente con: "Hola! Soy ${SDR_NAME}."
- Usa la frase "Le eché un vistazo" en la primera línea (tal cual).
- No digas "vs app". No digas "me parece interesante tu enfoque como entrenador personal".

Estructura:
L1: "Hola! Soy ${SDR_NAME}. Le eché un vistazo a tu perfil y vi que {HOOK}."
L2 (pregunta simple):
  - Si tipo=PT: "Cómo lo llevas hoy, WhatsApp/Excel/Drive o ya usas alguna app?"
  - Si tipo=Center: "Las reservas las gestionáis por WhatsApp/DM o con algún sistema?"
L3 (contexto corto, 1 frase):
  - PT: "Te lo pregunto porque en Harbiz ayudamos a coaches a tener planes, seguimiento y mensajes más ordenados."
  - Center: "Te lo pregunto porque en Harbiz ayudamos a studios a ordenar reservas/clases y clientes sin depender del WhatsApp."

Datos:
tipo: ${input.profileType}
handle: ${input.handle}
título: ${input.title}
snippet: ${input.snippet}
ciudad: ${input.city ?? ""}
país: ${input.country ?? ""}
`;

    const resp = await openai.chat.completions.create({
      model,
      messages: [
        { role: "system", content: "Devuelve SOLO el mensaje final. Sin explicaciones." },
        { role: "user", content: prompt },
      ],
      temperature: 0.75,
    });

    let text = (resp.choices?.[0]?.message?.content ?? "").trim();
    if (!text) return { copy: fallback, source: "fallback" as const, error: "empty_response" };

    text = text.replace(/¿/g, "").replace(/\?{2,}/g, "?");
    return { copy: text, source: "openai" as const, error: null as string | null };
  } catch (err: any) {
    const msg = (err?.message || err?.toString?.() || "openai_error").slice(0, 160);
    return { copy: fallback, source: "fallback" as const, error: msg };
  }
}

export async function POST(request: NextRequest) {
  const user = await getAuthenticatedUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if (!checkRateLimit(user.id)) {
    return NextResponse.json({ error: "Too many requests. Please wait and try again." }, { status: 429 });
  }

  const payload = (await request.json()) as {
    country?: string;
    city?: string;
    location?: string;
    keywords?: string;
    profileType?: "PT" | "Center";
    count?: number;
    actor?: string;
  };

  if (!payload.keywords || !payload.profileType) {
    return NextResponse.json({ error: "keywords and profileType are required" }, { status: 400 });
  }
  if (payload.profileType !== "PT" && payload.profileType !== "Center") {
    return NextResponse.json({ error: "profileType must be PT or Center" }, { status: 400 });
  }

  const profileType = payload.profileType as "PT" | "Center";
  const count = Math.min(Math.max(Number(payload.count ?? 20), 1), 100);
  const keywords = payload.keywords.trim();

  const { country, city } = parseLocation(payload.location, payload.city, payload.country);

  const locationForSearch =
    city && country ? `${city}, ${country}` : country ? country : (payload.location ?? "").trim();

  if (!locationForSearch) {
    return NextResponse.json({ error: "location is required (or provide country)" }, { status: 400 });
  }

  const actor = (payload.actor ?? "").trim() || ((user as any).email ?? user.id);

  try {
    const searchOutput = await runInstagramDeepSearch({
      location: locationForSearch,
      keywords,
      profileType,
      count,
    });

    const admin = createAdminClient();
    const workspaceId = await getUserWorkspaceId();

    const queryLabel = `${profileType}: ${keywords} @ ${locationForSearch}`;

    const { data: run, error: runError } = await admin
      .from("search_runs")
      .insert({
        workspace_id: workspaceId,
        owner_id: user.id,
        query: queryLabel,
        filters: {
          actor,
          profileType,
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
      return NextResponse.json({ error: runError?.message ?? "Failed to create search run" }, { status: 500 });
    }

    const profileRows = searchOutput.selected.map((item) => ({
      instagram_handle: normalizeHandle(item.handle),
      full_name: null,
      bio: safeText(item.snippet) || null,
      website: null,
      business_type: profileType === "PT" ? "Personal Trainer" : "Fitness Center",
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
      .select("id,instagram_handle,bio,website,full_name,business_type,city,country");

    if (profilesError || !savedProfiles) {
      return NextResponse.json({ error: profilesError?.message ?? "Failed to save profiles" }, { status: 500 });
    }

    const profileByHandle = new Map((savedProfiles as any[]).map((p) => [p.instagram_handle, p.id]));
    const savedProfileByHandle = new Map((savedProfiles as any[]).map((p) => [p.instagram_handle, p]));

    const copies = await mapWithConcurrency(searchOutput.selected, 4, async (item) => {
      const handle = normalizeHandle(item.handle);
      const prof = savedProfileByHandle.get(handle);
      const title = safeText(item.title);
      const snippet = safeText(item.snippet);

      const out = await generateCopyOpenAIPlain({
        actor,
        profileType,
        handle,
        title,
        snippet: prof?.bio ?? snippet,
        country,
        city,
      });

      return { handle, ...out };
    });

    const copyByHandle = new Map(copies.map((c) => [c.handle, c]));

    const leadRows = searchOutput.selected
      .map((item) => {
        const handle = normalizeHandle(item.handle);
        const profileId = profileByHandle.get(handle);
        if (!profileId) return null;

        const prof = savedProfileByHandle.get(handle);
        const meta = copyByHandle.get(handle);

        return {
          workspace_id: workspaceId,
          profile_id: profileId,
          owner_id: user.id,
          actor,
          status: "new" as const,
          source_query: item.sourceQuery,
          confidence: Math.min(100, Math.max(0, Math.round(item.bestScore * 10))),
          discovered_at: new Date().toISOString(),

          display_name: prof?.full_name ?? null,
          bio: prof?.bio ?? null,
          website: prof?.website ?? null,
          generated_copy: meta?.copy ?? null,
        };
      })
      .filter(Boolean);

    const { data: leads, error: leadsError } = await admin
      .from("leads")
      .upsert(leadRows as any, { onConflict: "workspace_id,profile_id" })
      .select(
        "id,owner_id,actor,status,source_query,confidence,discovered_at,display_name,bio,website,generated_copy,profiles(instagram_handle,full_name,bio,website,business_type,city,country)"
      );

    if (leadsError) {
      return NextResponse.json({ error: leadsError.message }, { status: 500 });
    }

    const leadsWithCopyMeta = (leads ?? []).map((l: any) => {
      const handle = normalizeHandle(l?.profiles?.instagram_handle ?? "");
      const meta = copyByHandle.get(handle);
      return {
        ...l,
        copy_source: meta?.source ?? "fallback",
        copy_error: meta?.error ?? null,
      };
    });

    return NextResponse.json({
      runId: run.id,
      actor,
      locationForSearch,
      parsed: { country, city },
      queryCount: searchOutput.queries.length,
      failures: searchOutput.failures,
      leads: leadsWithCopyMeta,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Search failed unexpectedly" },
      { status: 500 }
    );
  }
}