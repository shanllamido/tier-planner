"use client";

import { usd, type Settings, type Summary } from "@/lib/cost";

type Props = {
  summary: Summary;
  settings: Settings;
  onSettings: (patch: Partial<Settings>) => void;
};

export function CostPanel({ summary: s, settings, onSettings }: Props) {
  const saved = s.naiveMonthlyBill - s.monthlyBill;
  const savedPct = s.naiveMonthlyBill > 0 ? saved / s.naiveMonthlyBill : 0;
  const marginTone = s.premiumMargin < 0 ? "text-rose-600" : s.premiumMarginPct < 0.7 ? "text-amber-600" : "text-emerald-600";

  return (
    <aside className="space-y-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div>
        <h2 className="text-sm font-semibold text-slate-900">Costs, live</h2>
        <p className="text-xs text-slate-500">LLM cost only, in USD per month.</p>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <Stat label="Free user" value={usd(s.freeUserCost)} />
        <Stat label="Premium user" value={usd(s.premiumUserCost)} />
        <Stat label="Premium margin" value={usd(s.premiumMargin)} sub={`${Math.round(s.premiumMarginPct * 100)}% gross`} tone={marginTone} />
        <Stat
          label="Premium per 100 free"
          value={s.premiumPerHundredFree === null ? "never" : s.premiumPerHundredFree.toFixed(1)}
          sub="to cover their LLM cost"
        />
      </div>

      <div className="space-y-2 rounded-xl bg-slate-50 p-3">
        <Row label="Premium price / user / mo">
          <input
            type="number"
            min={0}
            step={1}
            value={settings.premiumPrice}
            onChange={(e) => onSettings({ premiumPrice: Math.max(0, Number(e.target.value) || 0) })}
            className="w-20 rounded border border-slate-200 bg-white px-1.5 py-0.5 text-right text-xs tabular-nums"
          />
        </Row>
        <Row label="Monthly active users">
          <input
            type="number"
            min={0}
            step={100}
            value={settings.users}
            onChange={(e) => onSettings({ users: Math.max(0, Math.round(Number(e.target.value) || 0)) })}
            className="w-20 rounded border border-slate-200 bg-white px-1.5 py-0.5 text-right text-xs tabular-nums"
          />
        </Row>
        <Row label={`On premium: ${Math.round(settings.premiumShare * 100)}%`}>
          <input
            type="range"
            min={0}
            max={0.5}
            step={0.01}
            value={settings.premiumShare}
            onChange={(e) => onSettings({ premiumShare: Number(e.target.value) })}
            className="w-24 accent-indigo-600"
          />
        </Row>
        <Toggle
          label="Prompt caching"
          hint={`${Math.round(settings.cacheShare * 100)}% of input read from cache on cacheable features`}
          checked={settings.caching}
          onChange={(v) => onSettings({ caching: v })}
        />
        <Toggle label="Batch API" hint="50% off on batchable features" checked={settings.batching} onChange={(v) => onSettings({ batching: v })} />
      </div>

      <div className="space-y-1 text-xs">
        <Line label={`${s.freeUsers.toLocaleString()} free + ${s.premiumUsers.toLocaleString()} premium`} value="" />
        <Line label="LLM bill" value={usd(s.monthlyBill)} />
        <Line label="Premium revenue" value={usd(s.monthlyRevenue)} />
        <Line label="After LLM costs" value={usd(s.monthlyProfit)} strong tone={s.monthlyProfit < 0 ? "text-rose-600" : "text-emerald-700"} />
      </div>

      {s.naiveMonthlyBill > 0 && (
        <div className="rounded-xl border border-indigo-100 bg-indigo-50/60 p-3 text-xs text-indigo-900">
          <p className="font-semibold">vs. &ldquo;Opus for everything&rdquo;</p>
          <p className="mt-0.5">
            The same plan on Opus 5.5, without caching or batching, would cost <b>{usd(s.naiveMonthlyBill)}</b>/month.
            {saved > 0 ? (
              <> Your choices save <b>{usd(saved)}</b> ({Math.round(savedPct * 100)}%).</>
            ) : (
              <> Your choices cost more than that.</>
            )}
          </p>
        </div>
      )}

      {s.unpricedFeatures > 0 && (
        <p className="text-xs text-slate-500">
          {s.unpricedFeatures} feature{s.unpricedFeatures === 1 ? "" : "s"} in Free/Premium still need{s.unpricedFeatures === 1 ? "s" : ""} a model.
        </p>
      )}

      {s.warnings.length > 0 && (
        <ul className="space-y-1.5">
          {s.warnings.map((w, i) => (
            <li
              key={i}
              className={`rounded-lg px-2.5 py-1.5 text-xs ${w.level === "bad" ? "bg-rose-50 text-rose-800" : "bg-amber-50 text-amber-900"}`}
            >
              {w.text}
            </li>
          ))}
        </ul>
      )}
    </aside>
  );
}

function Stat({ label, value, sub, tone }: { label: string; value: string; sub?: string; tone?: string }) {
  return (
    <div className="rounded-xl border border-slate-100 p-2.5">
      <p className="text-[11px] text-slate-500">{label}</p>
      <p className={`text-lg font-semibold tabular-nums ${tone ?? "text-slate-900"}`}>{value}</p>
      {sub && <p className="text-[10px] text-slate-400">{sub}</p>}
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex items-center justify-between gap-2 text-xs text-slate-700">
      <span>{label}</span>
      {children}
    </label>
  );
}

function Toggle({ label, hint, checked, onChange }: { label: string; hint: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex items-start justify-between gap-2 text-xs text-slate-700">
      <span>
        {label}
        <span className="block text-[10px] text-slate-400">{hint}</span>
      </span>
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="mt-0.5 accent-indigo-600" />
    </label>
  );
}

function Line({ label, value, strong, tone }: { label: string; value: string; strong?: boolean; tone?: string }) {
  return (
    <div className="flex justify-between gap-2">
      <span className="text-slate-500">{label}</span>
      <span className={`tabular-nums ${strong ? "font-semibold" : ""} ${tone ?? "text-slate-800"}`}>{value}</span>
    </div>
  );
}
