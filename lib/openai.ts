import 'server-only';
import OpenAI from 'openai';

function assertOpenAIKey(): string {
  const key =
    process.env.OPENAI_API_KEY ||
    process.env.OPENAI_APIKEY ||
    process.env.OPENAI_KEY;

  if (!key) {
    throw new Error(
      'Missing OpenAI API key. Set OPENAI_API_KEY in .env.local'
    );
  }

  return key;
}

// ✅ NAMED EXPORTS (esto arregla tu error)
export function getOpenAIClient() {
  const apiKey = assertOpenAIKey();
  return new OpenAI({ apiKey });
}

export function getOpenAIModel() {
  // Puedes configurar esto en .env.local si quieres
  return process.env.OPENAI_MODEL || 'gpt-4o-mini';
}
