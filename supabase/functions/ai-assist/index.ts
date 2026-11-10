// AI understanding of what a user *said* (speech-to-text output).
//
// Tasks:
//  - "worker_profile": a worker describes themselves by voice -> structured profile
//  - "job_request":    a customer describes a job by voice      -> structured job
//
// Speech recognition output is messy: Urdu script, Roman Urdu, English and
// mixtures, with recognition mistakes ("G gyarah" = G-11, "paanch saal" = 5
// years, "do hazaar" = 2000). Claude normalises it into the fields the app
// needs. The browser falls back to simple keyword rules if this function is
// unavailable, and the user always reviews the result before saving.
//
// Security: requires a signed-in user (verify_jwt), caps input length, and
// rate-limits each user so the API key can't be abused.
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import Anthropic from "npm:@anthropic-ai/sdk";
import { createClient } from "npm:@supabase/supabase-js@2";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, "Content-Type": "application/json" } });

const SERVICES = ["electrician", "plumber", "carpenter", "ac-tech"];
const nullable = (schema: Record<string, unknown>) => ({ anyOf: [schema, { type: "null" }] });
const str = { type: "string" };
const int = { type: "integer" };
const strList = { type: "array", items: str };

const SCHEMAS = {
  worker_profile: {
    type: "object",
    properties: {
      name: nullable(str),
      service: nullable({ type: "string", enum: SERVICES }),
      years_experience: nullable(int),
      area: nullable(str),
      service_areas: strList,
      skills: strList,
      hourly_rate: nullable(int),
      fixed_rate_from: nullable(int),
      bio: str,
      summary_ur: str,
    },
    required: [
      "name", "service", "years_experience", "area", "service_areas", "skills",
      "hourly_rate", "fixed_rate_from", "bio", "summary_ur",
    ],
    additionalProperties: false,
  },
  job_request: {
    type: "object",
    properties: {
      title: str,
      description: str,
      service: nullable({ type: "string", enum: SERVICES }),
      area: nullable(str),
      budget: nullable(int),
      urgency: { type: "string", enum: ["now", "today", "tomorrow", "this_week", "flexible"] },
      summary_ur: str,
    },
    required: ["title", "description", "service", "area", "budget", "urgency", "summary_ur"],
    additionalProperties: false,
  },
} as const;

type Task = keyof typeof SCHEMAS;

const SYSTEM = `You help Roshan Rozgar, a marketplace in Islamabad and Rawalpindi (Pakistan) that connects households with skilled trade workers (electricians, plumbers, carpenters, AC technicians). Many workers cannot read or type comfortably, so they speak instead.

You receive the raw output of browser speech recognition. It may be Urdu script, Roman Urdu, English, or a mix, and it often contains recognition mistakes. Work out what the speaker meant and fill in the requested fields.

Rules:
- Only use information the speaker actually gave. Use null (or an empty list) for anything not said. Never invent names, prices or experience.
- Islamabad sectors are a letter D–I plus a number, e.g. "G gyarah", "جی گیارہ", "g11", "G 11" all mean "G-11"; "F aath" means "F-8". Write them as LETTER-NUMBER. Rawalpindi places (Saddar, Satellite Town, Bahria Town, etc.) stay as names.
- Convert spoken numbers: "paanch saal" = 5 years, "do hazaar" = 2000, "dedh hazaar" = 1500, "dhai hazaar" = 2500, "پانچ سو" = 500. Rates and budgets are in Pakistani rupees.
- Map the trade to one of: electrician (bijli, wiring, UPS, solar), plumber (nalka, pipe, leak, geyser), carpenter (lakri, furniture, darwaza), ac-tech (AC, split, gas refill, inverter AC).
- Skills are short English labels (e.g. "Wiring", "UPS & Solar", "Leak Repair").
- bio / description: one or two plain, polite English sentences a customer can read.
- summary_ur: one short sentence in simple Urdu script confirming what you understood, so the app can read it aloud to the user.`;

const PROMPTS: Record<Task, string> = {
  worker_profile: "A worker described themselves for their profile. Extract their profile.",
  job_request: "A customer described a job they need done. Extract the job request. The title is a short English summary (max 8 words).",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const apiKey = Deno.env.get("ANTHROPIC_API_KEY");
  if (!apiKey) return json({ error: "ai_unavailable" }, 503);

  // Who is calling? (verify_jwt already rejected missing/invalid tokens)
  const authHeader = req.headers.get("Authorization") ?? "";
  const userClient = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: userData } = await userClient.auth.getUser();
  const userId = userData.user?.id;
  if (!userId) return json({ error: "Please sign in" }, 401);

  let body: { task?: string; text?: string };
  try {
    body = await req.json();
  } catch {
    return json({ error: "Invalid JSON" }, 400);
  }
  const task = body.task as Task;
  const text = typeof body.text === "string" ? body.text.trim() : "";
  if (!(task in SCHEMAS)) return json({ error: "Unknown task" }, 400);
  if (!text) return json({ error: "Nothing was said" }, 400);
  if (text.length > 2000) return json({ error: "Too long — please keep it under a minute" }, 413);

  // 40 AI calls per user per hour.
  const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const { data: allowed, error: rateError } = await admin.rpc("take_rate_token", {
    p_key: `ai:${userId}`,
    p_limit: 40,
    p_window_seconds: 3600,
  });
  if (rateError) return json({ error: "Rate limiter unavailable" }, 500);
  if (!allowed) return json({ error: "Too many requests — try again later" }, 429);

  const client = new Anthropic({ apiKey });
  try {
    const response = await client.beta.messages.create({
      model: "claude-opus-5-5",
      max_tokens: 4000,
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      output_config: {
        effort: "low",
        format: { type: "json_schema", schema: SCHEMAS[task] },
      },
      system: SYSTEM,
      messages: [
        {
          role: "user",
          content: `${PROMPTS[task]}\n\n<speech>\n${text}\n</speech>`,
        },
      ],
    } as Anthropic.Beta.MessageCreateParamsNonStreaming);

    if (response.stop_reason === "refusal") return json({ error: "ai_declined" }, 422);
    const block = response.content.find((b) => b.type === "text");
    if (!block || block.type !== "text") return json({ error: "No answer" }, 502);
    return json({ task, result: JSON.parse(block.text) });
  } catch (error) {
    if (error instanceof Anthropic.RateLimitError) return json({ error: "AI busy — try again" }, 429);
    if (error instanceof Anthropic.APIError) return json({ error: `AI error ${error.status}` }, 502);
    return json({ error: "AI request failed" }, 502);
  }
});
