"use client";

import { useEffect, useState } from "react";
import { Button, Input, Toggle, Spinner } from "@/components/ui";

type Settings = {
  aiProvider: string;
  ollamaBaseUrl: string;
  ollamaModel: string;
  geminiApiKey: string;
  summaryDepth: string;
  showAnalysis: boolean;
  retentionDays: number;
};

type KeywordAlert = { id: string; keyword: string };
type AIStatus = { ollama: boolean; gemini: boolean } | null;

function RadioGroup({
  label, value, options, onChange,
}: {
  label: string; value: string;
  options: { value: string; label: string }[];
  onChange: (v: string) => void;
}) {
  return (
    <div>
      <p className="text-sm font-medium text-slate-300 mb-2">{label}</p>
      <div className="flex gap-3 flex-wrap">
        {options.map((opt) => (
          <label key={opt.value} className="flex items-center gap-2 cursor-pointer">
            <input
              type="radio"
              name={label}
              value={opt.value}
              checked={value === opt.value}
              onChange={() => onChange(opt.value)}
              className="accent-indigo-500"
            />
            <span className="text-sm text-slate-300">{opt.label}</span>
          </label>
        ))}
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4">
      <h2 className="text-base font-semibold text-slate-100">{title}</h2>
      {children}
    </section>
  );
}

export default function SettingsPage() {
  const [settings, setSettings] = useState<Settings>({
    aiProvider: "ollama",
    ollamaBaseUrl: "http://localhost:11434",
    ollamaModel: "qwen2.5:14b",
    geminiApiKey: "",
    summaryDepth: "standard",
    showAnalysis: true,
    retentionDays: 30,
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [aiStatus, setAiStatus] = useState<AIStatus>(null);
  const [testingAI, setTestingAI] = useState(false);
  const [clearConfirm, setClearConfirm] = useState(false);
  const [clearing, setClearing] = useState(false);

  // Keyword alerts state
  const [alerts, setAlerts] = useState<KeywordAlert[]>([]);
  const [newKeyword, setNewKeyword] = useState("");
  const [addingAlert, setAddingAlert] = useState(false);
  const [alertError, setAlertError] = useState("");

  useEffect(() => {
    Promise.all([
      fetch("/api/settings").then((r) => r.json()),
      fetch("/api/alerts").then((r) => r.json()),
    ]).then(([settingsData, alertsData]) => {
      setSettings((prev) => ({ ...prev, ...settingsData }));
      setAlerts(alertsData ?? []);
      setLoading(false);
    });
  }, []);

  function update<K extends keyof Settings>(key: K, value: Settings[K]) {
    setSettings((prev) => ({ ...prev, [key]: value }));
    setSaved(false);
  }

  async function handleSave() {
    setSaving(true);
    await fetch("/api/settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(settings),
    });
    setSaving(false);
    setSaved(true);
  }

  async function handleTestAI() {
    setTestingAI(true);
    setAiStatus(null);
    const res = await fetch("/api/ai/status");
    setAiStatus(await res.json());
    setTestingAI(false);
  }

  async function handleClearRead() {
    setClearing(true);
    await fetch("/api/items/read", { method: "DELETE" });
    setClearing(false);
    setClearConfirm(false);
  }

  async function handleAddAlert() {
    const kw = newKeyword.trim().toLowerCase();
    if (!kw) return;
    setAddingAlert(true);
    setAlertError("");
    const res = await fetch("/api/alerts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ keyword: kw }),
    });
    if (res.ok) {
      const alert = await res.json();
      setAlerts((prev) => [...prev, alert]);
      setNewKeyword("");
    } else {
      const err = await res.json();
      setAlertError(err.error ?? "Failed to add");
    }
    setAddingAlert(false);
  }

  async function handleDeleteAlert(id: string) {
    await fetch(`/api/alerts/${id}`, { method: "DELETE" });
    setAlerts((prev) => prev.filter((a) => a.id !== id));
  }

  if (loading) {
    return <div className="flex justify-center py-12"><Spinner className="w-6 h-6" /></div>;
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-6 space-y-5">
      <h1 className="text-xl font-semibold text-slate-100">Settings</h1>

      {/* AI Provider */}
      <Section title="AI Provider">
        <RadioGroup
          label="Provider"
          value={settings.aiProvider}
          options={[
            { value: "ollama", label: "Ollama (local)" },
            { value: "gemini", label: "Gemini (cloud, free)" },
          ]}
          onChange={(v) => update("aiProvider", v)}
        />

        {settings.aiProvider === "ollama" && (
          <div className="space-y-3 pt-1">
            <Input
              label="Ollama base URL"
              value={settings.ollamaBaseUrl}
              onChange={(e) => update("ollamaBaseUrl", e.target.value)}
              placeholder="http://localhost:11434"
            />
            <Input
              label="Model name"
              value={settings.ollamaModel}
              onChange={(e) => update("ollamaModel", e.target.value)}
              placeholder="qwen2.5:14b"
            />
          </div>
        )}

        {settings.aiProvider === "gemini" && (
          <div className="space-y-3 pt-1">
            <Input
              label="Gemini API key"
              type="password"
              value={settings.geminiApiKey}
              onChange={(e) => update("geminiApiKey", e.target.value)}
              placeholder="AIza…"
              hint="Get a free key at aistudio.google.com"
            />
          </div>
        )}

        <div className="flex items-center gap-3 pt-1">
          <Button variant="secondary" size="sm" onClick={handleTestAI} disabled={testingAI}>
            {testingAI ? <><Spinner className="w-3 h-3" /> Testing…</> : "Test connection"}
          </Button>
          {aiStatus && (
            <div className="flex gap-3 text-sm">
              <span className={aiStatus.ollama ? "text-green-400" : "text-slate-500"}>
                {aiStatus.ollama ? "✓ Ollama" : "✗ Ollama"}
              </span>
              <span className={aiStatus.gemini ? "text-green-400" : "text-slate-500"}>
                {aiStatus.gemini ? "✓ Gemini" : "✗ Gemini"}
              </span>
            </div>
          )}
        </div>
      </Section>

      {/* Summary Preferences */}
      <Section title="Summary Preferences">
        <RadioGroup
          label="Summary depth"
          value={settings.summaryDepth}
          options={[
            { value: "brief", label: "Brief" },
            { value: "standard", label: "Standard" },
            { value: "deep", label: "Deep" },
          ]}
          onChange={(v) => update("summaryDepth", v)}
        />
        <Toggle
          checked={settings.showAnalysis}
          onChange={(v) => update("showAnalysis", v)}
          label="Show analysis section in summaries"
        />
      </Section>

      {/* Keyword Alerts */}
      <Section title="Keyword Alerts">
        <p className="text-sm text-slate-400">
          Items matching these keywords are flagged with ⚑ in your feed.
        </p>
        <div className="flex gap-2">
          <input
            type="text"
            value={newKeyword}
            onChange={(e) => setNewKeyword(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && newKeyword.trim() && handleAddAlert()}
            placeholder="e.g. ukraine, ai, climate"
            className="flex-1 bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-100
              placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
          <Button
            variant="secondary"
            size="sm"
            onClick={handleAddAlert}
            disabled={!newKeyword.trim() || addingAlert}
          >
            {addingAlert ? <Spinner className="w-3 h-3" /> : "Add"}
          </Button>
        </div>
        {alertError && <p className="text-sm text-red-400">{alertError}</p>}
        {alerts.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {alerts.map((alert) => (
              <span
                key={alert.id}
                className="flex items-center gap-1.5 bg-slate-800 border border-slate-700 rounded-full px-3 py-1 text-sm text-slate-300"
              >
                {alert.keyword}
                <button
                  onClick={() => handleDeleteAlert(alert.id)}
                  className="text-slate-500 hover:text-slate-300 transition-colors leading-none"
                >
                  ✕
                </button>
              </span>
            ))}
          </div>
        )}
        {alerts.length === 0 && (
          <p className="text-sm text-slate-600">No keyword alerts set.</p>
        )}
      </Section>

      {/* Data */}
      <Section title="Data">
        <div>
          <label className="text-sm font-medium text-slate-300 block mb-1">
            Keep articles for (days)
          </label>
          <input
            type="number"
            min={1}
            max={365}
            value={settings.retentionDays}
            onChange={(e) => update("retentionDays", parseInt(e.target.value) || 30)}
            className="w-24 bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-100
              focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>

        <div className="flex items-center gap-3">
          {!clearConfirm ? (
            <Button variant="ghost" size="sm" onClick={() => setClearConfirm(true)}>
              Clear all read items
            </Button>
          ) : (
            <>
              <Button variant="destructive" size="sm" onClick={handleClearRead} disabled={clearing}>
                {clearing ? <><Spinner className="w-3 h-3" /> Clearing…</> : "Confirm clear"}
              </Button>
              <Button variant="ghost" size="sm" onClick={() => setClearConfirm(false)}>Cancel</Button>
            </>
          )}
        </div>
      </Section>

      {/* Save */}
      <div className="flex items-center gap-3 pb-8">
        <Button onClick={handleSave} disabled={saving}>
          {saving ? <><Spinner className="w-4 h-4" /> Saving…</> : "Save settings"}
        </Button>
        {saved && <span className="text-sm text-green-400">Saved</span>}
      </div>
    </div>
  );
}
