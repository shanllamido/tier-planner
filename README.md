# Tier Planner

Decide what goes into an AI product and how to sell it: **value first, then quality, then cost.**

1. **Start from the brief:** who pays, the problem they have today, and what the product changes. Pick a business model (B2B per seat, or consumer freemium). The example plan's features were drafted by Claude from the brief, each with a customer-value score (1–5), a risk-if-wrong rating and usage estimates.
2. **Drag features** into the plans: Core / AI Add-on for B2B, or Free / Premium for consumer.
3. **Drag a Claude model** (or "No LLM") onto each feature. Cost per seat, add-on margin and the monthly bill update as you go.
4. **Check** the value-vs-cost chart (quick wins, worth paying for, cut or simplify) and the list of features that need evals and human review before launch.

## Design choices

- **No LLM calls at runtime.** Everything on the page (tiers, models, pricing, the value-vs-cost chart) is computed in the browser, so the public demo costs nothing to run and needs no API key.
- **How the features were drafted.** One call to Claude Opus 5.5 at `effort: "low"` with a JSON schema (structured outputs), a frozen and cacheable system prompt, and server-side fallback. The schema is in [`src/lib/schema.ts`](src/lib/schema.ts); the live generator was removed from the public site.
- **Honest cost model.** Per feature: calls × (fresh input × input price + cached input × cache-read price + output × output price), with 50% off for batchable features on the Batch API. Prices live in [`src/lib/models.ts`](src/lib/models.ts).

## Run locally

```bash
npm install
npm run dev
```

## Stack

Next.js 16 (App Router), React 19, Tailwind CSS 4, @dnd-kit/core, Zod. Deployed on Vercel.

Built with Claude Code.
