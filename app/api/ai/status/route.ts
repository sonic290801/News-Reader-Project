import { NextResponse } from "next/server";
import { OllamaProvider, GeminiProvider } from "@/lib/ai";

export async function GET() {
  const ollama = new OllamaProvider();
  const gemini = new GeminiProvider();

  const [ollamaOk, geminiOk] = await Promise.all([
    ollama.isAvailable(),
    gemini.isAvailable(),
  ]);

  return NextResponse.json({ ollama: ollamaOk, gemini: geminiOk });
}
