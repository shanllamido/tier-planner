import { MODEL_BY_ID, type ModelId } from "./models";

export type Tier = "free" | "premium" | "later" | "unassigned";
export type Mode = "b2b" | "consumer";
export type Risk = "low" | "medium" | "high";

// Internally the two paid-plan columns are "free" (base) and "premium" (upgrade); only the labels change.
export const LABELS: Record<
  Mode,
  { free: string; premium: string; freeHint: string; premiumHint: string; user: string; price: string; users: string; share: string }
> = {
  b2b: {
    free: "Core",
    premium: "AI Add-on",
    freeHint: "In every seat's base licence",
    premiumHint: "Sold per seat on top",
    user: "seat",
    price: "Add-on price / seat / mo",
    users: "Seats (all customers)",
    share: "Seats with add-on",
  },
  consumer: {
    free: "Free",
    premium: "Premium",
    freeHint: "Keep it cheap",
    premiumHint: "Where the value is",
    user: "user",
    price: "Premium price / user / mo",
    users: "Monthly active users",
    share: "On premium",
  },
};

export type Feature = {
  id: string;
  name: string;
  description: string;
  needsLLM: boolean;
  callsPerUserMonth: number;
  inputTokens: number;
  outputTokens: number;
  cacheable: boolean; // large stable prompt prefix (system prompt, docs) that caching can reuse
  batchable: boolean; // can run asynchronously, so the Batch API applies
  suggestedModel: ModelId;
  rationale: string;
  customerValue: number; // 1-5
  valueReason: string;
  riskIfWrong: Risk;
  riskNote: string;
  tier: Tier;
  model: ModelId | null;
};

export type Settings = {
  mode: Mode;
  caching: boolean;
  batching: boolean;
  cacheShare: number; // share of input tokens served from cache when caching applies (0..1)
  premiumPrice: number; // USD per premium user per month
  users: number; // monthly active users
  premiumShare: number; // share of users on premium (0..1)
};

export const MODE_DEFAULTS: Record<Mode, Pick<Settings, "premiumPrice" | "users" | "premiumShare">> = {
  b2b: { premiumPrice: 29, users: 2000, premiumShare: 0.3 },
  consumer: { premiumPrice: 9, users: 10000, premiumShare: 0.05 },
};

export const DEFAULT_SETTINGS: Settings = {
  mode: "b2b",
  caching: true,
  batching: true,
  cacheShare: 0.7,
  ...MODE_DEFAULTS.b2b,
};

/** One call's cost in USD, after caching and batch discounts. */
export function callCost(f: Feature, model: ModelId, s: Settings): number {
  const m = MODEL_BY_ID[model];
  if (model === "none") return 0;
  const cached = s.caching && f.cacheable ? f.inputTokens * s.cacheShare : 0;
  const fresh = f.inputTokens - cached;
  let usd = (fresh * m.input + cached * m.cacheRead + f.outputTokens * m.output) / 1_000_000;
  if (s.batching && f.batchable) usd *= 0.5;
  return usd;
}

/** Cost of this feature for one user per month. Features without a model yet cost 0. */
export function featureMonthly(f: Feature, s: Settings, model: ModelId | null = f.model): number {
  if (!model) return 0;
  return callCost(f, model, s) * f.callsPerUserMonth;
}

export type Summary = {
  freeUserCost: number;
  premiumUserCost: number;
  premiumMargin: number;
  premiumMarginPct: number;
  premiumPerHundredFree: number | null; // premium users needed to cover 100 free users
  freeUsers: number;
  premiumUsers: number;
  monthlyBill: number;
  monthlyRevenue: number;
  monthlyProfit: number;
  unpricedFeatures: number;
  warnings: { level: "warn" | "bad"; text: string }[];
  evalList: Feature[]; // planned LLM features where a wrong answer does real harm
  naiveMonthlyBill: number; // same plan with every LLM feature on Opus, no caching/batching
};

export function summarize(features: Feature[], s: Settings): Summary {
  const free = features.filter((f) => f.tier === "free");
  const premium = features.filter((f) => f.tier === "premium");

  const freeUserCost = free.reduce((sum, f) => sum + featureMonthly(f, s), 0);
  const premiumUserCost = freeUserCost + premium.reduce((sum, f) => sum + featureMonthly(f, s), 0);
  const premiumMargin = s.premiumPrice - premiumUserCost;
  const premiumMarginPct = s.premiumPrice > 0 ? premiumMargin / s.premiumPrice : 0;
  const premiumPerHundredFree = premiumMargin > 0 ? (100 * freeUserCost) / premiumMargin : null;

  const premiumUsers = Math.round(s.users * s.premiumShare);
  const freeUsers = s.users - premiumUsers;
  const monthlyBill = freeUsers * freeUserCost + premiumUsers * premiumUserCost;
  const monthlyRevenue = premiumUsers * s.premiumPrice;

  const plain: Settings = { ...s, caching: false, batching: false };
  const naive = (fs: Feature[]) =>
    fs.reduce((sum, f) => sum + (f.needsLLM ? featureMonthly(f, plain, "claude-opus-5-5") : 0), 0);
  const naiveFree = naive(free);
  const naivePremium = naiveFree + naive(premium);
  const naiveMonthlyBill = freeUsers * naiveFree + premiumUsers * naivePremium;

  const unpricedFeatures = [...free, ...premium].filter((f) => !f.model).length;

  const L = LABELS[s.mode];
  const planned = [...free, ...premium];
  const warnings: Summary["warnings"] = [];

  for (const f of planned) {
    if (f.riskIfWrong === "high" && f.model === "claude-haiku-4-5") {
      warnings.push({ level: "bad", text: `"${f.name}" is high-risk if wrong but runs on Haiku. Prove it with evals first, or use a stronger model.` });
    }
    if (f.model === "none" && f.needsLLM) {
      warnings.push({ level: "warn", text: `"${f.name}" is set to No LLM but needs language understanding. Check it still works.` });
    }
    if (f.model && f.model !== "none" && !f.needsLLM) {
      warnings.push({ level: "warn", text: `"${f.name}" doesn't need an LLM. Plain code would do it for $0.` });
    }
    if (f.customerValue <= 2 && featureMonthly(f, s) >= 0.25) {
      warnings.push({ level: "warn", text: `"${f.name}" costs ${usd(featureMonthly(f, s))} per ${L.user} for little customer value. Cut it or simplify.` });
    }
  }
  for (const f of free) {
    if (f.model === "claude-fable-5-1" || f.model === "claude-opus-5-5") {
      warnings.push({
        level: "warn",
        text: `${MODEL_BY_ID[f.model].short} in ${L.free} ("${f.name}") costs ${usd(featureMonthly(f, s))} for every ${L.user}, paying or not.`,
      });
    }
  }
  for (const f of features) {
    if ((f.tier === "unassigned" || f.tier === "later") && f.customerValue >= 5) {
      warnings.push({ level: "warn", text: `"${f.name}" is a reason to buy (value 5) but isn't in a plan yet.` });
    }
  }
  if (planned.length > 0 && premiumMargin < 0) {
    warnings.push({ level: "bad", text: `${L.premium} loses ${usd(-premiumMargin)} per ${L.user} each month. Raise the price or use cheaper models.` });
  } else if (premium.length > 0 && premiumMarginPct < 0.7) {
    warnings.push({ level: "warn", text: `${L.premium} gross margin is ${Math.round(premiumMarginPct * 100)}%. SaaS usually aims for 70–80%+.` });
  }
  if (s.mode === "consumer" && freeUserCost > 0.5) {
    warnings.push({ level: "bad", text: `Each free user costs ${usd(freeUserCost)}/month. Free tiers usually need to stay in cents.` });
  }
  if (s.mode === "b2b" && freeUserCost > 2) {
    warnings.push({ level: "warn", text: `${L.free} AI costs ${usd(freeUserCost)} per seat each month. Check the base licence price covers it.` });
  }

  const evalList = planned.filter((f) => f.needsLLM && f.riskIfWrong !== "low");

  return {
    freeUserCost,
    premiumUserCost,
    premiumMargin,
    premiumMarginPct,
    premiumPerHundredFree,
    freeUsers,
    premiumUsers,
    monthlyBill,
    monthlyRevenue,
    monthlyProfit: monthlyRevenue - monthlyBill,
    unpricedFeatures,
    warnings,
    evalList,
    naiveMonthlyBill,
  };
}

export function usd(n: number): string {
  const abs = Math.abs(n);
  const digits = abs === 0 ? 2 : abs < 0.01 ? 4 : abs < 1 ? 3 : 2;
  return (n < 0 ? "-" : "") + "$" + abs.toLocaleString("en-US", { minimumFractionDigits: digits, maximumFractionDigits: digits });
}
