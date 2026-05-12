export interface AIProvider {
  name: string;
  summarise(input: SummariseInput): AsyncIterable<string>;
  isAvailable(): Promise<boolean>;
}

export interface SummariseInput {
  type: "single" | "digest" | "crossSource" | "chunkSynthesis";
  depth: "brief" | "standard" | "deep";
  showAnalysis: boolean;
  items: Array<{
    title: string;
    source: string;
    publishedAt?: string;
    content: string;
  }>;
}

export interface SummariseOutput {
  summary: string;
  analysis?: string;
}

export type SummaryDepth = "brief" | "standard" | "deep";
