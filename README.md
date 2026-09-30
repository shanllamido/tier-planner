# Tier Planner

Plan an AI product's Free and Premium tiers and see the Claude model costs live.

1. **Describe the app.** One call to Claude turns the idea into 8–14 features with usage estimates.
2. **Drag features** into Free, Premium or Not now.
3. **Drag a Claude model** (or "No LLM") onto each feature. Cost per user, Premium margin, break-even and the monthly bill update as you go.

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
