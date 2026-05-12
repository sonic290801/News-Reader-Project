import { getSettings } from "@/lib/db/settings";
import { OllamaProvider } from "./ollama";
import { GeminiProvider } from "./gemini";
import { AIProvider } from "./types";

export async function getProvider(): Promise<AIProvider> {
  const settings = await getSettings();

  if (settings.aiProvider === "ollama") {
    // Trust the user's explicit choice — skip availability check
    return new OllamaProvider(
      settings.ollamaBaseUrl || process.env.OLLAMA_BASE_URL || "http://localhost:11434",
      settings.ollamaModel || process.env.OLLAMA_MODEL || "qwen2.5:14b"
    );
  }

  const gemini = new GeminiProvider();
  if (await gemini.isAvailable()) return gemini;

  throw new Error(
    "No AI provider available. Start Ollama (ollama serve) or set GEMINI_API_KEY in settings."
  );
}

export { OllamaProvider, GeminiProvider };
export type { AIProvider };
