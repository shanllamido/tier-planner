// Claude API list prices, USD per 1M tokens (first-party API, checked 2026-09-25).
// Cache reads are billed instead of normal input for the cached share of the prompt.
// Batch API runs asynchronously at 50% of the normal price.

export type ModelId = "none" | "claude-haiku-4-5" | "claude-sonnet-5-5" | "claude-opus-5-5" | "claude-fable-5-1";

export type ModelInfo = {
  id: ModelId;
  name: string;
  short: string;
  input: number;
  output: number;
  cacheRead: number;
  blurb: string;
  tone: string; // tailwind classes for the chip
};

export const MODELS: ModelInfo[] = [
  {
    id: "none",
    name: "No LLM",
    short: "Rules",
    input: 0,
    output: 0,
    cacheRead: 0,
    blurb: "Plain code: rules, lookups, maths. Free and deterministic.",
    tone: "bg-slate-100 text-slate-700 ring-slate-300",
  },
  {
    id: "claude-haiku-4-5",
    name: "Claude Haiku 4.5",
    short: "Haiku",
    input: 1,
    output: 5,
    cacheRead: 0.1,
    blurb: "Fast and cheap: classification, extraction, short replies.",
    tone: "bg-emerald-50 text-emerald-800 ring-emerald-300",
  },
  {
    id: "claude-sonnet-5-5",
    name: "Claude Sonnet 5.5",
    short: "Sonnet",
    input: 2,
    output: 10,
    cacheRead: 0.2,
    blurb: "Everyday workhorse: drafting, agents, tool use.",
    tone: "bg-sky-50 text-sky-800 ring-sky-300",
  },
  {
    id: "claude-opus-5-5",
    name: "Claude Opus 5.5",
    short: "Opus",
    input: 4,
    output: 20,
    cacheRead: 0.2,
    blurb: "Hard reasoning, long documents, complex agents.",
    tone: "bg-violet-50 text-violet-800 ring-violet-300",
  },
  {
    id: "claude-fable-5-1",
    name: "Claude Fable 5.1",
    short: "Fable",
    input: 10,
    output: 50,
    cacheRead: 0.25,
    blurb: "Most capable. Long-horizon work where quality beats cost.",
    tone: "bg-amber-50 text-amber-900 ring-amber-300",
  },
];

export const MODEL_BY_ID = Object.fromEntries(MODELS.map((m) => [m.id, m])) as Record<ModelId, ModelInfo>;

export const PRICES_CHECKED = "2026-09-25";
