"use client";

import { useState } from "react";
import { LABELS, featureMonthly, usd, type Feature, type Settings } from "@/lib/cost";
import { MODEL_BY_ID } from "@/lib/models";

const W = 640;
const H = 314;
const PAD = { l: 44, r: 16, t: 30, b: 34 };
const ZERO_BAND = 44; // "$0" features sit in their own band on the left
const MIN_LOG = -3; // $0.001
const MAX_LOG = 1; // $10
const COST_SPLIT = 0.1; // quadrant line: $0.10 per user per month
const VALUE_SPLIT = 3.5;

const TIER_COLOR = { free: "#059669", premium: "#4f46e5" } as const;

function x(cost: number): number {
  const left = PAD.l + ZERO_BAND;
  if (cost <= 0) return PAD.l + ZERO_BAND / 2;
  const t = (Math.min(Math.max(Math.log10(cost), MIN_LOG), MAX_LOG) - MIN_LOG) / (MAX_LOG - MIN_LOG);
  return left + t * (W - PAD.r - left);
}

function y(value: number): number {
  return PAD.t + ((5 - value) / 4) * (H - PAD.t - PAD.b);
}

type Point = { f: Feature; cost: number; cx: number; cy: number; suggested: boolean };

export function ValueMatrix({ features, settings }: { features: Feature[]; settings: Settings }) {
  const [hover, setHover] = useState<Point | null>(null);
  const L = LABELS[settings.mode];

  // Features without a model yet are placed by their suggested model.
  const seen = new Map<string, number>();
  const points: Point[] = features.map((f) => {
    const model = f.model ?? f.suggestedModel;
    const cost = featureMonthly(f, settings, model);
    const key = `${Math.round(x(cost) / 6)}:${f.customerValue}`;
    const n = seen.get(key) ?? 0;
    seen.set(key, n + 1);
    // Spread points that land on the same spot.
    const offset = n === 0 ? 0 : (n % 2 ? 1 : -1) * Math.ceil(n / 2) * 11;
    return { f, cost, cx: x(cost) + offset, cy: y(f.customerValue), suggested: !f.model };
  });

  const splitX = x(COST_SPLIT);
  const splitY = y(VALUE_SPLIT);
  const ticks = [0.01, 0.1, 1, 10];

  return (
    <section className="mt-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="flex items-center gap-2 text-sm font-semibold text-slate-900">
          <span className="grid h-5 w-5 place-items-center rounded-full bg-indigo-600 text-[11px] text-white">4</span>
          Check: customer value vs. cost
        </h2>
        <div className="flex flex-wrap items-center gap-3 text-[11px] text-slate-600">
          <Legend color={TIER_COLOR.free} label={L.free} />
          <Legend color={TIER_COLOR.premium} label={L.premium} />
          <Legend hollow label="Backlog / not now" />
        </div>
      </div>
      <p className="mt-1 text-xs text-slate-500">
        Each dot is a feature: value to the paying customer (1–5) against LLM cost per {L.user} per month. Hover a dot for the reasoning.
      </p>

      <div className="relative mt-2">
        <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="img" aria-label="Scatter chart of customer value against cost per user">
          {/* quadrant shading and labels */}
          <rect x={PAD.l} y={PAD.t} width={splitX - PAD.l} height={splitY - PAD.t} fill="#ecfdf5" />
          <rect x={splitX} y={splitY} width={W - PAD.r - splitX} height={H - PAD.b - splitY} fill="#fff1f2" />
          <QuadLabel x={PAD.l + 6} y={PAD.t - 10} text="Quick wins" />
          <QuadLabel x={W - PAD.r - 6} y={PAD.t - 10} text="Worth paying for" end />
          <QuadLabel x={PAD.l + 6} y={H - PAD.b - 6} text="Nice extras" />
          <QuadLabel x={W - PAD.r - 6} y={H - PAD.b - 6} text="Cut or simplify" end />

          {/* grid */}
          {[1, 2, 3, 4, 5].map((v) => (
            <g key={v}>
              <line x1={PAD.l} x2={W - PAD.r} y1={y(v)} y2={y(v)} stroke="#e2e8f0" strokeWidth={1} />
              <text x={PAD.l - 8} y={y(v) + 3.5} textAnchor="end" fontSize={10} fill="#64748b">{v}</text>
            </g>
          ))}
          <line x1={PAD.l + ZERO_BAND} x2={PAD.l + ZERO_BAND} y1={PAD.t} y2={H - PAD.b} stroke="#e2e8f0" strokeDasharray="3 3" />
          <line x1={splitX} x2={splitX} y1={PAD.t} y2={H - PAD.b} stroke="#94a3b8" strokeDasharray="4 3" />
          <line x1={PAD.l} x2={W - PAD.r} y1={splitY} y2={splitY} stroke="#94a3b8" strokeDasharray="4 3" />

          <text x={PAD.l + ZERO_BAND / 2} y={H - PAD.b + 14} textAnchor="middle" fontSize={10} fill="#64748b">$0</text>
          {ticks.map((t) => (
            <text key={t} x={x(t)} y={H - PAD.b + 14} textAnchor="middle" fontSize={10} fill="#64748b">
              ${t}
            </text>
          ))}
          <text x={(W + PAD.l) / 2} y={H - 4} textAnchor="middle" fontSize={10} fill="#475569">
            LLM cost per {L.user} per month (log scale)
          </text>
          <text x={12} y={(H - PAD.b + PAD.t) / 2} textAnchor="middle" fontSize={10} fill="#475569" transform={`rotate(-90 12 ${(H - PAD.b + PAD.t) / 2})`}>
            Customer value
          </text>

          {points.map((p) => {
            const planned = p.f.tier === "free" || p.f.tier === "premium";
            const color = planned ? TIER_COLOR[p.f.tier as "free" | "premium"] : "#64748b";
            return (
              <g key={p.f.id}>
                <circle
                  cx={p.cx}
                  cy={p.cy}
                  r={6}
                  fill={planned ? color : "#fff"}
                  stroke={planned ? "#fff" : color}
                  strokeWidth={planned ? 2 : 1.5}
                  strokeDasharray={p.suggested ? "2 2" : undefined}
                />
                {p.f.riskIfWrong === "high" && p.f.needsLLM && (
                  <text x={p.cx} y={p.cy - 9} textAnchor="middle" fontSize={9} fontWeight={700} fill="#be123c">!</text>
                )}
                {/* larger invisible hit target */}
                <circle
                  cx={p.cx}
                  cy={p.cy}
                  r={12}
                  fill="transparent"
                  onMouseEnter={() => setHover(p)}
                  onMouseLeave={() => setHover(null)}
                  onFocus={() => setHover(p)}
                  onBlur={() => setHover(null)}
                  tabIndex={0}
                  aria-label={`${p.f.name}: value ${p.f.customerValue}, ${usd(p.cost)} per ${L.user} per month`}
                />
              </g>
            );
          })}
        </svg>

        {hover && (
          <div
            className="pointer-events-none absolute z-10 w-60 -translate-x-1/2 rounded-lg border border-slate-200 bg-white p-2.5 text-xs shadow-lg"
            style={{ left: `${(hover.cx / W) * 100}%`, top: `${(hover.cy / H) * 100}%`, transform: "translate(-50%, 14px)" }}
          >
            <p className="font-semibold text-slate-900">{hover.f.name}</p>
            <p className="mt-0.5 text-slate-600">
              Value {hover.f.customerValue}/5 · {usd(hover.cost)}/{L.user}/mo on {MODEL_BY_ID[hover.f.model ?? hover.f.suggestedModel].short}
              {hover.suggested ? " (suggested)" : ""}
            </p>
            <p className="mt-1 text-slate-700">{hover.f.valueReason}</p>
            {hover.f.needsLLM && hover.f.riskIfWrong !== "low" && (
              <p className="mt-1 text-rose-700">Risk ({hover.f.riskIfWrong}): {hover.f.riskNote}</p>
            )}
          </div>
        )}
      </div>
      <p className="mt-1 text-[11px] text-slate-500">
        <b className="text-rose-700">!</b> = high risk if wrong · dashed outline = no model chosen yet (placed by the suggested model)
      </p>
    </section>
  );
}

function Legend({ color, label, hollow }: { color?: string; label: string; hollow?: boolean }) {
  return (
    <span className="flex items-center gap-1.5">
      <svg width="12" height="12" aria-hidden>
        <circle cx="6" cy="6" r="4.5" fill={hollow ? "#fff" : color} stroke={hollow ? "#64748b" : "none"} strokeWidth={1.5} />
      </svg>
      {label}
    </span>
  );
}

function QuadLabel({ x, y, text, end }: { x: number; y: number; text: string; end?: boolean }) {
  return (
    <text x={x} y={y} textAnchor={end ? "end" : "start"} fontSize={10} fontWeight={600} fill="#64748b">
      {text}
    </text>
  );
}
