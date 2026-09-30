"use client";

import { useDraggable, useDroppable } from "@dnd-kit/core";
import { useState } from "react";
import { callCost, featureMonthly, usd, type Feature, type Risk, type Settings, type Tier, LABELS } from "@/lib/cost";
import { MODELS, MODEL_BY_ID, type ModelId } from "@/lib/models";

type Props = {
  feature: Feature;
  settings: Settings;
  onChange: (patch: Partial<Feature>) => void;
  onRemove: () => void;
  overlay?: boolean;
  unit?: string;
};

function tierOptions(s: Settings): { value: Tier; label: string }[] {
  const L = LABELS[s.mode];
  return [
    { value: "unassigned", label: "Backlog" },
    { value: "free", label: L.free },
    { value: "premium", label: L.premium },
    { value: "later", label: "Not now" },
  ];
}

export function FeatureCard({ feature: f, settings, onChange, onRemove, overlay, unit = "user" }: Props) {
  const [open, setOpen] = useState(false);
  const drag = useDraggable({ id: `feature:${f.id}`, data: { kind: "feature", featureId: f.id } });
  const drop = useDroppable({ id: `slot:${f.id}`, data: { accepts: "model", featureId: f.id } });
  const model = f.model ? MODEL_BY_ID[f.model] : null;
  const monthly = featureMonthly(f, settings);
  const suggested = MODEL_BY_ID[f.suggestedModel];

  return (
    <div
      ref={
        overlay
          ? undefined
          : (node) => {
              drag.setNodeRef(node);
              drop.setNodeRef(node);
            }
      }
      className={`rounded-xl border bg-white p-3 shadow-sm transition ${drop.isOver ? "ring-2 ring-indigo-400" : ""} ${
        drag.isDragging && !overlay ? "opacity-30" : ""
      } ${overlay ? "rotate-1 shadow-xl ring-2 ring-indigo-300" : "border-slate-200"}`}
    >
      <div className="flex items-start gap-2">
        <button
          type="button"
          {...(overlay ? {} : drag.listeners)}
          {...(overlay ? {} : drag.attributes)}
          aria-label={`Drag ${f.name}`}
          className="mt-0.5 cursor-grab touch-none rounded p-0.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 active:cursor-grabbing"
        >
          <svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor" aria-hidden>
            <circle cx="4" cy="3" r="1.3" /><circle cx="10" cy="3" r="1.3" />
            <circle cx="4" cy="7" r="1.3" /><circle cx="10" cy="7" r="1.3" />
            <circle cx="4" cy="11" r="1.3" /><circle cx="10" cy="11" r="1.3" />
          </svg>
        </button>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <h4 className="text-sm font-semibold leading-snug text-slate-900">{f.name}</h4>
            <span
              className={`shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-medium ${
                f.needsLLM ? "bg-indigo-50 text-indigo-700" : "bg-slate-100 text-slate-500"
              }`}
            >
              {f.needsLLM ? "AI" : "no AI"}
            </span>
          </div>
          <p className="mt-1 text-xs leading-relaxed text-slate-600">{f.description}</p>
          <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1">
            <span className="flex items-center gap-1 text-[10px] text-slate-500" title={f.valueReason}>
              Value
              <span className="flex gap-0.5" aria-label={`Customer value ${f.customerValue} of 5`}>
                {[1, 2, 3, 4, 5].map((i) => (
                  <span key={i} className={`h-1.5 w-1.5 rounded-full ${i <= f.customerValue ? "bg-indigo-600" : "bg-slate-200"}`} />
                ))}
              </span>
            </span>
            {f.needsLLM && f.riskIfWrong !== "low" && (
              <span
                title={f.riskNote}
                className={`rounded-full px-1.5 py-0.5 text-[10px] font-medium ${
                  f.riskIfWrong === "high" ? "bg-rose-50 text-rose-700" : "bg-amber-50 text-amber-800"
                }`}
              >
                {f.riskIfWrong === "high" ? "High risk if wrong" : "Medium risk"}
              </span>
            )}
          </div>
        </div>
      </div>

      <div
        className={`mt-2.5 flex items-center justify-between gap-2 rounded-lg border border-dashed px-2 py-1.5 transition ${
          drop.isOver ? "border-indigo-400 bg-indigo-50" : model ? "border-transparent bg-slate-50" : "border-slate-300"
        }`}
      >
        {model ? (
          <span className={`rounded-md px-2 py-0.5 text-xs font-medium ring-1 ${model.tone}`}>{model.short}</span>
        ) : (
          <span className="text-xs text-slate-400">Drop a model here</span>
        )}
        <span className={`text-xs tabular-nums ${model ? "font-semibold text-slate-800" : "text-slate-400"}`}>
          {model ? `${usd(monthly)}/${unit}/mo` : "—"}
        </span>
      </div>

      <div className="mt-2 flex items-center justify-between">
        <button type="button" onClick={() => setOpen((o) => !o)} className="text-[11px] font-medium text-indigo-600 hover:underline">
          {open ? "Hide details" : "Details & usage"}
        </button>
        {f.needsLLM && f.model !== f.suggestedModel && (
          <button
            type="button"
            onClick={() => onChange({ model: f.suggestedModel })}
            className="text-[11px] text-slate-500 hover:text-slate-800"
            title={f.rationale}
          >
            Suggested: {suggested.short}
          </button>
        )}
      </div>

      {open && !overlay && (
        <div className="mt-2 space-y-2 border-t border-slate-100 pt-2 text-xs">
          <p className="text-slate-700"><b>Value:</b> {f.valueReason}</p>
          {f.needsLLM && <p className="text-slate-700"><b>If wrong:</b> {f.riskNote}</p>}
          <p className="text-slate-500"><b>Model:</b> {f.rationale}</p>
          <div className="grid grid-cols-2 gap-2">
            <label className="col-span-2 flex flex-col gap-0.5">
              <span className="text-slate-500">Tier</span>
              <select
                value={f.tier}
                onChange={(e) => onChange({ tier: e.target.value as Tier })}
                className="rounded border border-slate-200 bg-white px-1.5 py-1"
              >
                {tierOptions(settings).map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </label>
            <label className="col-span-2 flex flex-col gap-0.5">
              <span className="text-slate-500">Model</span>
              <select
                value={f.model ?? ""}
                onChange={(e) => onChange({ model: (e.target.value || null) as ModelId | null })}
                className="rounded border border-slate-200 bg-white px-1.5 py-1"
              >
                <option value="">Not chosen</option>
                {MODELS.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
              </select>
            </label>
            <label className="flex flex-col gap-0.5">
              <span className="text-slate-500">Customer value</span>
              <select
                value={f.customerValue}
                onChange={(e) => onChange({ customerValue: Number(e.target.value) })}
                className="rounded border border-slate-200 bg-white px-1.5 py-1"
              >
                {[5, 4, 3, 2, 1].map((v) => <option key={v} value={v}>{v} / 5</option>)}
              </select>
            </label>
            <label className="flex flex-col gap-0.5">
              <span className="text-slate-500">Risk if wrong</span>
              <select
                value={f.riskIfWrong}
                onChange={(e) => onChange({ riskIfWrong: e.target.value as Risk })}
                className="rounded border border-slate-200 bg-white px-1.5 py-1"
              >
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
              </select>
            </label>
            <NumberField label={`Calls / ${unit} / mo`} value={f.callsPerUserMonth} onChange={(v) => onChange({ callsPerUserMonth: v })} />
            <NumberField label="Input tokens / call" value={f.inputTokens} onChange={(v) => onChange({ inputTokens: v })} />
            <NumberField label="Output tokens / call" value={f.outputTokens} onChange={(v) => onChange({ outputTokens: v })} />
            <div className="flex flex-col justify-end gap-1">
              <label className="flex items-center gap-1.5">
                <input type="checkbox" checked={f.cacheable} onChange={(e) => onChange({ cacheable: e.target.checked })} />
                Cacheable
              </label>
              <label className="flex items-center gap-1.5">
                <input type="checkbox" checked={f.batchable} onChange={(e) => onChange({ batchable: e.target.checked })} />
                Batchable
              </label>
            </div>
          </div>
          {f.model && f.model !== "none" && (
            <p className="text-slate-500">
              {usd(callCost(f, f.model, settings))} per call × {f.callsPerUserMonth} calls
            </p>
          )}
          <button type="button" onClick={onRemove} className="text-rose-600 hover:underline">Remove feature</button>
        </div>
      )}
    </div>
  );
}

function NumberField({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
  return (
    <label className="flex flex-col gap-0.5">
      <span className="text-slate-500">{label}</span>
      <input
        type="number"
        min={0}
        value={value}
        onChange={(e) => onChange(Math.max(0, Math.round(Number(e.target.value) || 0)))}
        className="rounded border border-slate-200 px-1.5 py-1 tabular-nums"
      />
    </label>
  );
}
