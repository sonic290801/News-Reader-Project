import { getSettings } from "@/lib/db/settings";
import { OllamaProvider } from "./ollama";
import { GeminiProvider } from "./gemini";
import { AIProvider } from "./types";

const ollama = new OllamaProvider();
const gemini = new GeminiProvider();

export async function getProvider(): Promise<AIProvider> {
  const settings = await getSettings();

  if (settings.aiProvider === "ollama") {
    if (await ollama.isAvailable()) return ollama;
    // Fall through to Gemini if Ollama is unavailable
    console.warn("[ai] Ollama unavailable — falling back to Gemini");
  }

  if (await gemini.isAvailable()) return gemini;

  throw new Error(
    "No AI provider available. Start Ollama (ollama serve) or set GEMINI_API_KEY in settings."
  );
}

export { OllamaProvider, GeminiProvider };
export type { AIProvider };
