import { createClient } from "@supabase/supabase-js";
import type { Database } from "./database.types";

const url = import.meta.env.VITE_SUPABASE_URL;
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

if (!url || !key) {
  throw new Error(
    "Missing Supabase settings. Add VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY to .env",
  );
}

/**
 * If the user arrived from an email link that failed (already used, expired,
 * or opened twice by an email scanner), Supabase puts the reason in the URL.
 * Read it before the client starts, then clean the URL so a refresh doesn't
 * show it again.
 */
function readAuthLinkError(): string | null {
  const params = new URLSearchParams(
    window.location.hash.slice(1) || window.location.search.slice(1),
  );
  const code = params.get("error_code") ?? params.get("error");
  if (!code) return null;
  window.history.replaceState(null, "", window.location.pathname);
  if (code === "otp_expired" || code === "access_denied") {
    return "This confirmation link was already used or has expired. If you already confirmed your email, just sign in. If not, sign in and tap “Resend confirmation email”.";
  }
  return params.get("error_description")?.replace(/\+/g, " ") ?? "That email link didn't work. Please sign in to try again.";
}

export const authLinkError = readAuthLinkError();

export const supabase = createClient<Database>(url, key, {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
});
