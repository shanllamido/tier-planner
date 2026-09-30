"use client";

import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  pointerWithin,
  rectIntersection,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type CollisionDetection,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { useEffect, useMemo, useState } from "react";
import { DEFAULT_SETTINGS, summarize, usd, type Feature, type Settings, type Tier } from "@/lib/cost";
import { EXAMPLE_IDEA, EXAMPLE_PLAN } from "@/lib/example";
import { MODELS, MODEL_BY_ID, PRICES_CHECKED, type ModelId, type ModelInfo } from "@/lib/models";
import type { GeneratedPlan } from "@/lib/schema";
import { CostPanel } from "./CostPanel";
import { FeatureCard } from "./FeatureCard";

type Meta = { model: string; inputTokens: number; outputTokens: number; costUsd: number; ms: number };

const STORAGE_KEY = "tier-planner:v1";

const COLUMNS: { tier: Tier; title: string; hint: string; tone: string }[] = [
  { tier: "unassigned", title: "Backlog", hint: "Drag features into a tier", tone: "bg-slate-100/70" },
  { tier: "free", title: "Free", hint: "Keep it cheap", tone: "bg-emerald-50/70" },
  { tier: "premium", title: "Premium", hint: "Where the value is", tone: "bg-indigo-50/70" },
  { tier: "later", title: "Not now", hint: "Out of scope for v1", tone: "bg-slate-50" },
];

function toFeatures(plan: GeneratedPlan): Feature[] {
  return plan.features.map((f) => ({
    ...f,
    id: Math.random().toString(36).slice(2, 10),
    tier: "unassigned",
    model: f.needsLLM ? null : "none",
  }));
}

type Saved = { idea?: string; appName?: string; features?: Feature[]; settings?: Partial<Settings>; meta?: Meta | null };

// Planner renders client-only (see ClientPlanner), so localStorage is available here.
function readSaved(): Saved | null {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "null");
    return saved?.features?.length ? saved : null;
  } catch {
    return null;
  }
}

// Only let features land on columns and models land on feature slots.
const collision: CollisionDetection = (args) => {
  const kind = args.active.data.current?.kind;
  const droppableContainers = args.droppableContainers.filter((c) => c.data.current?.accepts === kind);
  const scoped = { ...args, droppableContainers };
  const hits = pointerWithin(scoped);
  return hits.length ? hits : rectIntersection(scoped);
};

export function Planner() {
  const [saved] = useState(readSaved);
  const [idea, setIdea] = useState<string>(saved?.idea ?? "");
  const [appName, setAppName] = useState<string>(saved?.appName ?? "");
  const [features, setFeatures] = useState<Feature[]>(saved?.features ?? []);
  const [settings, setSettings] = useState<Settings>({ ...DEFAULT_SETTINGS, ...saved?.settings });
  const [meta, setMeta] = useState<Meta | null>(saved?.meta ?? null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [active, setActive] = useState<{ kind: "feature"; id: string } | { kind: "model"; id: ModelId } | null>(null);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ idea, appName, features, settings, meta }));
    } catch {}
  }, [idea, appName, features, settings, meta]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 120, tolerance: 6 } }),
    useSensor(KeyboardSensor),
  );

  const summary = useMemo(() => summarize(features, settings), [features, settings]);

  function update(id: string, patch: Partial<Feature>) {
    setFeatures((fs) => fs.map((f) => (f.id === id ? { ...f, ...patch } : f)));
  }

  function onDragStart(e: DragStartEvent) {
    const d = e.active.data.current;
    if (d?.kind === "feature") setActive({ kind: "feature", id: d.featureId });
    if (d?.kind === "model") setActive({ kind: "model", id: d.modelId });
  }

  function onDragEnd(e: DragEndEvent) {
    setActive(null);
    const a = e.active.data.current;
    const o = e.over?.data.current;
    if (!a || !o) return;
    if (a.kind === "feature" && o.accepts === "feature") update(a.featureId, { tier: o.tier });
    if (a.kind === "model" && o.accepts === "model") update(o.featureId, { model: a.modelId });
  }

  async function generate() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ idea }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Something went wrong.");
      setAppName(data.plan.appName);
      setFeatures(toFeatures(data.plan));
      setMeta(data.meta);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setLoading(false);
    }
  }

  function loadExample() {
    setIdea(EXAMPLE_IDEA);
    setAppName(EXAMPLE_PLAN.appName);
    setFeatures(toFeatures(EXAMPLE_PLAN));
    setMeta(null);
    setError(null);
  }

  function applySuggestions() {
    setFeatures((fs) => fs.map((f) => ({ ...f, model: f.suggestedModel })));
  }

  function addFeature() {
    setFeatures((fs) => [
      ...fs,
      {
        id: Math.random().toString(36).slice(2, 10),
        name: "New feature",
        description: "Describe what the user gets.",
        needsLLM: true,
        callsPerUserMonth: 20,
        inputTokens: 2000,
        outputTokens: 400,
        cacheable: true,
        batchable: false,
        suggestedModel: "claude-sonnet-5-5",
        rationale: "Added by hand.",
        tier: "unassigned",
        model: null,
      },
    ]);
  }

  const activeFeature = active?.kind === "feature" ? features.find((f) => f.id === active.id) : null;

  return (
    <div className="mx-auto w-full max-w-[1440px] px-4 pb-16 sm:px-6">
      {/* Step 1 */}
      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
        <StepLabel n={1} text="Describe the app you want to build" />
        <textarea
          value={idea}
          onChange={(e) => setIdea(e.target.value)}
          maxLength={600}
          rows={3}
          placeholder="e.g. An AI assistant for staffing agencies that helps dispatchers fill shifts…"
          className="mt-2 w-full resize-y rounded-xl border border-slate-200 bg-slate-50/50 p-3 text-sm outline-none focus:border-indigo-400 focus:bg-white focus:ring-2 focus:ring-indigo-100"
        />
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={generate}
            disabled={loading || idea.trim().length < 10}
            className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loading ? "Claude is planning…" : "Generate features"}
          </button>
          <button
            type="button"
            onClick={loadExample}
            className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            Load example (no API call)
          </button>
          <span className="text-xs text-slate-500">{idea.length}/600</span>
        </div>
        {error && <p className="mt-2 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-800">{error}</p>}
        {meta && (
          <p className="mt-2 text-xs text-slate-500">
            Generated by <b>{MODEL_BY_ID[meta.model as ModelId]?.name ?? meta.model}</b> (low effort, structured output) ·{" "}
            {meta.inputTokens.toLocaleString()} in / {meta.outputTokens.toLocaleString()} out tokens · <b>{usd(meta.costUsd)}</b> ·{" "}
            {(meta.ms / 1000).toFixed(1)}s. That was the only LLM call; everything below is maths in your browser.
          </p>
        )}
      </section>

      {features.length > 0 && (
        <DndContext sensors={sensors} collisionDetection={collision} onDragStart={onDragStart} onDragEnd={onDragEnd} onDragCancel={() => setActive(null)}>
          <div className="mt-6 flex flex-wrap items-baseline gap-x-3">
            <StepLabel n={2} text="Drag features into Free or Premium" />
            {appName && <span className="text-sm font-medium text-slate-500">{appName} · {features.length} features</span>}
          </div>

          {/* Model palette */}
          <section className="sticky top-0 z-20 -mx-4 mt-2 border-b border-slate-200/80 bg-[#f7f7fb]/90 px-4 py-3 backdrop-blur sm:-mx-6 sm:px-6">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
              <StepLabel n={3} text="Drag a model onto a feature" />
              <div className="flex flex-wrap gap-2">
                {MODELS.map((m) => <ModelChip key={m.id} model={m} />)}
              </div>
              <div className="ml-auto flex gap-2">
                <button type="button" onClick={applySuggestions} className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50">
                  Use suggested models
                </button>
                <button type="button" onClick={addFeature} className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50">
                  + Feature
                </button>
              </div>
            </div>
          </section>

          <div className="mt-4 grid gap-4 xl:grid-cols-[1fr_330px]">
            <div>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                {COLUMNS.map((c) => (
                  <Column key={c.tier} {...c} features={features.filter((f) => f.tier === c.tier)} settings={settings}>
                    {features
                      .filter((f) => f.tier === c.tier)
                      .map((f) => (
                        <FeatureCard
                          key={f.id}
                          feature={f}
                          settings={settings}
                          onChange={(p) => update(f.id, p)}
                          onRemove={() => setFeatures((fs) => fs.filter((x) => x.id !== f.id))}
                        />
                      ))}
                  </Column>
                ))}
              </div>
            </div>
            <div className="xl:sticky xl:top-20 xl:self-start">
              <CostPanel summary={summary} settings={settings} onSettings={(p) => setSettings((s) => ({ ...s, ...p }))} />
            </div>
          </div>

          <DragOverlay dropAnimation={null}>
            {activeFeature ? (
              <div className="w-64">
                <FeatureCard feature={activeFeature} settings={settings} onChange={() => {}} onRemove={() => {}} overlay />
              </div>
            ) : active?.kind === "model" ? (
              <ChipBody model={MODEL_BY_ID[active.id]} lifted />
            ) : null}
          </DragOverlay>
        </DndContext>
      )}

      {features.length === 0 && (
        <p className="mt-6 text-center text-sm text-slate-500">Generate a feature list or load the example to start planning.</p>
      )}

      <HowItWorks />
    </div>
  );
}

function StepLabel({ n, text }: { n: number; text: string }) {
  return (
    <h2 className="flex items-center gap-2 text-sm font-semibold text-slate-900">
      <span className="grid h-5 w-5 place-items-center rounded-full bg-indigo-600 text-[11px] text-white">{n}</span>
      {text}
    </h2>
  );
}

function Column({
  tier,
  title,
  hint,
  tone,
  features,
  settings,
  children,
}: {
  tier: Tier;
  title: string;
  hint: string;
  tone: string;
  features: Feature[];
  settings: Settings;
  children: React.ReactNode;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: `col:${tier}`, data: { accepts: "feature", tier } });
  const total = summarize(features.map((f) => ({ ...f, tier: "free" })), settings).freeUserCost;
  return (
    <div
      ref={setNodeRef}
      className={`flex min-h-48 flex-col rounded-2xl p-2.5 transition ${tone} ${isOver ? "ring-2 ring-indigo-400" : "ring-1 ring-slate-200/70"}`}
    >
      <div className="mb-2 flex items-baseline justify-between px-1">
        <div>
          <h3 className="text-sm font-semibold text-slate-900">
            {title} <span className="font-normal text-slate-400">{features.length}</span>
          </h3>
          <p className="text-[11px] text-slate-500">{hint}</p>
        </div>
        {(tier === "free" || tier === "premium") && (
          <span className="text-xs font-semibold tabular-nums text-slate-700">{usd(total)}</span>
        )}
      </div>
      <div className="flex flex-1 flex-col gap-2">{children}</div>
    </div>
  );
}

function ModelChip({ model }: { model: ModelInfo }) {
  const { setNodeRef, listeners, attributes, isDragging } = useDraggable({
    id: `model:${model.id}`,
    data: { kind: "model", modelId: model.id },
  });
  return (
    <button ref={setNodeRef} type="button" {...listeners} {...attributes} className={`touch-none ${isDragging ? "opacity-40" : ""}`} title={model.blurb}>
      <ChipBody model={model} />
    </button>
  );
}

function ChipBody({ model, lifted }: { model: ModelInfo; lifted?: boolean }) {
  return (
    <span
      className={`flex cursor-grab flex-col items-start rounded-lg px-2.5 py-1 text-left ring-1 active:cursor-grabbing ${model.tone} ${
        lifted ? "shadow-lg" : ""
      }`}
    >
      <span className="text-xs font-semibold">{model.short}</span>
      <span className="text-[10px] opacity-75">
        {model.id === "none" ? "$0" : `$${model.input} in · $${model.output} out`}
      </span>
    </span>
  );
}

function HowItWorks() {
  return (
    <section className="mt-10 grid gap-4 rounded-2xl border border-slate-200 bg-white p-5 text-sm text-slate-700 shadow-sm md:grid-cols-3">
      <div>
        <h3 className="font-semibold text-slate-900">How it works</h3>
        <p className="mt-1 text-xs leading-relaxed">
          One call to Claude Opus 5.5 at <i>low effort</i> turns your idea into features, using <b>structured outputs</b> (a JSON schema) so the
          result is always valid. The system prompt is frozen, so it stays <b>cacheable</b>, and <b>server-side fallback</b> covers the rare refusal.
          Everything after that (tiers, models, pricing) is plain code running in your browser.
        </p>
      </div>
      <div>
        <h3 className="font-semibold text-slate-900">The cost model</h3>
        <p className="mt-1 text-xs leading-relaxed">
          Per feature: calls × (fresh input × input price + cached input × cache-read price + output × output price). Batchable features get 50% off
          with the Batch API. Premium users get Free features too. Cache-write premiums and infrastructure are left out.
        </p>
      </div>
      <div>
        <h3 className="font-semibold text-slate-900">Prices</h3>
        <p className="mt-1 text-xs leading-relaxed">
          Claude API list prices in USD per 1M tokens, checked {PRICES_CHECKED}:{" "}
          {MODELS.filter((m) => m.id !== "none").map((m, i) => (
            <span key={m.id}>
              {i > 0 && ", "}
              {m.short} ${m.input}/${m.output}
            </span>
          ))}
          . Token estimates are Claude&rsquo;s guesses; edit them under &ldquo;Details&rdquo;.
        </p>
      </div>
    </section>
  );
}
