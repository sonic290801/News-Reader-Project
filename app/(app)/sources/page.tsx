"use client";

import { useEffect, useState } from "react";
import { Button, Badge, Modal, Input, Select, Toggle, Spinner, SOURCE_TYPE_COLORS } from "@/components/ui";

type SourceType = "RSS" | "REDDIT" | "YOUTUBE" | "WEB";

type Source = {
  id: string;
  type: SourceType;
  url: string;
  label: string;
  category: string | null;
  fetchIntervalMinutes: number;
  autoFetchTranscript: boolean;
  enabled: boolean;
  lastFetchedAt: string | null;
  lastErrorAt: string | null;
  lastErrorMsg: string | null;
  _count: { items: number };
};

const INTERVAL_OPTIONS = [
  { value: "15", label: "Every 15 min" },
  { value: "30", label: "Every 30 min" },
  { value: "60", label: "Every hour" },
  { value: "360", label: "Every 6 hours" },
  { value: "1440", label: "Once a day" },
];

const CATEGORY_OPTIONS = [
  { value: "", label: "No category" },
  { value: "Politics", label: "Politics" },
  { value: "Tech", label: "Tech" },
  { value: "Finance", label: "Finance" },
  { value: "Science", label: "Science" },
  { value: "Podcast", label: "Podcast" },
  { value: "Other", label: "Other" },
];

function timeAgo(dateStr: string | null): string {
  if (!dateStr) return "Never";
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

function detectType(url: string): SourceType {
  if (/reddit\.com\/r\//i.test(url)) return "REDDIT";
  if (/youtube\.com\/@|youtube\.com\/c\/|youtube\.com\/channel\/|youtube\.com\/user\//i.test(url)) return "YOUTUBE";
  if (/\.(rss|xml|atom)(\?|$)/i.test(url)) return "RSS";
  return "WEB";
}

// ── Add Source Modal ─────────────────────────────────────────────────────────

type Step = "url" | "configure";

function AddSourceModal({ onClose, onAdded }: { onClose: () => void; onAdded: () => void }) {
  const [step, setStep] = useState<Step>("url");
  const [url, setUrl] = useState("");
  const [resolving, setResolving] = useState(false);
  const [resolveError, setResolveError] = useState("");
  const [type, setType] = useState<SourceType>("RSS");
  const [label, setLabel] = useState("");
  const [category, setCategory] = useState("");
  const [interval, setInterval] = useState("60");
  const [autoTranscript, setAutoTranscript] = useState(false);
  const [selectorConfig, setSelectorConfig] = useState("");
  const [saving, setSaving] = useState(false);

  async function handleResolve() {
    setResolving(true);
    setResolveError("");
    const detected = detectType(url);
    setType(detected);

    try {
      if (detected === "REDDIT") {
        const rssUrl = url.endsWith(".rss") ? url : url.replace(/\/?$/, "/.rss");
        setUrl(rssUrl);
        const sub = url.match(/reddit\.com\/r\/([^/?]+)/i)?.[1] ?? "subreddit";
        setLabel(`r/${sub}`);
        setCategory("Politics");
        setStep("configure");
      } else if (detected === "YOUTUBE") {
        const res = await fetch("/api/sources/resolve-youtube", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ url }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error);
        setLabel(data.title || "YouTube Channel");
        setCategory("Podcast");
        setAutoTranscript(true);
        setStep("configure");
      } else if (detected === "RSS") {
        const res = await fetch("/api/sources/resolve-rss", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ url }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error);
        setLabel(data.title || "RSS Feed");
        setStep("configure");
      } else {
        const res = await fetch("/api/sources/resolve-web", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ url }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error);
        const domain = new URL(url).hostname.replace(/^www\./, "");
        setLabel(domain);
        setStep("configure");
      }
    } catch (err) {
      setResolveError(err instanceof Error ? err.message : "Could not resolve URL");
    } finally {
      setResolving(false);
    }
  }

  async function handleSave() {
    setSaving(true);
    try {
      const channelIdRes = type === "YOUTUBE"
        ? await fetch("/api/sources/resolve-youtube", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ url }),
          }).then((r) => r.json())
        : null;

      const res = await fetch("/api/sources", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type,
          url,
          channelId: channelIdRes?.channelId,
          label,
          category: category || null,
          fetchIntervalMinutes: parseInt(interval),
          autoFetchTranscript: autoTranscript,
          selectorConfig: selectorConfig ? JSON.stringify({ articleLinks: selectorConfig }) : undefined,
        }),
      });
      if (!res.ok) throw new Error((await res.json()).error);
      onAdded();
    } catch (err) {
      setResolveError(err instanceof Error ? err.message : "Failed to save source");
      setSaving(false);
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      title="Add Source"
      footer={
        step === "configure" ? (
          <>
            <Button variant="ghost" onClick={() => setStep("url")}>Back</Button>
            <Button onClick={handleSave} disabled={!label || saving}>
              {saving ? <><Spinner className="w-4 h-4" /> Saving…</> : "Save Source"}
            </Button>
          </>
        ) : (
          <Button onClick={handleResolve} disabled={!url || resolving}>
            {resolving ? <><Spinner className="w-4 h-4" /> Detecting…</> : "Continue"}
          </Button>
        )
      }
    >
      {step === "url" ? (
        <div className="space-y-4">
          <Input
            label="URL"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && url && handleResolve()}
            placeholder="https://example.com, youtube.com/@channel, reddit.com/r/sub…"
            error={resolveError}
            autoFocus
          />
          <p className="text-xs text-slate-500">
            Supports RSS feeds, Reddit subreddits, YouTube channels, and any website.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="flex items-center gap-2 p-3 bg-slate-800 rounded-lg">
            <Badge color={SOURCE_TYPE_COLORS[type]}>{type}</Badge>
            <span className="text-sm text-slate-400 truncate">{url}</span>
          </div>
          <Input label="Label" value={label} onChange={(e) => setLabel(e.target.value)} />
          <Select
            label="Category"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            options={CATEGORY_OPTIONS}
          />
          <Select
            label="Fetch interval"
            value={interval}
            onChange={(e) => setInterval(e.target.value)}
            options={INTERVAL_OPTIONS}
          />
          {type === "YOUTUBE" && (
            <Toggle
              checked={autoTranscript}
              onChange={setAutoTranscript}
              label="Auto-fetch transcript for new videos"
            />
          )}
          {type === "WEB" && (
            <Input
              label="CSS selector (optional)"
              value={selectorConfig}
              onChange={(e) => setSelectorConfig(e.target.value)}
              placeholder="h2.post-title > a"
              hint="Override auto-detection if articles aren't found correctly"
            />
          )}
          {resolveError && <p className="text-sm text-red-400">{resolveError}</p>}
        </div>
      )}
    </Modal>
  );
}

// ── Edit Source Modal ────────────────────────────────────────────────────────

function EditSourceModal({ source, onClose, onSaved }: { source: Source; onClose: () => void; onSaved: () => void }) {
  const [label, setLabel] = useState(source.label);
  const [category, setCategory] = useState(source.category ?? "");
  const [interval, setInterval] = useState(String(source.fetchIntervalMinutes));
  const [autoTranscript, setAutoTranscript] = useState(source.autoFetchTranscript);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function handleSave() {
    setSaving(true);
    const res = await fetch(`/api/sources/${source.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        label,
        category: category || null,
        fetchIntervalMinutes: parseInt(interval),
        autoFetchTranscript: autoTranscript,
      }),
    });
    if (res.ok) { onSaved(); }
    else { setError((await res.json()).error ?? "Failed to save"); setSaving(false); }
  }

  return (
    <Modal open onClose={onClose} title="Edit Source"
      footer={<><Button variant="ghost" onClick={onClose}>Cancel</Button><Button onClick={handleSave} disabled={!label || saving}>{saving ? <><Spinner className="w-4 h-4" /> Saving…</> : "Save"}</Button></>}
    >
      <div className="space-y-4">
        <Input label="Label" value={label} onChange={(e) => setLabel(e.target.value)} />
        <Select label="Category" value={category} onChange={(e) => setCategory(e.target.value)} options={CATEGORY_OPTIONS} />
        <Select label="Fetch interval" value={interval} onChange={(e) => setInterval(e.target.value)} options={INTERVAL_OPTIONS} />
        {source.type === "YOUTUBE" && (
          <Toggle checked={autoTranscript} onChange={setAutoTranscript} label="Auto-fetch transcript for new videos" />
        )}
        {error && <p className="text-sm text-red-400">{error}</p>}
      </div>
    </Modal>
  );
}

// ── Source Card ──────────────────────────────────────────────────────────────

function SourceCard({ source, onRefresh }: { source: Source; onRefresh: () => void }) {
  const [refreshing, setRefreshing] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [editing, setEditing] = useState(false);

  async function handleToggle() {
    await fetch(`/api/sources/${source.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ enabled: !source.enabled }),
    });
    onRefresh();
  }

  async function handleRefreshNow() {
    setRefreshing(true);
    const typeMap: Record<SourceType, string> = {
      RSS: "rss", REDDIT: "reddit", YOUTUBE: "youtube", WEB: "web",
    };
    await fetch(`/api/ingest/${typeMap[source.type]}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sourceId: source.id }),
    });
    setRefreshing(false);
    onRefresh();
  }

  async function handleDelete() {
    setDeleting(true);
    await fetch(`/api/sources/${source.id}`, { method: "DELETE" });
    onRefresh();
  }

  const hasError = !!source.lastErrorAt && (!source.lastFetchedAt || new Date(source.lastErrorAt) > new Date(source.lastFetchedAt));

  return (
    <div className={`bg-slate-900 border rounded-xl p-4 flex flex-col gap-3 ${hasError ? "border-red-800/50" : "border-slate-800"}`}>
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <Badge color={SOURCE_TYPE_COLORS[source.type]}>{source.type}</Badge>
          <span className="font-medium text-slate-100 truncate">{source.label}</span>
        </div>
        <Toggle checked={source.enabled} onChange={handleToggle} />
      </div>

      <div className="flex flex-wrap gap-2 text-xs text-slate-500">
        {source.category && <Badge color="gray">{source.category}</Badge>}
        <span>{source._count.items} items</span>
        <span>·</span>
        <span className={hasError ? "text-red-400" : ""}>
          {hasError ? `Error: ${source.lastErrorMsg?.slice(0, 60)}` : `Fetched ${timeAgo(source.lastFetchedAt)}`}
        </span>
      </div>

      <div className="flex gap-2">
        <Button variant="ghost" size="sm" onClick={handleRefreshNow} disabled={refreshing}>
          {refreshing ? <Spinner className="w-3 h-3" /> : "↻"} Refresh
        </Button>
        <Button variant="ghost" size="sm" onClick={() => setEditing(true)}>Edit</Button>
        {!confirmDelete ? (
          <Button variant="ghost" size="sm" onClick={() => setConfirmDelete(true)}>
            Delete
          </Button>
        ) : (
          <Button variant="destructive" size="sm" onClick={handleDelete} disabled={deleting}>
            {deleting ? <Spinner className="w-3 h-3" /> : "Confirm delete"}
          </Button>
        )}
        {confirmDelete && (
          <Button variant="ghost" size="sm" onClick={() => setConfirmDelete(false)}>Cancel</Button>
        )}
      </div>
      {editing && (
        <EditSourceModal
          source={source}
          onClose={() => setEditing(false)}
          onSaved={() => { setEditing(false); onRefresh(); }}
        />
      )}
    </div>
  );
}

// ── Page ─────────────────────────────────────────────────────────────────────

export default function SourcesPage() {
  const [sources, setSources] = useState<Source[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);

  async function loadSources() {
    const res = await fetch("/api/sources");
    setSources(await res.json());
    setLoading(false);
  }

  useEffect(() => { loadSources(); }, []);

  return (
    <div className="max-w-2xl mx-auto px-4 py-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-semibold text-slate-100">Sources</h1>
        <Button onClick={() => setShowAdd(true)}>+ Add Source</Button>
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><Spinner className="w-6 h-6" /></div>
      ) : sources.length === 0 ? (
        <div className="text-center py-12 text-slate-500">
          <p className="mb-4">No sources yet.</p>
          <Button onClick={() => setShowAdd(true)}>Add your first source</Button>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {sources.map((source) => (
            <SourceCard key={source.id} source={source} onRefresh={loadSources} />
          ))}
        </div>
      )}

      {showAdd && (
        <AddSourceModal
          onClose={() => setShowAdd(false)}
          onAdded={() => { setShowAdd(false); loadSources(); }}
        />
      )}
    </div>
  );
}
