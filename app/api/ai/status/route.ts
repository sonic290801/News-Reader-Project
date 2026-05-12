import { NextResponse } from "next/server";
import { OllamaProvider, GeminiProvider } from "@/lib/ai";
import { getSettings } from "@/lib/db/settings";

export async function GET() {
  const settings = await getSettings();
  const ollama = new OllamaProvider(
    settings.ollamaBaseUrl || "http://localhost:11434",
    settings.ollamaModel || "qwen2.5:14b"
  );
  const gemini = new GeminiProvider();

  const [ollamaOk, geminiOk] = await Promise.all([
    ollama.isAvailable(),
    gemini.isAvailable(),
  ]);

  return NextResponse.json({ ollama: ollamaOk, gemini: geminiOk });
}
