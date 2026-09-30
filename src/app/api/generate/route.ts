import Anthropic from "@anthropic-ai/sdk";
import { GeneratedPlan, PLAN_JSON_SCHEMA } from "@/lib/schema";
import { MODEL_BY_ID } from "@/lib/models";

export const maxDuration = 60;

const MODEL = "claude-opus-5-5";

// Frozen system prompt: no dates or per-request data, so it stays cacheable.
const SYSTEM = `You are a senior AI product manager. The user describes an app idea. Break it into 8-14 concrete product features a v1-v2 roadmap would contain.

Be honest about where an LLM is actually needed. Login, billing, dashboards, search filters, calculations, reminders and CRUD need no LLM (needsLLM false, callsPerUserMonth 0, tokens 0, suggestedModel "none"). Aim for roughly a third of features to need no LLM.

For LLM features, estimate realistic usage for one active user per month and realistic tokens per call (system prompt and retrieved context count as input; reasoning counts as output). Suggest the cheapest model that would do the job well:
- claude-haiku-4-5: classification, extraction, routing, short replies
- claude-sonnet-5-5: drafting, summarising, tool-using agents, most chat
- claude-opus-5-5: hard multi-step reasoning, long documents, complex agents
- claude-fable-5-1: only for rare, high-value, long-horizon work

Keep names short and descriptions to one sentence. Write in English.`;

// Best-effort per-instance limit. Serverless instances don't share memory, so this only slows abuse.
const hits = new Map<string, number[]>();
function limited(ip: string): boolean {
  const now = Date.now();
  const recent = (hits.get(ip) ?? []).filter((t) => now - t < 10 * 60_000);
  recent.push(now);
  hits.set(ip, recent);
  return recent.length > 5;
}

export async function POST(request: Request) {
  if (!process.env.ANTHROPIC_API_KEY) {
    return Response.json({ error: "The live generator isn't configured yet. Load the example plan instead." }, { status: 503 });
  }

  const ip = request.headers.get("x-forwarded-for")?.split(",")[0].trim() ?? "local";
  if (limited(ip)) {
    return Response.json({ error: "Too many plans in a short time. Try again in a few minutes." }, { status: 429 });
  }

  let idea = "";
  try {
    idea = String((await request.json()).idea ?? "").trim();
  } catch {
    return Response.json({ error: "Invalid request." }, { status: 400 });
  }
  if (idea.length < 10) return Response.json({ error: "Describe the app in a sentence or two." }, { status: 400 });
  if (idea.length > 600) return Response.json({ error: "Keep the description under 600 characters." }, { status: 400 });

  const client = new Anthropic();
  const started = Date.now();

  try {
    const response = await client.beta.messages.create({
      model: MODEL,
      max_tokens: 16000,
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      output_config: { effort: "low", format: { type: "json_schema", schema: PLAN_JSON_SCHEMA } },
      system: SYSTEM,
      messages: [{ role: "user", content: `App idea: ${idea}` }],
    });

    if (response.stop_reason === "refusal") {
      return Response.json({ error: "Claude declined this request. Try describing the app differently." }, { status: 422 });
    }
    if (response.stop_reason === "max_tokens") {
      return Response.json({ error: "The plan came back incomplete. Try a shorter description." }, { status: 502 });
    }

    const text = response.content.flatMap((b) => (b.type === "text" ? [b.text] : [])).join("");
    const parsed = GeneratedPlan.safeParse(JSON.parse(text));
    if (!parsed.success) {
      return Response.json({ error: "The plan didn't match the expected format. Try again." }, { status: 502 });
    }

    const u = response.usage;
    const price = MODEL_BY_ID[MODEL];
    const cacheRead = u.cache_read_input_tokens ?? 0;
    const cacheWrite = u.cache_creation_input_tokens ?? 0;
    const inputTokens = u.input_tokens + cacheRead + cacheWrite;
    // Cache writes cost 1.25x input (5-minute cache); cache reads use the discounted rate.
    const cost =
      (u.input_tokens * price.input + cacheWrite * price.input * 1.25 + cacheRead * price.cacheRead + u.output_tokens * price.output) /
      1_000_000;

    return Response.json({
      plan: parsed.data,
      meta: {
        model: response.model,
        inputTokens,
        outputTokens: u.output_tokens,
        costUsd: cost,
        ms: Date.now() - started,
      },
    });
  } catch (error) {
    if (error instanceof Anthropic.RateLimitError) {
      return Response.json({ error: "Claude is busy right now. Try again in a minute." }, { status: 429 });
    }
    if (error instanceof Anthropic.AuthenticationError) {
      return Response.json({ error: "The server's API key is invalid." }, { status: 500 });
    }
    if (error instanceof Anthropic.APIError) {
      return Response.json({ error: `Claude API error (${error.status}).` }, { status: 502 });
    }
    if (error instanceof SyntaxError) {
      return Response.json({ error: "Claude returned invalid JSON. Try again." }, { status: 502 });
    }
    throw error;
  }
}
