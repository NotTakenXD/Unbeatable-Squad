// One-tap account for trade workers: no email, no password, no form.
//
// Creates a confirmed account with a random, unguessable login and returns it
// to the browser, which signs in and keeps the login on this device. Workers
// can add a real email later from their profile to recover the account.
//
// Abuse protection: at most 5 accounts per IP address per hour.
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, "Content-Type": "application/json" } });

function randomSecret(bytes: number) {
  const buf = crypto.getRandomValues(new Uint8Array(bytes));
  return btoa(String.fromCharCode(...buf)).replace(/[+/=]/g, "").slice(0, bytes);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

  const ip = (req.headers.get("x-forwarded-for") ?? "").split(",")[0].trim() || "unknown";
  const { data: allowed, error: rateError } = await admin.rpc("take_rate_token", {
    p_key: `quick-start:${ip}`,
    p_limit: 5,
    p_window_seconds: 3600,
  });
  if (rateError) return json({ error: "Please try again in a moment" }, 500);
  if (!allowed) return json({ error: "Too many new accounts from this network. Try again later." }, 429);

  const email = `worker-${randomSecret(12).toLowerCase()}@device.roshanrozgar.app`;
  const password = randomSecret(32);
  const { error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { device_account: true },
  });
  if (error) return json({ error: "Could not create account" }, 500);

  return json({ email, password });
});
