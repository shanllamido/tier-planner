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
import { DEFAULT_SETTINGS, LABELS, MODE_DEFAULTS, summarize, usd, type Feature, type Mode, type Settings, type Tier } from "@/lib/cost";
import { EXAMPLE_BRIEF, EXAMPLE_PLAN } from "@/lib/example";
import { MODELS, MODEL_BY_ID, PRICES_CHECKED, type ModelId, type ModelInfo } from "@/lib/models";
import type { GeneratedPlan } from "@/lib/schema";
import { CostPanel } from "./CostPanel";
import { FeatureCard } from "./FeatureCard";
import { ValueMatrix } from "./ValueMatrix";


const STORAGE_KEY = "tier-planner:v2";

function columns(mode: Mode): { tier: Tier; title: string; hint: string; tone: string }[] {
  const L = LABELS[mode];
  return [
    { tier: "unassigned", title: "Backlog", hint: "Drag features into a plan", tone: "bg-slate-100/70" },
    { tier: "free", title: L.free, hint: L.freeHint, tone: "bg-emerald-50/70" },
    { tier: "premium", title: L.premium, hint: L.premiumHint, tone: "bg-indigo-50/70" },
    { tier: "later", title: "Not now", hint: "Out of scope for v1", tone: "bg-slate-50" },
  ];
}

function toFeatures(plan: GeneratedPlan): Feature[] {
  return plan.features.map((f) => ({
    ...f,
    id: Math.random().toString(36).slice(2, 10),
    tier: "unassigned",
    model: f.needsLLM ? null : "none",
  }));
}

type Saved = { appName?: string; features?: Feature[]; settings?: Partial<Settings> };

// Planner renders client-only (see ClientPlanner), so localStorage is available here.
function readSaved(): Saved | null {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "null");
    // Ignore saved plans from older versions that lack value/risk fields.
    const ok = saved?.features?.length && saved.features.every((f: Feature) => typeof f.customerValue === "number");
    return ok ? saved : null;
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
  const [appName, setAppName] = useState<string>(saved?.appName ?? EXAMPLE_PLAN.appName);
  const [features, setFeatures] = useState<Feature[]>(() => saved?.features ?? toFeatures(EXAMPLE_PLAN));
  const [settings, setSettings] = useState<Settings>({ ...DEFAULT_SETTINGS, ...saved?.settings });
  const [active, setActive] = useState<{ kind: "feature"; id: string } | { kind: "model"; id: ModelId } | null>(null);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ appName, features, settings }));
    } catch {}
  }, [appName, features, settings]);

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

  function setMode(mode: Mode) {
    setSettings((s) => ({ ...s, mode, ...MODE_DEFAULTS[mode] }));
  }

  function loadExample() {
    setMode("b2b");
    setAppName(EXAMPLE_PLAN.appName);
    setFeatures(toFeatures(EXAMPLE_PLAN));
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
        customerValue: 3,
        valueReason: "Describe the customer outcome.",
        riskIfWrong: "medium",
        riskNote: "Describe what happens if it's wrong.",
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
        <div className="flex flex-wrap items-center justify-between gap-2">
          <StepLabel n={1} text="The customer, their problem and the product" />
          <div role="radiogroup" aria-label="Business model" className="flex rounded-lg bg-slate-100 p-0.5 text-xs font-medium">
            {(["b2b", "consumer"] as const).map((m) => (
              <button
                key={m}
                type="button"
                role="radio"
                aria-checked={settings.mode === m}
                onClick={() => setMode(m)}
                className={`rounded-md px-3 py-1 ${settings.mode === m ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-800"}`}
              >
                {m === "b2b" ? "B2B · per seat" : "Consumer · freemium"}
              </button>
            ))}
          </div>
        </div>
        <dl className="mt-3 grid gap-3 text-sm sm:grid-cols-3">
          {EXAMPLE_BRIEF.map((b) => (
            <div key={b.label} className="rounded-xl bg-slate-50 p-3">
              <dt className="text-[11px] font-semibold uppercase tracking-wide text-indigo-600">{b.label}</dt>
              <dd className="mt-1 leading-relaxed text-slate-700">{b.text}</dd>
            </div>
          ))}
        </dl>
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={loadExample}
            className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            Reset the board
          </button>
          <span className="text-xs text-slate-500">
            Features were drafted by Claude from this brief. They include value, risk and usage estimates; edit any of them under &ldquo;Details&rdquo;.
          </span>
        </div>
      </section>

      {features.length > 0 && (
        <DndContext sensors={sensors} collisionDetection={collision} onDragStart={onDragStart} onDragEnd={onDragEnd} onDragCancel={() => setActive(null)}>
          <div className="mt-6 flex flex-wrap items-baseline gap-x-3">
            <StepLabel n={2} text={`Drag features into ${LABELS[settings.mode].free} or ${LABELS[settings.mode].premium}`} />
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
                {columns(settings.mode).map((c) => (
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
                          unit={LABELS[settings.mode].user}
                        />
                      ))}
                  </Column>
                ))}
              </div>
              <ValueMatrix features={features} settings={settings} />
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
        <p className="mt-6 text-center text-sm text-slate-500">The board is empty. Use &ldquo;Reset the board&rdquo; to start again.</p>
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
    <section className="mt-10 rounded-2xl border border-slate-200 bg-white p-5 text-sm text-slate-700 shadow-sm">
      <h2 className="font-semibold text-slate-900">How I decide what goes in an AI product</h2>
      <div className="mt-3 grid gap-4 md:grid-cols-4">
        <Principle n="1" title="Value">
          Start from the paying customer&rsquo;s problem. A feature earns its place by an outcome they&rsquo;d pay for: time saved, errors
          avoided, revenue. Features that are a reason to buy go into the paid plan.
        </Principle>
        <Principle n="2" title="Quality">
          Where a wrong answer causes legal or financial harm, the model is chosen by evals on real cases, with a human approving the output.
          Rules that can be code stay code.
        </Principle>
        <Principle n="3" title="Cost">
          Only then pick the cheapest model that passes. AI features cost money on every use, so each one needs a cost per user that the
          pricing covers, with caching and batching where they fit.
        </Principle>
        <Principle n="4" title="How this tool works">
          The feature list was drafted by one call to Claude Opus 5.5 at low effort, with a JSON schema (structured outputs) and a frozen,
          cacheable system prompt. That call cost about 7 cents. Everything on this page is plain code in your browser, so using it costs nothing.
          Prices checked {PRICES_CHECKED}.
        </Principle>
      </div>
    </section>
  );
}

function Principle({ n, title, children }: { n: string; title: string; children: React.ReactNode }) {
  return (
    <div>
      <h3 className="flex items-center gap-2 font-semibold text-slate-900">
        <span className="text-xs font-semibold text-indigo-600">{n}</span>
        {title}
      </h3>
      <p className="mt-1 text-xs leading-relaxed">{children}</p>
    </div>
  );
}
