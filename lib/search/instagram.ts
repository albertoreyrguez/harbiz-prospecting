import "server-only";

import { getOpenAIClient, getOpenAIModel } from "@/lib/openai";

export type SearchInstagramInput = {
  location: string;
  keywords: string;
  profileType: "PT" | "Center";
  count: number;
};

export type ScoredProfile = {
  handle: string;
  title: string;
  snippet: string;
  sourceQuery: string;
  bestScore: number;
};

const BLOCKED_PATHS = new Set([
  "p",
  "reel",
  "reels",
  "tv",
  "explore",
  "stories",
  "accounts",
  "developer",
  "about",
  "directory",
  "tags",
]);

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

function assertSerperKey(): string {
  const key = process.env.SERPER_API_KEY;
  if (!key) throw new Error("Missing SERPER_API_KEY in .env.local / Vercel env");
  return key;
}

function truncate(s: string, n = 180) {
  return s.length > n ? s.slice(0, n) + "…" : s;
}

function extractInstagramHandle(url: string) {
  try {
    const u = new URL(url);
    if (!u.hostname.includes("instagram.com")) return null;

    const [first] = u.pathname.split("/").filter(Boolean);
    if (!first) return null;

    const handle = first.toLowerCase().replace(/^@/, "");
    if (BLOCKED_PATHS.has(handle)) return null;
    if (!/^[a-z0-9._]{1,30}$/i.test(handle)) return null;

    return handle;
  } catch {
    return null;
  }
}

/**
 * ✅ SERPER (Google SERP JSON)
 * docs: serper.dev
 */
async function fetchSerper(query: string) {
  const apiKey = assertSerperKey();

  const res = await fetch("https://google.serper.dev/search", {
    method: "POST",
    headers: {
      "X-API-KEY": apiKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      q: query,
      gl: "mx",
      hl: "es",
    }),
    cache: "no-store",
  });

  const json = await res.json().catch(() => null);

  if (!res.ok) {
    throw new Error(
      `Serper ${res.status} ${res.statusText} | ${JSON.stringify(json)?.slice(0, 300)}`
    );
  }

  return json as any;
}

function parseSerper(json: any) {
  const results: { title: string; snippet: string; url: string }[] = [];

  const organic = Array.isArray(json?.organic) ? json.organic : [];
  for (const r of organic) {
    const url = typeof r?.link === "string" ? r.link : "";
    if (!url) continue;

    results.push({
      title: (r?.title ?? "").toString(),
      snippet: (r?.snippet ?? "").toString(),
      url,
    });
  }

  // DEBUG: primeras 5 urls
  results.slice(0, 5).forEach((r, i) => {
    console.log(`[SERPER] link#${i + 1} url: ${truncate(r.url)}`);
  });

  return results;
}

function buildQueries(input: SearchInstagramInput) {
  const loc = (input.location || "").trim();
  const kw = (input.keywords || "").trim();

  const typeWords =
    input.profileType === "PT"
      ? ["entrenador personal", "personal trainer", "coach fitness"]
      : ["studio fitness", "centro de entrenamiento", "gimnasio boutique"];

  // Si no quieres depender de ubicación, deja location vacío en el input.
  const locPart = loc ? ` ${loc}` : "";

  const queries: string[] = [];
  for (const t of typeWords) {
    queries.push(`site:instagram.com${locPart} ${kw} ${t}`);
    queries.push(`site:instagram.com${locPart} "${kw}" "${t}"`);
    queries.push(`${kw}${locPart} ${t} instagram`);
  }

  // evitar posts/reels
  const filtered = queries.map(
    (q) =>
      `${q} -inurl:/p/ -inurl:/reel/ -inurl:/reels/ -inurl:/tv/ -inurl:/explore/ -inurl:/stories/ -inurl:/tags/`
  );

  return Array.from(new Set(filtered))
    .map((q) => q.replace(/\s+/g, " ").trim())
    .filter(Boolean)
    .slice(0, 8);
}

async function rankWithOpenAI(input: SearchInstagramInput, candidates: ScoredProfile[]) {
  if (candidates.length === 0) return [];

  // ✅ Importante: cliente OpenAI con lazy import (evita el digest en Vercel)
  const client = await getOpenAIClient();
  const model = getOpenAIModel();

  const system = `
Eres un experto en prospección fitness.
Selecciona perfiles REALES de Instagram.
Devuelve SOLO JSON: { "selected": [{"handle":"..."}] }
No inventes handles. Máximo ${input.count}.
`;

  const resp = await client.chat.completions.create({
    model,
    temperature: 0.2,
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: system },
      {
        role: "user",
        content: JSON.stringify({
          location: input.location,
          keywords: input.keywords,
          profileType: input.profileType,
          topK: input.count,
          candidates: candidates.map((c) => ({
            handle: c.handle,
            title: c.title,
            snippet: c.snippet,
            sourceQuery: c.sourceQuery,
          })),
        }),
      },
    ],
  });

  const content = resp.choices[0]?.message?.content?.trim();
  if (!content) return candidates.slice(0, input.count);

  try {
    const parsed = JSON.parse(content) as { selected?: { handle: string }[] };
    const set = new Set((parsed.selected ?? []).map((x) => x.handle.toLowerCase()));
    const picked = candidates.filter((c) => set.has(c.handle.toLowerCase()));
    return picked.slice(0, input.count);
  } catch {
    return candidates.slice(0, input.count);
  }
}

export async function runInstagramDeepSearch(input: SearchInstagramInput) {
  const queries = buildQueries(input);

  const byHandle = new Map<string, ScoredProfile>();
  const failures: string[] = [];

  for (const q of queries) {
    try {
      const json = await fetchSerper(q);
      const serp = parseSerper(json);

      console.log("[SERPER] query:", q);
      console.log("[SERPER] results:", serp.length);

      for (const r of serp) {
        const handle = extractInstagramHandle(r.url);
        if (!handle) {
          console.log("[IG] skip (no handle):", truncate(r.url));
          continue;
        }

        if (!byHandle.has(handle)) {
          byHandle.set(handle, {
            handle,
            title: r.title || handle,
            snippet: r.snippet || "",
            sourceQuery: q,
            bestScore: 1,
          });
        }
      }
    } catch (e) {
      failures.push(`${q}: ${e instanceof Error ? e.message : String(e)}`);
    }

    await sleep(150 + Math.floor(Math.random() * 200));
  }

  const ranked = Array.from(byHandle.values());
  const selected = await rankWithOpenAI(input, ranked);

  console.log("[IG] ranked:", ranked.length, "| selected:", selected.length);

  if (ranked.length === 0) {
    failures.push("0 candidatos. Revisa SERPER_API_KEY y/o cambia keywords/location.");
  }

  return { queries, failures, ranked, selected };
}