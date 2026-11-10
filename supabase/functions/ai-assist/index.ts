// AI understanding of what a user *said* (speech-to-text output), using
// Google Gemini (free tier).
//
// Tasks:
//  - "worker_profile": a worker describes themselves by voice -> structured profile
//  - "job_request":    a customer describes a job by voice      -> structured job
//
// Speech recognition output is messy: Urdu script, Roman Urdu, English and
// mixtures, with recognition mistakes ("G gyarah" = G-11, "paanch saal" = 5
// years, "do hazaar" = 2000). Gemini normalises it into the fields the app
// needs. The browser falls back to simple keyword rules if this function is
// unavailable, and the user always reviews the result before saving.
//
// Security: requires a signed-in user (verify_jwt), caps input length, and
// rate-limits each user so the API key can't be abused. The key is read from
// the GEMINI_API_KEY secret and never reaches the browser.
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const MODEL = "gemini-3.6-flash";
const ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`;

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, "Content-Type": "application/json" } });

const SERVICES = ["electrician", "plumber", "carpenter", "ac-tech"];
const str = { type: "string" };
const strOrNull = { type: ["string", "null"] };
const intOrNull = { type: ["integer", "null"] };
const strList = { type: "array", items: str };
const serviceOrNull = { type: ["string", "null"], enum: [...SERVICES, null] };

const SCHEMAS = {
  worker_profile: {
    type: "object",
    properties: {
      name: strOrNull,
      service: serviceOrNull,
      years_experience: intOrNull,
      area: strOrNull,
      service_areas: strList,
      skills: strList,
      hourly_rate: intOrNull,
      fixed_rate_from: intOrNull,
      bio: str,
      summary_ur: str,
    },
    required: [
      "name", "service", "years_experience", "area", "service_areas", "skills",
      "hourly_rate", "fixed_rate_from", "bio", "summary_ur",
    ],
  },
  job_request: {
    type: "object",
    properties: {
      title: str,
      description: str,
      service: serviceOrNull,
      area: strOrNull,
      budget: intOrNull,
      urgency: { type: "string", enum: ["now", "today", "tomorrow", "this_week", "flexible"] },
      summary_ur: str,
    },
    required: ["title", "description", "service", "area", "budget", "urgency", "summary_ur"],
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
  job_request:
    "A customer described a job they need done. Extract the job request. The title is a short English summary (max 8 words).",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const apiKey = Deno.env.get("GEMINI_API_KEY");
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

  let response: Response;
  try {
    response = await fetch(ENDPOINT, {
      method: "POST",
      headers: { "x-goog-api-key": apiKey, "Content-Type": "application/json" },
      body: JSON.stringify({
        system_instruction: { parts: [{ text: SYSTEM }] },
        contents: [{ role: "user", parts: [{ text: `${PROMPTS[task]}\n\n<speech>\n${text}\n</speech>` }] }],
        generationConfig: {
          thinkingConfig: { thinkingLevel: "low" },
          responseFormat: { text: { mimeType: "APPLICATION_JSON", schema: SCHEMAS[task] } },
        },
      }),
    });
  } catch {
    return json({ error: "AI request failed" }, 502);
  }

  if (response.status === 429) return json({ error: "AI busy — try again in a minute" }, 429);
  if (!response.ok) {
    const detail = (await response.text()).slice(0, 300);
    console.error("Gemini error", response.status, detail);
    return json({ error: `AI error ${response.status}` }, 502);
  }

  const data = await response.json();
  const candidate = data?.candidates?.[0];
  if (!candidate || candidate.finishReason === "SAFETY") return json({ error: "ai_declined" }, 422);
  // Skip any "thought" parts; join the answer text.
  const answer = (candidate.content?.parts ?? [])
    .filter((p: { thought?: boolean; text?: string }) => !p.thought && typeof p.text === "string")
    .map((p: { text: string }) => p.text)
    .join("");
  try {
    return json({ task, result: JSON.parse(answer) });
  } catch {
    console.error("Unparseable AI answer", answer.slice(0, 300));
    return json({ error: "AI answer was not valid" }, 502);
  }
});
