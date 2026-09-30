import { z } from "zod";

const MODEL_IDS = ["none", "claude-haiku-4-5", "claude-sonnet-5-5", "claude-opus-5-5", "claude-fable-5-1"] as const;

export const GeneratedFeature = z.object({
  name: z.string().min(1).max(60),
  description: z.string().max(240),
  needsLLM: z.boolean(),
  callsPerUserMonth: z.number().int().min(0).max(100000),
  inputTokens: z.number().int().min(0).max(1000000),
  outputTokens: z.number().int().min(0).max(128000),
  cacheable: z.boolean(),
  batchable: z.boolean(),
  suggestedModel: z.enum(MODEL_IDS),
  rationale: z.string().max(240),
});

export const GeneratedPlan = z.object({
  appName: z.string().max(60),
  features: z.array(GeneratedFeature).min(1).max(20),
});

export type GeneratedPlan = z.infer<typeof GeneratedPlan>;

// JSON schema sent to Claude as a structured output (all fields required, no extras).
export const PLAN_JSON_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["appName", "features"],
  properties: {
    appName: { type: "string", description: "Short product name, max 5 words" },
    features: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: [
          "name",
          "description",
          "needsLLM",
          "callsPerUserMonth",
          "inputTokens",
          "outputTokens",
          "cacheable",
          "batchable",
          "suggestedModel",
          "rationale",
        ],
        properties: {
          name: { type: "string", description: "2-5 words" },
          description: { type: "string", description: "One sentence, what the user gets" },
          needsLLM: { type: "boolean", description: "False if plain code, rules or a database can do it" },
          callsPerUserMonth: { type: "integer", description: "LLM calls one active user triggers per month; 0 if needsLLM is false" },
          inputTokens: { type: "integer", description: "Typical input tokens per call, including system prompt and context" },
          outputTokens: { type: "integer", description: "Typical output tokens per call, including reasoning" },
          cacheable: { type: "boolean", description: "True if most of the input is a stable prefix (system prompt, reference docs) that prompt caching can reuse" },
          batchable: { type: "boolean", description: "True if results can arrive minutes later, so the Batch API applies" },
          suggestedModel: { type: "string", enum: [...MODEL_IDS] },
          rationale: { type: "string", description: "One short sentence on why this model" },
        },
      },
    },
  },
} as const;
