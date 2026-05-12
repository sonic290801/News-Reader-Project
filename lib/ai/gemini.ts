import { GoogleGenerativeAI } from "@google/generative-ai";
import { AIProvider, SummariseInput } from "./types";
import { SYSTEM_PROMPT, buildPrompt } from "./prompts";

export class GeminiProvider implements AIProvider {
  name = "gemini";

  private get apiKey() {
    return process.env.GEMINI_API_KEY ?? "";
  }

  async isAvailable(): Promise<boolean> {
    return this.apiKey.trim().length > 0;
  }

  async *summarise(input: SummariseInput): AsyncIterable<string> {
    const genAI = new GoogleGenerativeAI(this.apiKey);
    const model = genAI.getGenerativeModel({
      model: "gemini-2.0-flash",
      systemInstruction: SYSTEM_PROMPT,
    });

    const prompt = buildPrompt(input);
    const result = await model.generateContentStream(prompt);

    for await (const chunk of result.stream) {
      const text = chunk.text();
      if (text) yield text;
    }
  }
}
