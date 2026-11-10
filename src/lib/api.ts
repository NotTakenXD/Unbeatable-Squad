// All reads/writes to Supabase live here so screens stay simple.
import { supabase } from "./supabase";
import type { Enums, Tables } from "./database.types";

export type Profile = Tables<"profiles">;
export type WorkerProfile = Tables<"worker_profiles">;
export type Service = Tables<"services">;
export type Job = Tables<"jobs">;
export type Offer = Tables<"job_offers">;
export type Booking = Tables<"bookings">;
export type Message = Tables<"messages">;
export type BookingStatus = Enums<"booking_status">;

type PersonLite = { full_name: string | null; avatar_url: string | null };

export type WorkerListItem = WorkerProfile & {
  profile: (PersonLite & { city: string }) | null;
  service: Pick<Service, "name" | "icon"> | null;
};

export type WorkerDetail = WorkerListItem & {
  reviews: (Tables<"reviews"> & { customer: PersonLite | null })[];
  portfolio: Tables<"worker_portfolio">[];
};

export type OfferWithWorker = Offer & {
  worker: (Pick<WorkerProfile, "id" | "rating_avg" | "rating_count"> & { profile: PersonLite | null }) | null;
};

export type JobWithOffers = Job & {
  service: Pick<Service, "name" | "icon"> | null;
  offers: OfferWithWorker[];
};

export type JobListItem = Job & {
  service: Pick<Service, "name" | "icon"> | null;
  customer: PersonLite | null;
};

export type BookingItem = Booking & {
  job: Pick<Job, "title" | "description"> | null;
  customer: PersonLite | null;
  worker:
    | (Pick<WorkerProfile, "id"> & {
        profile: PersonLite | null;
        service: Pick<Service, "name"> | null;
      })
    | null;
};

export type MyOffer = Offer & { job: JobListItem | null };

type Result<T> = { data: T | null; error: { message: string } | null };

/** Unwraps a Supabase result, throwing on error. Use for queries that always return data. */
function check<T>(result: Result<T>): T {
  if (result.error) throw new Error(result.error.message);
  return result.data as T;
}

/** Like check() but for single-row lookups that may find nothing. */
function maybe<T>(result: Result<T>): T | null {
  if (result.error) throw new Error(result.error.message);
  return result.data;
}

async function uid() {
  const { data } = await supabase.auth.getSession();
  const id = data.session?.user.id;
  if (!id) throw new Error("Please sign in first");
  return id;
}

// ---------------------------------------------------------------- auth
export async function signUp(email: string, password: string, fullName: string) {
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { data: { full_name: fullName }, emailRedirectTo: window.location.origin },
  });
  if (error) throw new Error(friendlyAuthError(error.message));
  // Supabase hides whether an email is taken: it "succeeds" but returns a user with no identities.
  if (data.user && data.user.identities?.length === 0) {
    throw new Error("An account with this email already exists. Please sign in instead.");
  }
  return { needsConfirmation: !data.session };
}

export async function signIn(email: string, password: string) {
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) {
    if (error.code === "email_not_confirmed") throw new EmailNotConfirmedError();
    throw new Error(friendlyAuthError(error.message));
  }
}

export class EmailNotConfirmedError extends Error {
  constructor() {
    super("Please confirm your email first. Open the link we emailed you, or tap below to get a new one.");
  }
}

export async function resendConfirmation(email: string) {
  const { error } = await supabase.auth.resend({
    type: "signup",
    email,
    options: { emailRedirectTo: window.location.origin },
  });
  if (error) throw new Error(friendlyAuthError(error.message));
}

function friendlyAuthError(message: string) {
  if (/invalid login credentials/i.test(message)) return "Wrong email or password.";
  if (/rate limit|too many/i.test(message))
    return "Too many emails sent. Please wait a few minutes and try again.";
  if (/for security purposes/i.test(message))
    return "Please wait a minute before asking for another email.";
  return message;
}

export async function signOut() {
  await supabase.auth.signOut();
}

// ---------------------------------------------------------------- profiles
export async function getMyAccount(userId: string) {
  const [profile, worker] = await Promise.all([
    supabase.from("profiles").select("*").eq("id", userId).maybeSingle(),
    supabase.from("worker_profiles").select("*").eq("id", userId).maybeSingle(),
  ]);
  return { profile: maybe(profile), worker: maybe(worker) };
}

export async function updateProfile(
  patch: Partial<Pick<Profile, "full_name" | "avatar_url" | "city" | "preferred_language" | "last_role">>,
) {
  const id = await uid();
  check(await supabase.from("profiles").update(patch).eq("id", id));
}

export type WorkerForm = {
  service_id: number;
  years_experience: number | null;
  area: string | null;
  skills: string[];
  service_areas: string[];
  hourly_rate: number | null;
  fixed_rate_from: number | null;
  bio: string | null;
  voice_intro_path?: string | null;
};

export async function saveWorkerProfile(form: WorkerForm, exists: boolean) {
  const id = await uid();
  if (exists) {
    check(await supabase.from("worker_profiles").update(form).eq("id", id));
  } else {
    check(await supabase.from("worker_profiles").insert({ id, ...form }));
  }
}

export async function setAvailability(isAvailable: boolean) {
  const id = await uid();
  check(await supabase.from("worker_profiles").update({ is_available: isAvailable }).eq("id", id));
}

// ---------------------------------------------------------------- services & workers
export async function listServices() {
  return check(await supabase.from("services").select("*").order("sort_order"));
}

const workerSelect =
  "*, profile:profiles!worker_profiles_id_fkey(full_name, avatar_url, city), service:services!worker_profiles_service_id_fkey(name, icon)";

export async function listWorkers(serviceId?: number | null) {
  let query = supabase
    .from("worker_profiles")
    .select(workerSelect)
    .order("rating_avg", { ascending: false })
    .order("rating_count", { ascending: false })
    .limit(50);
  if (serviceId) query = query.eq("service_id", serviceId);
  return check(await query) as unknown as WorkerListItem[];
}

export async function getWorker(id: string) {
  const worker = check(
    await supabase.from("worker_profiles").select(workerSelect).eq("id", id).single(),
  ) as unknown as WorkerListItem;
  const [reviews, portfolio] = await Promise.all([
    supabase
      .from("reviews")
      .select("*, customer:profiles!reviews_customer_id_fkey(full_name, avatar_url)")
      .eq("worker_id", id)
      .order("created_at", { ascending: false })
      .limit(10),
    supabase
      .from("worker_portfolio")
      .select("*")
      .eq("worker_id", id)
      .order("created_at", { ascending: false }),
  ]);
  return {
    ...worker,
    reviews: check(reviews),
    portfolio: check(portfolio),
  } as unknown as WorkerDetail;
}

export async function listSavedWorkerIds() {
  const rows = check(await supabase.from("saved_workers").select("worker_id"));
  return rows.map((r) => r.worker_id);
}

export async function listSavedWorkers() {
  const rows = check(
    await supabase
      .from("saved_workers")
      .select(`worker:worker_profiles!saved_workers_worker_id_fkey(${workerSelect})`)
      .order("created_at", { ascending: false }),
  ) as unknown as { worker: WorkerListItem | null }[];
  return rows.map((r) => r.worker).filter((w): w is WorkerListItem => !!w);
}

export async function setSaved(workerId: string, saved: boolean) {
  const id = await uid();
  if (saved) {
    check(
      await supabase
        .from("saved_workers")
        .upsert({ customer_id: id, worker_id: workerId }, { ignoreDuplicates: true }),
    );
  } else {
    check(
      await supabase.from("saved_workers").delete().eq("customer_id", id).eq("worker_id", workerId),
    );
  }
}

// ---------------------------------------------------------------- storage
export async function uploadFile(bucket: "voice-notes" | "avatars" | "portfolio", file: Blob, ext: string) {
  const id = await uid();
  const path = `${id}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
  const { error } = await supabase.storage
    .from(bucket)
    .upload(path, file, { contentType: file.type || undefined, upsert: false });
  if (error) throw new Error(error.message);
  return path;
}

export function publicUrl(bucket: "avatars" | "portfolio", path: string) {
  return supabase.storage.from(bucket).getPublicUrl(path).data.publicUrl;
}

export async function voiceNoteUrl(path: string) {
  const { data, error } = await supabase.storage.from("voice-notes").createSignedUrl(path, 3600);
  if (error) throw new Error(error.message);
  return data.signedUrl;
}

// ---------------------------------------------------------------- jobs & offers
export async function postJob(job: {
  title: string;
  description: string | null;
  service_id: number | null;
  area: string | null;
  budget: number | null;
  preferred_time: string | null;
  requested_worker_id: string | null;
  voice_note_path: string | null;
}) {
  const id = await uid();
  const row = check<{ id: string }>(
    await supabase
      .from("jobs")
      .insert({ ...job, customer_id: id })
      .select("id")
      .single(),
  );
  return row.id;
}

export async function cancelJob(jobId: string) {
  check(await supabase.from("jobs").update({ status: "cancelled" }).eq("id", jobId));
}

export async function listMyOpenJobs() {
  const id = await uid();
  const rows = check(
    await supabase
      .from("jobs")
      .select(
        "*, service:services!jobs_service_id_fkey(name, icon), offers:job_offers!job_offers_job_id_fkey(*, worker:worker_profiles!job_offers_worker_id_fkey(id, rating_avg, rating_count, profile:profiles!worker_profiles_id_fkey(full_name, avatar_url)))",
      )
      .eq("customer_id", id)
      .eq("status", "open")
      .order("created_at", { ascending: false }),
  );
  return rows as unknown as JobWithOffers[];
}

const jobSelect =
  "*, service:services!jobs_service_id_fkey(name, icon), customer:profiles!jobs_customer_id_fkey(full_name, avatar_url)";

export async function listOpenJobsForWorker() {
  const id = await uid();
  const rows = check(
    await supabase
      .from("jobs")
      .select(jobSelect)
      .eq("status", "open")
      .neq("customer_id", id)
      .order("created_at", { ascending: false })
      .limit(50),
  );
  return rows as unknown as JobListItem[];
}

export async function getJob(jobId: string) {
  return check(
    await supabase.from("jobs").select(jobSelect).eq("id", jobId).single(),
  ) as unknown as JobListItem;
}

export async function makeOffer(jobId: string, price: number, message: string | null) {
  const id = await uid();
  const { error } = await supabase
    .from("job_offers")
    .insert({ job_id: jobId, worker_id: id, proposed_price: price, message });
  if (error) {
    if (error.code === "23505") throw new Error("You already sent an offer for this job");
    throw new Error(error.message);
  }
}

export async function listMyOffers() {
  const id = await uid();
  const rows = check(
    await supabase
      .from("job_offers")
      .select(`*, job:jobs!job_offers_job_id_fkey(${jobSelect})`)
      .eq("worker_id", id)
      .order("created_at", { ascending: false }),
  );
  return rows as unknown as MyOffer[];
}

export async function withdrawOffer(offerId: string) {
  check(await supabase.from("job_offers").update({ status: "withdrawn" }).eq("id", offerId));
}

export async function acceptOffer(offerId: string) {
  return check(await supabase.rpc("accept_offer", { p_offer_id: offerId }));
}

export async function declineOffer(offerId: string) {
  check(await supabase.rpc("decline_offer", { p_offer_id: offerId }));
}

// ---------------------------------------------------------------- bookings & reviews
const bookingSelect =
  "*, job:jobs!bookings_job_id_fkey(title, description), customer:profiles!bookings_customer_id_fkey(full_name, avatar_url), worker:worker_profiles!bookings_worker_id_fkey(id, profile:profiles!worker_profiles_id_fkey(full_name, avatar_url), service:services!worker_profiles_service_id_fkey(name))";

export async function listBookings(as: "customer" | "worker") {
  const id = await uid();
  const rows = check(
    await supabase
      .from("bookings")
      .select(bookingSelect)
      .eq(as === "customer" ? "customer_id" : "worker_id", id)
      .order("created_at", { ascending: false }),
  );
  return rows as unknown as BookingItem[];
}

export async function getBooking(bookingId: string) {
  return check(
    await supabase.from("bookings").select(bookingSelect).eq("id", bookingId).single(),
  ) as unknown as BookingItem;
}

export async function updateBookingStatus(bookingId: string, status: BookingStatus) {
  check(await supabase.rpc("update_booking_status", { p_booking_id: bookingId, p_status: status }));
}

export async function listMyReviewedBookingIds() {
  const id = await uid();
  const rows = check(await supabase.from("reviews").select("booking_id").eq("customer_id", id));
  return rows.map((r) => r.booking_id);
}

export async function submitReview(bookingId: string, workerId: string, rating: number, comment: string | null) {
  const id = await uid();
  const { error } = await supabase
    .from("reviews")
    .insert({ booking_id: bookingId, worker_id: workerId, customer_id: id, rating, comment });
  if (error) {
    if (error.code === "23505") throw new Error("You already rated this booking");
    throw new Error(error.message);
  }
}

export async function addPortfolioPhoto(file: File) {
  const id = await uid();
  const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
  const path = await uploadFile("portfolio", file, ext);
  check(await supabase.from("worker_portfolio").insert({ worker_id: id, image_path: path }));
}

// ---------------------------------------------------------------- messages
export async function listConversation(otherId: string) {
  const id = await uid();
  return check(
    await supabase
      .from("messages")
      .select("*")
      .or(
        `and(sender_id.eq.${id},recipient_id.eq.${otherId}),and(sender_id.eq.${otherId},recipient_id.eq.${id})`,
      )
      .order("created_at", { ascending: true })
      .limit(200),
  );
}

export async function sendMessage(otherId: string, body: string) {
  const id = await uid();
  check(await supabase.from("messages").insert({ sender_id: id, recipient_id: otherId, body }));
}

export async function markConversationRead(otherId: string) {
  const id = await uid();
  await supabase
    .from("messages")
    .update({ read_at: new Date().toISOString() })
    .eq("recipient_id", id)
    .eq("sender_id", otherId)
    .is("read_at", null);
}

export async function getPerson(id: string) {
  return maybe(
    await supabase.from("profiles").select("id, full_name, avatar_url").eq("id", id).maybeSingle(),
  );
}

// ---------------------------------------------------------------- AI (Claude, via the ai-assist Edge Function)
export type AiWorkerProfile = {
  name: string | null;
  service: string | null;
  years_experience: number | null;
  area: string | null;
  service_areas: string[];
  skills: string[];
  hourly_rate: number | null;
  fixed_rate_from: number | null;
  bio: string;
  summary_ur: string;
};

export type AiJobRequest = {
  title: string;
  description: string;
  service: string | null;
  area: string | null;
  budget: number | null;
  urgency: "now" | "today" | "tomorrow" | "this_week" | "flexible";
  summary_ur: string;
};

/**
 * Asks Claude to understand what the user said. Returns null when the AI
 * service isn't available (not deployed, no API key, rate limited, offline);
 * callers then fall back to simple keyword rules and say so in the UI.
 */
export async function aiAssist(task: "worker_profile", text: string): Promise<AiWorkerProfile | null>;
export async function aiAssist(task: "job_request", text: string): Promise<AiJobRequest | null>;
export async function aiAssist(task: string, text: string): Promise<unknown> {
  if (!text.trim()) return null;
  try {
    const { data, error } = await supabase.functions.invoke("ai-assist", { body: { task, text } });
    if (error || !data?.result) return null;
    return data.result;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------- one-tap worker account
const DEVICE_ACCOUNT_KEY = "rr-device-worker";

/** True when this device has a one-tap worker account it can sign back into. */
export function hasDeviceAccount() {
  try {
    return !!localStorage.getItem(DEVICE_ACCOUNT_KEY);
  } catch {
    return false;
  }
}

/**
 * Signs a worker in without email or password. Reuses this device's account if
 * there is one, otherwise asks the quick-start Edge Function to create one.
 */
export async function quickStartWorker() {
  let creds: { email: string; password: string } | null = null;
  try {
    const saved = localStorage.getItem(DEVICE_ACCOUNT_KEY);
    if (saved) creds = JSON.parse(saved);
  } catch {
    creds = null;
  }
  if (creds) {
    const { error } = await supabase.auth.signInWithPassword(creds);
    if (!error) return;
  }
  const { data, error } = await supabase.functions.invoke("quick-start", { body: {} });
  if (error || !data?.email) {
    throw new Error("Quick start isn't available right now. Please use email sign-up below.");
  }
  creds = { email: data.email, password: data.password };
  const signIn = await supabase.auth.signInWithPassword(creds);
  if (signIn.error) throw new Error(signIn.error.message);
  try {
    localStorage.setItem(DEVICE_ACCOUNT_KEY, JSON.stringify(creds));
  } catch {
    // Private browsing: the session still works until sign-out.
  }
}

// ---------------------------------------------------------------- availability
/** Workers who are on a job right now (or booked within the next/last 3 hours). */
export async function listEngagedWorkerIds(): Promise<string[]> {
  const { data, error } = await supabase.rpc("engaged_worker_ids");
  if (error) return []; // older database without the function: fall back to manual availability
  return (data as unknown as string[]) ?? [];
}
