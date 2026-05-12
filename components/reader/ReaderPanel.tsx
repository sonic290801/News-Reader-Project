"use client";

import { useState, useRef, useEffect } from "react";
import { Button, Badge, Spinner, SOURCE_TYPE_COLORS } from "@/components/ui";

type SourceType = "RSS" | "REDDIT" | "YOUTUBE" | "WEB";

export type ReaderItem = {
  id: string;
  title: string;
  url: string;
  excerpt: string | null;
  fullText: string | null;
  transcript: string | null;
  thumbnailUrl: string | null;
  publishedAt: string | null;
  author: string | null;
  isRead: boolean;
  isBookmarked: boolean;
  type: string;
  durationSeconds: number | null;
  source: { label: string; type: SourceType };
};

// ── AI Streaming ─────────────────────────────────────────────────────────────

type AIState = {
  status: "idle" | "streaming" | "done" | "error";
  summary: string;
  analysis: string;
  progress: string;
  progressPct: number;
  error: string;
};

const IDLE: AIState = {
  status: "idle", summary: "", analysis: "",
  progress: "", progressPct: 0, error: "",
};

function parseSummary(text: string) {
  const clean = text.replace(/__PROGRESS__:[^\n]*\n/g, "").trim();
  const idx = clean.search(/\bANALYSIS\s*:/i);
  if (idx === -1) return { summary: clean, analysis: "" };
  return {
    summary: clean.slice(0, idx).replace(/^SUMMARY\s*:\s*/i, "").trim(),
    analysis: clean.slice(idx).replace(/^ANALYSIS\s*:\s*/i, "").trim(),
  };
}

function useAISummary() {
  const [ai, setAI] = useState<AIState>(IDLE);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => () => { abortRef.current?.abort(); }, []);

  async function start(itemId: string) {
    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    setAI({ ...IDLE, status: "streaming" });

    try {
      const res = await fetch("/api/ai/summarise", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ itemId }),
        signal: ctrl.signal,
      });

      if (!res.ok || !res.body) {
        const err = await res.json().catch(() => ({ error: "Request failed" }));
        setAI((s) => ({ ...s, status: "error", error: err.error ?? "Request failed" }));
        return;
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buf = "";
      let accumulated = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });

        const parts = buf.split("\n\n");
        buf = parts.pop() ?? "";

        for (const part of parts) {
          if (!part.trim()) continue;
          const lines = part.split("\n");
          let eventType = "";
          let data = "";
          for (const line of lines) {
            if (line.startsWith("event: ")) eventType = line.slice(7).trim();
            else if (line.startsWith("data: ")) data = line.slice(6);
          }

          if (eventType === "done") {
            const { summary, analysis } = parseSummary(accumulated);
            setAI({ status: "done", summary, analysis, progress: "", progressPct: 100, error: "" });
            return;
          }
          if (eventType === "error") {
            let msg = data;
            try { msg = JSON.parse(data); } catch { /* keep raw */ }
            setAI((s) => ({ ...s, status: "error", error: msg }));
            return;
          }
          if (data) {
            let token = data;
            try { token = JSON.parse(data); } catch { /* keep raw */ }

            if (token.startsWith("__PROGRESS__:")) {
              const label = token.slice(13).replace(/\n$/, "");
              const match = token.match(/(\d+) of (\d+)/);
              const pct = match
                ? Math.round((parseInt(match[1]) / parseInt(match[2])) * 90)
                : 95;
              setAI((s) => ({ ...s, progress: label, progressPct: pct }));
            } else {
              accumulated += token;
              const { summary, analysis } = parseSummary(accumulated);
              setAI((s) => ({ ...s, summary, analysis }));
            }
          }
        }
      }
    } catch (err) {
      if ((err as Error).name !== "AbortError") {
        setAI((s) => ({ ...s, status: "error", error: String(err) }));
      }
    }
  }

  return { ai, start };
}

// ── ReaderPanel ───────────────────────────────────────────────────────────────

export default function ReaderPanel({
  item,
  onClose,
  onBookmark,
}: {
  item: ReaderItem;
  onClose: () => void;
  onBookmark: () => void;
}) {
  const { ai, start } = useAISummary();
  const [transcript, setTranscript] = useState(item.transcript);
  const [fetchingTranscript, setFetchingTranscript] = useState(false);
  const [transcriptError, setTranscriptError] = useState("");
  const content = transcript ?? item.fullText ?? item.excerpt ?? "";

  async function handleFetchTranscript() {
    setFetchingTranscript(true);
    setTranscriptError("");
    const res = await fetch("/api/ingest/transcript", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ itemId: item.id }),
    });
    const data = await res.json();
    if (res.ok && data.ok) {
      // Reload the item to get the transcript
      const itemRes = await fetch(`/api/items/${item.id}`);
      if (itemRes.ok) {
        const updated = await itemRes.json();
        setTranscript(updated.transcript);
      }
    } else {
      setTranscriptError(data.reason ?? "Failed to fetch transcript");
    }
    setFetchingTranscript(false);
  }
  const wordCount = content.split(/\s+/).filter(Boolean).length;

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <>
      {/* Mobile backdrop */}
      <div
        className="fixed inset-0 bg-black/60 z-40 md:hidden"
        onClick={onClose}
      />

      {/* Panel */}
      <div className="fixed inset-0 z-50 flex flex-col bg-slate-950 md:inset-auto md:right-0 md:top-0 md:bottom-0 md:w-[600px] md:border-l md:border-slate-800 overflow-hidden">
        {/* Header */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-slate-800 shrink-0">
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-200 transition-colors text-lg leading-none"
            title="Close (Esc)"
          >
            ✕
          </button>
          <div className="flex-1" />
          <button
            onClick={onBookmark}
            className={`text-xl transition-colors ${item.isBookmarked ? "text-yellow-400" : "text-slate-600 hover:text-slate-400"}`}
            title={item.isBookmarked ? "Remove bookmark" : "Bookmark"}
          >
            {item.isBookmarked ? "★" : "☆"}
          </button>
          <a
            href={item.url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-slate-400 hover:text-slate-200 transition-colors text-lg leading-none"
            title="Open original"
          >
            ↗
          </a>
        </div>

        {/* Scrollable content */}
        <div className="flex-1 overflow-y-auto">
          <div className="px-5 pt-5 pb-24 md:pb-8 space-y-4 max-w-prose">
            {/* Meta */}
            <div className="flex flex-wrap items-center gap-2 text-sm text-slate-400">
              <Badge color={SOURCE_TYPE_COLORS[item.source.type]}>{item.source.label}</Badge>
              {item.author && <span>{item.author}</span>}
              {item.publishedAt && (
                <span>
                  {new Date(item.publishedAt).toLocaleDateString("en-GB", {
                    day: "numeric", month: "short", year: "numeric",
                  })}
                </span>
              )}
              {item.durationSeconds != null && item.durationSeconds > 0 && (
                <span>
                  {Math.floor(item.durationSeconds / 3600)}h{" "}
                  {Math.floor((item.durationSeconds % 3600) / 60)}m
                </span>
              )}
              {wordCount > 0 && <span>{wordCount.toLocaleString()} words</span>}
            </div>

            {/* Title */}
            <h1 className="text-xl font-semibold text-slate-100 leading-snug">{item.title}</h1>

            {/* Thumbnail */}
            {item.thumbnailUrl && (
              <img
                src={item.thumbnailUrl}
                alt=""
                className="w-full rounded-lg object-cover max-h-52"
              />
            )}

            <hr className="border-slate-800" />

            {/* Body text */}
            {content ? (
              <p className="text-sm text-slate-300 leading-relaxed whitespace-pre-wrap">{content}</p>
            ) : (
              <p className="text-sm text-slate-500 italic">
                No content available.{" "}
                <a href={item.url} target="_blank" rel="noopener noreferrer" className="underline text-slate-400">
                  Open the original link
                </a>{" "}
                to read.
              </p>
            )}

            {/* Fetch transcript button for YouTube episodes */}
            {item.type === "YOUTUBE_EPISODE" && !transcript && (
              <div className="space-y-2">
                <Button variant="secondary" size="sm" onClick={handleFetchTranscript} disabled={fetchingTranscript}>
                  {fetchingTranscript ? <><Spinner className="w-3 h-3" /> Fetching transcript…</> : "Fetch transcript"}
                </Button>
                {transcriptError && <p className="text-xs text-red-400">{transcriptError}</p>}
              </div>
            )}

            <hr className="border-slate-800" />

            {/* AI Summary */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-semibold text-slate-300 uppercase tracking-wide">AI Summary</h2>
                {ai.status === "done" && (
                  <button
                    onClick={() => start(item.id)}
                    className="text-xs text-slate-500 hover:text-slate-300 transition-colors"
                  >
                    Regenerate
                  </button>
                )}
              </div>

              {ai.status === "idle" && (
                <Button variant="secondary" size="sm" onClick={() => start(item.id)}>
                  Summarise
                </Button>
              )}

              {ai.status === "streaming" && (
                <div className="space-y-3">
                  {ai.progress && (
                    <div className="space-y-1.5">
                      <p className="text-xs text-slate-400">{ai.progress}</p>
                      <div className="w-full bg-slate-800 rounded-full h-1">
                        <div
                          className="bg-indigo-500 h-1 rounded-full transition-all duration-500"
                          style={{ width: `${ai.progressPct}%` }}
                        />
                      </div>
                    </div>
                  )}
                  {ai.summary ? (
                    <div className="text-sm text-slate-300 leading-relaxed whitespace-pre-wrap">
                      {ai.summary}
                      <span className="inline-block w-1 h-4 bg-indigo-400 ml-0.5 align-middle animate-pulse" />
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 text-sm text-slate-400">
                      <Spinner className="w-4 h-4" />
                      <span>Thinking…</span>
                    </div>
                  )}
                </div>
              )}

              {ai.status === "done" && (
                <div className="space-y-3">
                  <p className="text-sm text-slate-300 leading-relaxed whitespace-pre-wrap">{ai.summary}</p>
                  {ai.analysis && (
                    <div className="bg-slate-900 border border-slate-800 rounded-lg p-4 space-y-1.5">
                      <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide">Analysis</p>
                      <p className="text-sm text-slate-300 leading-relaxed whitespace-pre-wrap">{ai.analysis}</p>
                    </div>
                  )}
                </div>
              )}

              {ai.status === "error" && (
                <div className="space-y-2">
                  <p className="text-sm text-red-400">{ai.error}</p>
                  <Button variant="ghost" size="sm" onClick={() => start(item.id)}>Retry</Button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
