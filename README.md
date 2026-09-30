# Tier Planner

Decide what goes into an AI product and how to sell it: **value first, then quality, then cost.**

1. **Describe the customer, their problem and the product**, and pick a business model (B2B per seat, or consumer freemium). One call to Claude turns it into 8–14 features, each with a customer-value score (1–5), a risk-if-wrong rating and usage estimates.
2. **Drag features** into the plans: Core / AI Add-on for B2B, or Free / Premium for consumer.
3. **Drag a Claude model** (or "No LLM") onto each feature. Cost per seat, add-on margin and the monthly bill update as you go.
4. **Check** the value-vs-cost chart (quick wins, worth paying for, cut or simplify) and the list of features that need evals and human review before launch.

## Design choices

- **One LLM call, then plain code.** Only the feature list comes from Claude. Tiers, models and pricing are computed in the browser, so using the board costs nothing.
- **Structured outputs.** The call uses a JSON schema (`output_config.format`), and the result is validated again with Zod.
- **Low effort.** Claude Opus 5.5 at `effort: "low"`: a planning list doesn't need deep reasoning.
- **Cache-friendly prompt.** The system prompt is frozen (no dates or per-request data), so it can be cached.
- **Server-side fallback.** `fallbacks: "default"` retries a rare refusal on a fallback model.
- **Honest cost model.** Per feature: calls × (fresh input × input price + cached input × cache-read price + output × output price), with 50% off for batchable features on the Batch API. Prices live in [`src/lib/models.ts`](src/lib/models.ts).

## Run locally

```bash
npm install
echo "ANTHROPIC_API_KEY=sk-ant-..." > .env.local
npm run dev
```

Without a key, "Load example" still works; only "Generate features" needs the API.

## Stack

Next.js 16 (App Router), React 19, Tailwind CSS 4, @dnd-kit/core, Anthropic TypeScript SDK, Zod. Deployed on Vercel.

Built with Claude Code.
