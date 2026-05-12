"use client";

import { useEffect, useState } from "react";
import { Button, Badge, Spinner, Toggle, SOURCE_TYPE_COLORS } from "@/components/ui";
import { Select } from "@/components/ui";
import ReaderPanel, { ReaderItem } from "@/components/reader/ReaderPanel";

type SourceType = "RSS" | "REDDIT" | "YOUTUBE" | "WEB";
type Source = { id: string; label: string; type: SourceType };

function timeAgo(dateStr: string | null): string {
  if (!dateStr) return "";
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

function matchesAlerts(item: ReaderItem, alerts: string[]): boolean {
  if (!alerts.length) return false;
  const text = `${item.title} ${item.excerpt ?? ""}`.toLowerCase();
  return alerts.some((kw) => text.includes(kw));
}

// ── List Item ─────────────────────────────────────────────────────────────────

function ListItem({
  item, selected, alertMatch, onSelect, onBookmark,
}: {
  item: ReaderItem; selected: boolean; alertMatch: boolean;
  onSelect: () => void; onBookmark: () => void;
}) {
  return (
    <div
      className={`flex gap-3 px-4 py-3 border-b border-slate-800 cursor-pointer transition-colors
        ${selected ? "bg-slate-800" : "hover:bg-slate-900/60"}
        ${item.isRead ? "opacity-60" : ""}`}
      onClick={onSelect}
    >
      <div className="w-1.5 shrink-0 flex items-start pt-1.5">
        {!item.isRead && <span className="block w-1.5 h-1.5 rounded-full bg-indigo-400" />}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 text-xs text-slate-500 mb-0.5">
          <Badge color={SOURCE_TYPE_COLORS[item.source.type]}>{item.source.label}</Badge>
          <span>{timeAgo(item.publishedAt)}</span>
          {item.type === "YOUTUBE_EPISODE" && item.durationSeconds && (
            <span>{formatDuration(item.durationSeconds)}</span>
          )}
          {alertMatch && (
            <span className="text-yellow-400" title="Matches a keyword alert">⚑</span>
          )}
        </div>
        <p className={`text-sm leading-snug truncate ${item.isRead ? "text-slate-400" : "text-slate-100 font-medium"}`}>
          {item.title}
        </p>
        {item.excerpt && (
          <p className="text-xs text-slate-500 truncate mt-0.5">{item.excerpt}</p>
        )}
      </div>
      <button
        className={`shrink-0 text-lg leading-none transition-colors pt-0.5
          ${item.isBookmarked ? "text-yellow-400" : "text-slate-700 hover:text-slate-400"}`}
        onClick={(e) => { e.stopPropagation(); onBookmark(); }}
        title={item.isBookmarked ? "Remove bookmark" : "Bookmark"}
      >
        {item.isBookmarked ? "★" : "☆"}
      </button>
    </div>
  );
}

// ── Card Item ─────────────────────────────────────────────────────────────────

function CardItem({
  item, selected, alertMatch, onSelect, onBookmark,
}: {
  item: ReaderItem; selected: boolean; alertMatch: boolean;
  onSelect: () => void; onBookmark: () => void;
}) {
  return (
    <div
      className={`bg-slate-900 border rounded-xl overflow-hidden cursor-pointer transition-colors flex flex-col
        ${selected ? "border-indigo-600" : alertMatch ? "border-yellow-700/50" : "border-slate-800 hover:border-slate-700"}
        ${item.isRead ? "opacity-60" : ""}`}
      onClick={onSelect}
    >
      {item.thumbnailUrl && (
        <img src={item.thumbnailUrl} alt="" className="w-full h-32 object-cover" />
      )}
      <div className="p-3 flex flex-col gap-1.5 flex-1">
        <div className="flex items-center gap-2 text-xs text-slate-500">
          <Badge color={SOURCE_TYPE_COLORS[item.source.type]}>{item.source.label}</Badge>
          <span>{timeAgo(item.publishedAt)}</span>
          {alertMatch && <span className="text-yellow-400 ml-auto">⚑</span>}
        </div>
        <p className={`text-sm font-medium leading-snug line-clamp-2 ${item.isRead ? "text-slate-400" : "text-slate-100"}`}>
          {!item.isRead && (
            <span className="inline-block w-1.5 h-1.5 rounded-full bg-indigo-400 mr-1.5 mb-0.5 align-middle" />
          )}
          {item.title}
        </p>
        {item.excerpt && (
          <p className="text-xs text-slate-500 line-clamp-2">{item.excerpt}</p>
        )}
        <div className="flex justify-end mt-auto pt-1">
          <button
            className={`text-base transition-colors ${item.isBookmarked ? "text-yellow-400" : "text-slate-700 hover:text-slate-400"}`}
            onClick={(e) => { e.stopPropagation(); onBookmark(); }}
          >
            {item.isBookmarked ? "★" : "☆"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Page ─────────────────────────────────────────────────────────────────────

export default function FeedPage() {
  const [items, setItems] = useState<ReaderItem[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [view, setView] = useState<"list" | "card">("list");
  const [sourceId, setSourceId] = useState("");
  const [unreadOnly, setUnreadOnly] = useState(false);
  const [sources, setSources] = useState<Source[]>([]);
  const [selectedItem, setSelectedItem] = useState<ReaderItem | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [alerts, setAlerts] = useState<string[]>([]);

  // Load sources and alerts once
  useEffect(() => {
    fetch("/api/sources").then((r) => r.json()).then(setSources);
    fetch("/api/alerts")
      .then((r) => r.json())
      .then((data: { keyword: string }[]) => setAlerts((data ?? []).map((a) => a.keyword)));
  }, []);

  // Debounce search query
  useEffect(() => {
    const t = setTimeout(() => setDebouncedQuery(searchQuery.trim()), 300);
    return () => clearTimeout(t);
  }, [searchQuery]);

  // Load items when filters or search change
  useEffect(() => {
    setLoading(true);
    setItems([]);
    const isSearch = debouncedQuery.length > 0;
    const endpoint = isSearch ? "/api/search" : "/api/items";
    const p = new URLSearchParams({ skip: "0", take: "50" });
    if (isSearch) {
      p.set("q", debouncedQuery);
    } else if (unreadOnly) {
      p.set("isRead", "false");
    }
    if (sourceId) p.set("sourceId", sourceId);
    fetch(`${endpoint}?${p}`)
      .then((r) => r.json())
      .then((data) => {
        setItems(data.items ?? []);
        setTotal(data.total ?? 0);
        setLoading(false);
      });
  }, [debouncedQuery, sourceId, unreadOnly]);

  async function handleLoadMore() {
    setLoadingMore(true);
    const isSearch = debouncedQuery.length > 0;
    const endpoint = isSearch ? "/api/search" : "/api/items";
    const p = new URLSearchParams({ skip: String(items.length), take: "50" });
    if (isSearch) {
      p.set("q", debouncedQuery);
    } else if (unreadOnly) {
      p.set("isRead", "false");
    }
    if (sourceId) p.set("sourceId", sourceId);
    const data = await fetch(`${endpoint}?${p}`).then((r) => r.json());
    setItems((prev) => [...prev, ...(data.items ?? [])]);
    setLoadingMore(false);
  }

  async function handleSelect(item: ReaderItem) {
    setSelectedItem(item);
    if (!item.isRead) {
      await fetch(`/api/items/${item.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isRead: true }),
      });
      setItems((prev) => prev.map((i) => i.id === item.id ? { ...i, isRead: true } : i));
    }
  }

  async function handleBookmark(item: ReaderItem) {
    const next = !item.isBookmarked;
    await fetch(`/api/items/${item.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isBookmarked: next }),
    });
    const updated = { ...item, isBookmarked: next };
    setItems((prev) => prev.map((i) => i.id === item.id ? updated : i));
    if (selectedItem?.id === item.id) setSelectedItem(updated);
  }

  const sourceOptions = [
    { value: "", label: "All sources" },
    ...sources.map((s) => ({ value: s.id, label: s.label })),
  ];

  const isSearching = debouncedQuery.length > 0;

  return (
    <div className="flex flex-col h-[calc(100vh-0px)]">
      {/* Filter bar */}
      <div className="shrink-0 bg-slate-950 border-b border-slate-800 sticky top-0 z-10">
        {/* Search row */}
        <div className="flex items-center gap-2 px-4 pt-3 pb-2">
          <div className="relative flex-1">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 text-sm pointer-events-none">
              🔍
            </span>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search articles…"
              className="w-full bg-slate-800 border border-slate-700 rounded-lg pl-8 pr-8 py-2 text-sm text-slate-100
                placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition-colors text-xs"
              >
                ✕
              </button>
            )}
          </div>
        </div>

        {/* Filters row */}
        <div className="flex items-center gap-2 px-4 pb-2.5 flex-wrap">
          <Select
            value={sourceId}
            onChange={(e) => setSourceId(e.target.value)}
            options={sourceOptions}
            className="text-sm py-1"
          />
          {!isSearching && (
            <div className="flex items-center gap-1.5">
              <span className="text-xs text-slate-500">Unread</span>
              <Toggle checked={unreadOnly} onChange={setUnreadOnly} />
            </div>
          )}
          <div className="flex rounded-lg overflow-hidden border border-slate-700 ml-auto">
            <button
              onClick={() => setView("list")}
              className={`px-2.5 py-1.5 text-sm transition-colors ${view === "list" ? "bg-slate-700 text-slate-100" : "text-slate-500 hover:text-slate-300"}`}
              title="List view"
            >≡</button>
            <button
              onClick={() => setView("card")}
              className={`px-2.5 py-1.5 text-sm transition-colors ${view === "card" ? "bg-slate-700 text-slate-100" : "text-slate-500 hover:text-slate-300"}`}
              title="Card view"
            >⊞</button>
          </div>
          {total > 0 && (
            <span className="text-xs text-slate-600 w-full sm:w-auto">
              {isSearching
                ? `${total.toLocaleString()} result${total !== 1 ? "s" : ""} for "${debouncedQuery}"`
                : `${total.toLocaleString()} item${total !== 1 ? "s" : ""}`}
            </span>
          )}
        </div>
      </div>

      {/* Items */}
      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="flex justify-center py-16"><Spinner className="w-6 h-6" /></div>
        ) : items.length === 0 ? (
          <div className="text-center py-16 text-slate-500">
            {isSearching ? (
              <p>No results for &ldquo;{debouncedQuery}&rdquo;</p>
            ) : (
              <>
                <p className="mb-4">{unreadOnly ? "No unread items." : "No items yet."}</p>
                {!unreadOnly && (
                  <Button variant="ghost" onClick={() => window.location.href = "/sources"}>
                    Go to Sources
                  </Button>
                )}
              </>
            )}
          </div>
        ) : view === "list" ? (
          <>
            {items.map((item) => (
              <ListItem
                key={item.id}
                item={item}
                selected={selectedItem?.id === item.id}
                alertMatch={matchesAlerts(item, alerts)}
                onSelect={() => handleSelect(item)}
                onBookmark={() => handleBookmark(item)}
              />
            ))}
            {items.length < total && (
              <div className="p-4 text-center">
                <Button variant="ghost" onClick={handleLoadMore} disabled={loadingMore}>
                  {loadingMore
                    ? <Spinner className="w-4 h-4" />
                    : `Load more (${(total - items.length).toLocaleString()} remaining)`}
                </Button>
              </div>
            )}
          </>
        ) : (
          <div className="p-3">
            <div className="grid grid-cols-2 gap-3">
              {items.map((item) => (
                <CardItem
                  key={item.id}
                  item={item}
                  selected={selectedItem?.id === item.id}
                  alertMatch={matchesAlerts(item, alerts)}
                  onSelect={() => handleSelect(item)}
                  onBookmark={() => handleBookmark(item)}
                />
              ))}
            </div>
            {items.length < total && (
              <div className="p-4 text-center">
                <Button variant="ghost" onClick={handleLoadMore} disabled={loadingMore}>
                  {loadingMore
                    ? <Spinner className="w-4 h-4" />
                    : `Load more (${(total - items.length).toLocaleString()} remaining)`}
                </Button>
              </div>
            )}
          </div>
        )}
      </div>

      {selectedItem && (
        <ReaderPanel
          key={selectedItem.id}
          item={selectedItem}
          onClose={() => setSelectedItem(null)}
          onBookmark={() => handleBookmark(selectedItem)}
        />
      )}
    </div>
  );
}
