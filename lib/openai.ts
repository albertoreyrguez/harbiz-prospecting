import "server-only";

function assertOpenAIKey(): string {
  const key =
    process.env.OPENAI_API_KEY ||
    process.env.OPENAI_APIKEY ||
    process.env.OPENAI_KEY;

  if (!key) {
    throw new Error("Missing OpenAI API key. Set OPENAI_API_KEY in Vercel env.");
  }
  return key;
}

// ✅ NO hay import OpenAI arriba. Se carga con lazy import.
export async function getOpenAIClient() {
  const apiKey = assertOpenAIKey();
  const mod = await import("openai");
  const OpenAI = mod.default;
  return new OpenAI({ apiKey });
}

export function getOpenAIModel() {
  return process.env.OPENAI_MODEL || "gpt-4o-mini";
}