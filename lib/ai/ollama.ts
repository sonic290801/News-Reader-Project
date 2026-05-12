import { Ollama } from "ollama";
import axios from "axios";
import { AIProvider, SummariseInput } from "./types";
import { SYSTEM_PROMPT, buildPrompt } from "./prompts";

export class OllamaProvider implements AIProvider {
  name = "ollama";

  constructor(
    private readonly baseUrl: string = process.env.OLLAMA_BASE_URL ?? "http://localhost:11434",
    private readonly model: string = process.env.OLLAMA_MODEL ?? "qwen2.5:14b"
  ) {}

  async isAvailable(): Promise<boolean> {
    try {
      const res = await axios.get<{ models: Array<{ name: string }> }>(
        `${this.baseUrl}/api/tags`,
        { timeout: 3000 }
      );
      return res.data.models.some((m) =>
        m.name.startsWith(this.model.split(":")[0])
      );
    } catch {
      return false;
    }
  }

  async *summarise(input: SummariseInput): AsyncIterable<string> {
    const client = new Ollama({ host: this.baseUrl });
    const prompt = buildPrompt(input);

    const stream = await client.chat({
      model: this.model,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: prompt },
      ],
      stream: true,
    });

    for await (const chunk of stream) {
      const text = chunk.message.content;
      if (text) yield text;
    }
  }
}
