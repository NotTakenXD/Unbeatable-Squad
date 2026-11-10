import { useEffect, useMemo, useRef, useState } from "react";
import {
  Avatar,
  BottomNav,
  Empty,
  ErrorNote,
  Icon,
  Loading,
  PrimaryButton,
  ProfileRow,
  RoleSwitchRow,
  TopBar,
  Waveform,
  formatRs,
  formatWhen,
  serviceIcon,
  timeAgo,
} from "../ui";
import {
  addPortfolioPhoto,
  getJob,
  getWorker,
  listBookings,
  listMyOffers,
  listOpenJobsForWorker,
  makeOffer,
  publicUrl,
  saveWorkerProfile,
  setAvailability,
  signOut,
  updateBookingStatus,
  updateProfile,
  uploadFile,
  withdrawOffer,
  type BookingItem,
  type BookingStatus,
  type JobListItem,
} from "../lib/api";
import { aiAssist } from "../lib/api";
import { extractProfile } from "../lib/extract";
import {
  canRecognizeSpeech,
  formatClock,
  speak,
  useLive,
  useLocalList,
  useQuery,
  useRecorder,
} from "../lib/hooks";
import { useSession } from "../lib/session";
import {
  ACTIVE_STATUSES,
  STATUS_LABEL,
  VoiceNote,
  readError,
  type ScreenProps,
} from "./common";

function NeedWorkerProfile({ go }: { go: ScreenProps["go"] }) {
  return (
    <main className="app-screen worker-portal">
      <TopBar title="Worker" />
      <Empty>
        Create your worker profile first so customers can find you.
        <PrimaryButton onClick={() => go("voice-register")}>Start Registration</PrimaryButton>
      </Empty>
    </main>
  );
}

const NEXT_STEP: Partial<Record<BookingStatus, { status: BookingStatus; label: string }>> = {
  confirmed: { status: "on_the_way", label: "I'm on the way" },
  on_the_way: { status: "working", label: "Start work" },
  working: { status: "done", label: "Mark as done" },
};

/** Open jobs a worker should see: their trade, untagged jobs, or jobs sent to them. */
function relevantJobs(jobs: JobListItem[], serviceId: number, workerId: string) {
  return jobs.filter(
    (j) => j.requested_worker_id === workerId || j.service_id == null || j.service_id === serviceId,
  );
}

// ------------------------------------------------------------------ voice registration
export function VoiceRegister({ go, back, urdu }: ScreenProps) {
  const { select } = useSession();
  // Most workers speak Urdu / Roman Urdu, so Urdu recognition is the default.
  const [lang, setLang] = useState<"ur" | "en">("ur");
  const rec = useRecorder(lang);
  const [thinking, setThinking] = useState(false);
  const speechOk = canRecognizeSpeech();

  const next = async () => {
    setThinking(true);
    const ai = await aiAssist("worker_profile", rec.transcript);
    setThinking(false);
    if (ai?.summary_ur) speak(ai.summary_ur, "ur");
    select({ voiceDraft: { transcript: rec.transcript, blob: rec.blob, ai } });
    go("ai-extraction");
  };

  return (
    <main className="app-screen voice-register">
      <TopBar back={back} />
      <h1>
        Let’s create your
        <br />
        professional profile.
      </h1>
      <h2>Speak about yourself.</h2>
      <p lang="ur" dir="rtl">
        اپنے بارے میں بتائیں
      </p>
      <div className="lang-toggle" role="group" aria-label="Speaking language">
        <button className={lang === "ur" ? "active" : ""} onClick={() => setLang("ur")} disabled={rec.recording}>
          <span lang="ur">اردو</span>
        </button>
        <button className={lang === "en" ? "active" : ""} onClick={() => setLang("en")} disabled={rec.recording}>
          English
        </button>
        <button
          className="listen-button"
          onClick={() =>
            speak(
              "مائیک کا بٹن دبائیں اور بولیں: آپ کا نام، آپ کا کام، کتنے سال کا تجربہ، اور آپ کس علاقے میں کام کرتے ہیں۔",
              "ur",
            )
          }
          aria-label="Listen to instructions"
        >
          <Icon name="speaker" size={18} />
        </button>
      </div>
      {!speechOk && (
        <ErrorNote message="This browser can record your voice but can't turn it into text. Use Chrome or Edge for automatic filling." />
      )}
      <button
        className={`mic-button ${rec.recording ? "recording" : ""}`}
        onClick={() => (rec.recording ? rec.stop() : rec.start())}
        aria-label={rec.recording ? "Stop recording" : "Start recording"}
      >
        {rec.recording ? "■" : <Icon name="mic" size={48} />}
      </button>
      <strong>
        {rec.recording
          ? `Listening... ${formatClock(rec.seconds)}`
          : rec.blob
            ? "Recording ready"
            : "Tap the mic to begin"}
      </strong>
      <Waveform active={rec.recording} />
      <div className="hint">
        {rec.transcript ||
          "Say your name, your trade, years of experience and your area. e.g. “My name is Ali Khan, I am an electrician with 5 years experience in G-11.”"}
      </div>
      <ErrorNote message={rec.error} />
      {rec.recording ? (
        <PrimaryButton onClick={rec.stop}>Stop Recording</PrimaryButton>
      ) : rec.blob ? (
        <PrimaryButton onClick={next} loading={thinking}>
          {thinking ? "Understanding what you said…" : "Continue"}
        </PrimaryButton>
      ) : (
        <PrimaryButton onClick={rec.start}>Start Recording</PrimaryButton>
      )}
      <button
        className="text-button"
        onClick={() => {
          select({ voiceDraft: { transcript: "", blob: null } });
          go("ai-extraction");
        }}
      >
        Skip — fill in a form instead
      </button>
    </main>
  );
}

// ------------------------------------------------------------------ review / edit worker details
const splitList = (s: string) =>
  s
    .split(/[,،\n]/)
    .map((x) => x.trim())
    .filter(Boolean);

export function WorkerDetailsForm({ go, back, flash }: ScreenProps) {
  const { worker, profile, services, refreshAccount, selection, select } = useSession();
  const draft = selection.voiceDraft;
  const heard = draft?.transcript ?? "";
  const ai = draft?.ai ?? null;
  // Claude's reading of the speech when available, otherwise simple keyword rules.
  const extracted = useMemo(() => {
    if (ai) {
      return {
        name: ai.name ?? undefined,
        serviceId: services.find((s) => s.slug === ai.service)?.id,
        years: ai.years_experience ?? undefined,
        area: ai.area ?? undefined,
        skills: ai.skills,
        serviceAreas: ai.service_areas,
        hourly: ai.hourly_rate,
        fixed: ai.fixed_rate_from,
        bio: ai.bio,
      };
    }
    const rules = extractProfile(heard, services);
    return { ...rules, serviceAreas: rules.area ? [rules.area] : [], hourly: null, fixed: null, bio: heard };
  }, [ai, heard, services]);
  const source: "ai" | "rules" | "none" = ai ? "ai" : heard ? "rules" : "none";

  const [name, setName] = useState(extracted.name ?? profile?.full_name ?? "");
  const [serviceId, setServiceId] = useState<number | null>(
    extracted.serviceId ?? worker?.service_id ?? null,
  );
  const [years, setYears] = useState(String(extracted.years ?? worker?.years_experience ?? ""));
  const [area, setArea] = useState(extracted.area ?? worker?.area ?? "");
  const [skills, setSkills] = useState(
    (extracted.skills.length ? extracted.skills : (worker?.skills ?? [])).join(", "),
  );
  const [areas, setAreas] = useState(
    (extracted.serviceAreas.length ? extracted.serviceAreas : (worker?.service_areas ?? [])).join(", "),
  );
  const [hourly, setHourly] = useState(String(extracted.hourly ?? worker?.hourly_rate ?? ""));
  const [fixed, setFixed] = useState(String(extracted.fixed ?? worker?.fixed_rate_from ?? ""));
  const [bio, setBio] = useState(extracted.bio || worker?.bio || "");

  // Read the details back in Urdu so a worker who can't read can still confirm them.
  const readBack = () => {
    const trade = services.find((s) => s.id === serviceId);
    const parts = [
      name && `آپ کا نام ${name} ہے۔`,
      trade && `آپ ${trade.name_ur ?? trade.name} ہیں۔`,
      years && `آپ کا تجربہ ${years} سال ہے۔`,
      area && `آپ کا علاقہ ${area} ہے۔`,
      hourly && `آپ کا ریٹ ${hourly} روپے فی گھنٹہ ہے۔`,
      "اگر یہ ٹھیک ہے تو نیچے والا سبز بٹن دبائیں۔",
    ];
    speak(parts.filter(Boolean).join(" "), "ur");
  };
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (serviceId == null && services.length) setServiceId(services[0].id);
  }, [services, serviceId]);

  const num = (s: string) => (s.trim() ? Number(s.replace(/[^\d]/g, "")) || null : null);

  const submit = async () => {
    setError(null);
    if (!name.trim()) return setError("Please add your name");
    if (!serviceId) return setError("Please choose your trade");
    setLoading(true);
    try {
      let voicePath = worker?.voice_intro_path ?? null;
      if (draft?.blob) {
        voicePath = await uploadFile(
          "voice-notes",
          draft.blob,
          draft.blob.type.includes("mp4") ? "m4a" : "webm",
        );
      }
      await updateProfile({ full_name: name.trim(), last_role: "worker" });
      const serviceAreas = splitList(areas);
      await saveWorkerProfile(
        {
          service_id: serviceId,
          years_experience: num(years),
          area: area.trim() || null,
          skills: splitList(skills),
          service_areas: serviceAreas.length ? serviceAreas : area.trim() ? [area.trim()] : [],
          hourly_rate: num(hourly),
          fixed_rate_from: num(fixed),
          bio: bio.trim() || null,
          voice_intro_path: voicePath,
        },
        !!worker,
      );
      await refreshAccount();
      select({ voiceDraft: undefined });
      flash(worker ? "Profile updated" : "Profile created");
      go("worker-dashboard");
    } catch (e) {
      setError(readError(e));
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="app-screen extraction">
      <TopBar
        title={source === "ai" ? "AI Understood" : heard ? "Check Your Details" : "Your Work Profile"}
        back={back}
      />
      {source === "ai" ? (
        <div className="ai-note">
          <span>AI</span>
          <p>AI (Gemini) understood these from what you said. Tap the speaker to hear them, then confirm.</p>
          <button className="listen-button" onClick={readBack} aria-label="Read my details aloud">
            <Icon name="speaker" size={18} />
          </button>
        </div>
      ) : source === "rules" ? (
        <div className="ai-note">
          <span>✎</span>
          <p>Filled in by simple word matching (AI was unavailable). Please check every field.</p>
          <button className="listen-button" onClick={readBack} aria-label="Read my details aloud">
            <Icon name="speaker" size={18} />
          </button>
        </div>
      ) : (
        <div className="ai-note">
          <span>✎</span>
          <p>Fill in your details. You can change them any time.</p>
        </div>
      )}
      <div className="form-grid single">
        <label className="field">
          Full name
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ali Khan" />
        </label>
        <label className="field">
          Trade
          <select value={serviceId ?? ""} onChange={(e) => setServiceId(Number(e.target.value))}>
            {services.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </label>
        <div className="form-grid">
          <label className="field">
            Years experience
            <input inputMode="numeric" value={years} onChange={(e) => setYears(e.target.value)} />
          </label>
          <label className="field">
            Your area
            <input value={area} onChange={(e) => setArea(e.target.value)} placeholder="G-11" />
          </label>
        </div>
        <label className="field">
          Skills (comma separated)
          <input value={skills} onChange={(e) => setSkills(e.target.value)} placeholder="Wiring, Repair" />
        </label>
        <label className="field">
          Areas you work in
          <input value={areas} onChange={(e) => setAreas(e.target.value)} placeholder="G-11, F-10, I-8" />
        </label>
        <div className="form-grid">
          <label className="field">
            Hourly rate (Rs.)
            <input inputMode="numeric" value={hourly} onChange={(e) => setHourly(e.target.value)} />
          </label>
          <label className="field">
            Fixed jobs from (Rs.)
            <input inputMode="numeric" value={fixed} onChange={(e) => setFixed(e.target.value)} />
          </label>
        </div>
        <label className="field">
          About you
          <textarea value={bio} onChange={(e) => setBio(e.target.value)} rows={3} />
        </label>
      </div>
      <ErrorNote message={error} />
      <PrimaryButton loading={loading} onClick={submit}>
        {worker ? "Save Changes" : "Confirm Details"}
      </PrimaryButton>
    </main>
  );
}

// ------------------------------------------------------------------ worker dashboard
export function WorkerDashboard({ go, flash, openRoleSelection }: ScreenProps) {
  const { profile, worker, refreshAccount, userId } = useSession();
  const jobs = useQuery(listOpenJobsForWorker, []);
  const offers = useQuery(listMyOffers, []);
  const bookings = useQuery(() => listBookings("worker"), []);
  useLive(["jobs", "job_offers", "bookings"], () => {
    jobs.reload();
    offers.reload();
    bookings.reload();
  });
  const [available, setAvailable] = useState(worker?.is_available ?? true);
  useEffect(() => {
    if (worker) setAvailable(worker.is_available);
  }, [worker]);

  if (!worker || !userId) return <NeedWorkerProfile go={go} />;

  const offeredJobIds = new Set((offers.data ?? []).map((o) => o.job_id));
  const newRequests = relevantJobs(jobs.data ?? [], worker.service_id, userId).filter(
    (j) => !offeredJobIds.has(j.id),
  );
  const active = (bookings.data ?? []).filter((b) => ACTIVE_STATUSES.includes(b.status));
  const today = new Date().toDateString();
  const todays = active.filter((b) => b.scheduled_at && new Date(b.scheduled_at).toDateString() === today);
  const schedule = todays.length ? todays : active.slice(0, 3);

  const checks = [
    profile?.full_name,
    profile?.avatar_url,
    worker.years_experience != null,
    worker.area,
    worker.skills.length,
    worker.service_areas.length,
    worker.hourly_rate || worker.fixed_rate_from,
    worker.bio,
    worker.voice_intro_path,
  ];
  const completeness = Math.round((checks.filter(Boolean).length / checks.length) * 100);

  const toggle = () => {
    const next = !available;
    setAvailable(next);
    setAvailability(next)
      .then(() => {
        flash(next ? "You are now Available" : "You are now Unavailable");
        return refreshAccount();
      })
      .catch((e) => {
        setAvailable(!next);
        flash(readError(e));
      });
  };

  return (
    <main className="app-screen worker-portal">
      <div className="dashboard-head">
        <div className="person">
          <Avatar src={profile?.avatar_url} name={profile?.full_name} />
          <div>
            <small>Assalam-o-Alaikum,</small>
            <strong>{profile?.full_name?.split(" ")[0] ?? "there"}!</strong>
          </div>
        </div>
        <div className="header-actions">
          <button className="switch-role-pill" onClick={openRoleSelection}>
            <Icon name="swap" size={15} />
            <span>
              Switch Role<small lang="ur">کردار تبدیل کریں</small>
            </span>
          </button>
          <button className="bell" onClick={() => go("find-work")} aria-label="New requests">
            <Icon name="bell" />
            {newRequests.length > 0 && <i />}
          </button>
        </div>
      </div>
      <div className="portal-accent worker" />
      <button className={`availability ${available ? "on" : ""}`} onClick={toggle}>
        <span>
          <Icon name="mic" />
          {available ? "Available" : "Unavailable"}
        </span>
        <i />
      </button>
      <div className="stats">
        <button onClick={() => go("find-work")}>
          <b>{jobs.loading && !jobs.data ? "…" : newRequests.length}</b>
          <span>New Requests</span>
        </button>
        <button onClick={() => go("worker-bookings")}>
          <b>{bookings.loading && !bookings.data ? "…" : active.length}</b>
          <span>Active Jobs</span>
        </button>
      </div>
      <h3 className="quick-title">Quick Actions</h3>
      <div className="quick-actions">
        <button onClick={() => go("find-work")}>
          <span>
            <Icon name="search" />
          </span>
          <b>Find Work</b>
        </button>
        <button onClick={() => go("worker-bookings")}>
          <span>
            <Icon name="briefcase" />
          </span>
          <b>My Jobs</b>
        </button>
      </div>
      {!available && (
        <article className="tip-card">
          <Icon name="star" filled />
          <div>
            <strong>You are hidden as busy</strong>
            <p>Available workers receive more job requests.</p>
          </div>
        </article>
      )}
      <section className="schedule-card">
        <div className="section-title compact-title">
          <h3>{todays.length ? "Today's Schedule" : "Upcoming Jobs"}</h3>
          <span>
            {schedule.length} job{schedule.length === 1 ? "" : "s"}
          </span>
        </div>
        {schedule.length === 0 && (
          <div>
            <span>No booked jobs yet — send offers from Find Work.</span>
          </div>
        )}
        {schedule.map((b) => (
          <div key={b.id}>
            <b>
              {b.scheduled_at
                ? new Date(b.scheduled_at).toLocaleTimeString("en-PK", { hour: "numeric", minute: "2-digit" })
                : "TBD"}
            </b>
            <span>
              {b.job?.title ?? "Job"} • {b.area ?? b.city}
            </span>
          </div>
        ))}
      </section>
      <section className="completeness-card">
        <div className="row">
          <strong>Profile Completeness</strong>
          <b>{completeness}%</b>
        </div>
        <div className="progress">
          <i style={{ width: `${completeness}%` }} />
        </div>
        <button onClick={() => go(worker.voice_intro_path ? "worker-profile" : "voice-register")}>
          <Icon name="mic" size={17} />
          {worker.voice_intro_path ? "Complete your profile" : "Record voice intro"}
        </button>
      </section>
      <BottomNav active="Home" workerMode go={go} />
    </main>
  );
}

// ------------------------------------------------------------------ find work
export function FindWork({ go, back, flash }: ScreenProps) {
  const { worker, userId, select } = useSession();
  const [tab, setTab] = useState("New Requests");
  const jobs = useQuery(listOpenJobsForWorker, []);
  const offers = useQuery(listMyOffers, []);
  const bookings = useQuery(() => listBookings("worker"), []);
  const hidden = useLocalList("rr-hidden-jobs");
  const [busy, setBusy] = useState<string | null>(null);
  useLive(["jobs", "job_offers", "bookings"], () => {
    jobs.reload();
    offers.reload();
    bookings.reload();
  });

  if (!worker || !userId) return <NeedWorkerProfile go={go} />;

  const offeredJobIds = new Set((offers.data ?? []).map((o) => o.job_id));
  const newJobs = relevantJobs(jobs.data ?? [], worker.service_id, userId).filter(
    (j) => !offeredJobIds.has(j.id) && !hidden.items.includes(j.id),
  );
  const applied = (offers.data ?? []).filter((o) => o.status === "pending" || o.status === "declined");
  const active = (bookings.data ?? []).filter((b) => ACTIVE_STATUSES.includes(b.status));

  const accept = async (job: JobListItem) => {
    if (!job.budget) {
      select({ jobId: job.id });
      go("apply");
      return;
    }
    setBusy(job.id);
    try {
      await makeOffer(job.id, job.budget, "I accept your price and can do this job.");
      flash("Offer sent to customer");
      offers.reload();
    } catch (e) {
      flash(readError(e));
    } finally {
      setBusy(null);
    }
  };

  const chatWith = (id: string, name: string | null | undefined, avatar: string | null | undefined) => {
    select({ chatWith: { id, name: name ?? "Customer", avatar: avatar ?? null } });
    go("chat");
  };

  const loading = jobs.loading && !jobs.data;

  return (
    <main className="app-screen worker-portal">
      <TopBar title="Jobs" back={back} />
      <div className="three-tabs">
        {["New Requests", "Applied", "Active"].map((item) => (
          <button className={tab === item ? "active" : ""} onClick={() => setTab(item)} key={item}>
            {item}
          </button>
        ))}
      </div>
      <ErrorNote message={jobs.error ?? offers.error} />
      {loading && <Loading />}
      <div className="job-stack" key={tab}>
        {tab === "New Requests" && !loading && newJobs.length === 0 && (
          <Empty>No new requests right now. New jobs appear here live.</Empty>
        )}
        {tab === "New Requests" &&
          newJobs.map((job) => (
            <article className="request-card" key={job.id}>
              <div className="row">
                <div className="job-symbol">
                  <Icon name={serviceIcon(job.service?.icon)} />
                </div>
                <div className="grow">
                  <strong>{job.title}</strong>
                  <small>
                    <Icon name="pin" size={13} />
                    {job.area ?? "—"} {job.city}
                  </small>
                </div>
                <span className="urgency">
                  {job.requested_worker_id === userId ? "For you" : job.preferred_time ? formatWhen(job.preferred_time).split(",")[0] : "Flexible"}
                </span>
                <button
                  className="listen-button"
                  onClick={() =>
                    speak(
                      [
                        `${job.service?.name ?? ""} کا کام۔`,
                        job.description ?? job.title,
                        job.area ? `علاقہ ${job.area}۔` : "",
                        job.budget ? `بجٹ ${job.budget} روپے۔` : "بجٹ کھلا ہے۔",
                      ].join(" "),
                      "ur",
                    )
                  }
                  aria-label="Read this job aloud"
                >
                  <Icon name="speaker" size={18} />
                </button>
              </div>
              {job.description && job.description !== job.title && (
                <p className="muted-line">{job.description}</p>
              )}
              {job.voice_note_path && <VoiceNote path={job.voice_note_path} />}
              <div className="request-meta">
                <b>{job.budget ? formatRs(job.budget) : "Budget open"}</b>
                <span>
                  {job.customer?.full_name ?? "Customer"} • {timeAgo(job.created_at)}
                </span>
              </div>
              <div className="request-actions">
                <button
                  className="decline"
                  onClick={() => {
                    hidden.add(job.id);
                    flash("Request hidden");
                  }}
                >
                  Decline
                </button>
                <button
                  className="counter"
                  onClick={() => {
                    select({ jobId: job.id });
                    go("apply");
                  }}
                >
                  Counter Offer
                </button>
                <button className="accept" disabled={busy === job.id} onClick={() => accept(job)}>
                  {job.budget ? "Accept" : "Send Price"}
                </button>
              </div>
            </article>
          ))}

        {tab === "Applied" && applied.length === 0 && <Empty>You haven't sent any offers yet.</Empty>}
        {tab === "Applied" &&
          applied.map((offer) => (
            <article className="request-card" key={offer.id}>
              <div className="row">
                <div className="job-symbol">
                  <Icon name={serviceIcon(offer.job?.service?.icon)} />
                </div>
                <div className="grow">
                  <strong>{offer.job?.title ?? "Job"}</strong>
                  <small>
                    <Icon name="pin" size={13} />
                    {offer.job?.area ?? "—"} • {timeAgo(offer.created_at)}
                  </small>
                </div>
                <span className={`urgency ${offer.status === "declined" ? "declined" : ""}`}>
                  {offer.status === "pending" ? "Waiting" : "Declined"}
                </span>
              </div>
              <div className="request-meta">
                <b>Your offer: {formatRs(offer.proposed_price)}</b>
                <span>{offer.job?.customer?.full_name ?? "Customer"}</span>
              </div>
              {offer.status === "pending" && offer.job && (
                <div className="request-actions">
                  <button
                    className="decline"
                    onClick={() =>
                      withdrawOffer(offer.id)
                        .then(() => {
                          flash("Offer withdrawn");
                          offers.reload();
                        })
                        .catch((e) => flash(readError(e)))
                    }
                  >
                    Withdraw
                  </button>
                  <button
                    className="counter"
                    onClick={() =>
                      offer.job &&
                      chatWith(offer.job.customer_id, offer.job.customer?.full_name, offer.job.customer?.avatar_url)
                    }
                  >
                    Chat
                  </button>
                </div>
              )}
            </article>
          ))}

        {tab === "Active" && active.length === 0 && <Empty>No active jobs. Accepted offers show up here.</Empty>}
        {tab === "Active" &&
          active.map((b) => (
            <article className="request-card" key={b.id}>
              <div className="row">
                <div className="job-symbol">
                  <Icon name="briefcase" />
                </div>
                <div className="grow">
                  <strong>{b.job?.title ?? "Job"}</strong>
                  <small>
                    <Icon name="pin" size={13} />
                    {b.area ?? b.city} • {formatWhen(b.scheduled_at)}
                  </small>
                </div>
                <span className="urgency">{STATUS_LABEL[b.status]}</span>
              </div>
              <div className="request-meta">
                <b>{formatRs(b.agreed_price)}</b>
                <span>{b.customer?.full_name ?? "Customer"}</span>
              </div>
              <PrimaryButton outline onClick={() => go("worker-bookings")}>
                Manage Job
              </PrimaryButton>
            </article>
          ))}
      </div>
      <BottomNav active="Jobs" workerMode go={go} />
    </main>
  );
}

// ------------------------------------------------------------------ counter offer / apply
export function ApplyScreen({ go, back, flash }: ScreenProps) {
  const { selection } = useSession();
  const id = selection.jobId;
  const job = useQuery(() => (id ? getJob(id) : Promise.resolve(null)), [id]);
  const [price, setPrice] = useState("");
  const [message, setMessage] = useState("I can do this job.");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (job.data?.budget && !price) setPrice(String(job.data.budget));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [job.data]);

  const j = job.data;
  const submit = async () => {
    if (!j) return;
    const amount = Number(price.replace(/[^\d]/g, ""));
    if (!amount) return setError("Enter your price");
    setLoading(true);
    setError(null);
    try {
      await makeOffer(j.id, amount, message.trim() || null);
      flash("Offer sent");
      go("find-work");
    } catch (e) {
      setError(readError(e));
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="app-screen apply-screen">
      <TopBar title="Send Your Offer" back={back} />
      {job.loading && <Loading />}
      {j && (
        <>
          <div className="apply-summary">
            <div className="job-symbol">
              <Icon name={serviceIcon(j.service?.icon)} />
            </div>
            <div>
              <strong>{j.title}</strong>
              <p>
                {j.area ?? "—"} {j.city} • Customer budget: {j.budget ? formatRs(j.budget) : "open"}
              </p>
            </div>
          </div>
          {j.voice_note_path && <VoiceNote path={j.voice_note_path} />}
          <label>
            Your Price
            <div className="price-input">
              <span>Rs.</span>
              <input inputMode="numeric" value={price} onChange={(e) => setPrice(e.target.value)} />
            </div>
          </label>
          {/* Set the price by tapping — no typing needed. */}
          <div className="price-steps">
            <button type="button" onClick={() => setPrice(String(Math.max(0, (Number(price) || 0) - 500)))}>
              − 500
            </button>
            {[1000, 1500, 2000, 3000].map((n) => (
              <button type="button" key={n} className={Number(price) === n ? "active" : ""} onClick={() => setPrice(String(n))}>
                {n.toLocaleString("en-PK")}
              </button>
            ))}
            <button type="button" onClick={() => setPrice(String((Number(price) || 0) + 500))}>
              + 500
            </button>
            <button
              type="button"
              className="listen-button"
              onClick={() => speak(`آپ کی قیمت ${Number(price) || 0} روپے ہے۔`, "ur")}
              aria-label="Hear your price"
            >
              <Icon name="speaker" size={16} />
            </button>
          </div>
          <label>
            Message <small>(optional)</small>
            <textarea value={message} onChange={(e) => setMessage(e.target.value)} />
          </label>
          <div className="secure-note">
            <Icon name="shield" />
            <p>Your phone number and personal details stay private until you agree.</p>
          </div>
        </>
      )}
      <ErrorNote message={error ?? job.error} />
      <PrimaryButton loading={loading} disabled={!j} onClick={submit}>
        Submit Offer
      </PrimaryButton>
    </main>
  );
}

// ------------------------------------------------------------------ worker bookings
export function WorkerBookings({ go, back, flash }: ScreenProps) {
  const { worker, select } = useSession();
  const [tab, setTab] = useState<"Active" | "Completed">("Active");
  const bookings = useQuery(() => listBookings("worker"), []);
  useLive(["bookings"], bookings.reload);
  const [busy, setBusy] = useState<string | null>(null);

  if (!worker) return <NeedWorkerProfile go={go} />;

  const list = (bookings.data ?? []).filter((b) =>
    tab === "Active" ? ACTIVE_STATUSES.includes(b.status) : !ACTIVE_STATUSES.includes(b.status),
  );

  const move = async (b: BookingItem, status: BookingStatus) => {
    setBusy(b.id);
    try {
      await updateBookingStatus(b.id, status);
      flash(status === "done" ? "Job completed — great work!" : `Status: ${STATUS_LABEL[status]}`);
      bookings.reload();
    } catch (e) {
      flash(readError(e));
    } finally {
      setBusy(null);
    }
  };

  return (
    <main className="app-screen">
      <TopBar title="My Jobs" back={back} />
      <div className="segment tabs">
        {(["Active", "Completed"] as const).map((t) => (
          <button key={t} className={tab === t ? "active" : ""} onClick={() => setTab(t)}>
            {t}
          </button>
        ))}
      </div>
      {bookings.loading && !bookings.data && <Loading />}
      <ErrorNote message={bookings.error} />
      {!bookings.loading && list.length === 0 && (
        <Empty>{tab === "Active" ? "No active jobs yet." : "No completed jobs yet."}</Empty>
      )}
      {list.map((b) => {
        const next = NEXT_STEP[b.status];
        const customerName = b.customer?.full_name ?? "Customer";
        return (
          <article className="booking-card job-booking" key={b.id}>
            <div className="row">
              <Avatar src={b.customer?.avatar_url} name={customerName} />
              <div className="grow">
                <strong>{b.job?.title ?? "Job"}</strong>
                <small>
                  {customerName} • {b.area ?? b.city}
                </small>
                <b>{formatRs(b.agreed_price)}</b>
              </div>
              <span className={`badge ${b.status === "cancelled" ? "badge-off" : "progress"}`}>
                <i />
                {STATUS_LABEL[b.status]}
              </span>
            </div>
            <div className="booking-meta">
              <span>
                <Icon name="calendar" size={17} />
                {formatWhen(b.scheduled_at)}
              </span>
            </div>
            <div className="request-actions">
              <button
                className="counter"
                onClick={() => {
                  select({
                    chatWith: { id: b.customer_id, name: customerName, avatar: b.customer?.avatar_url ?? null },
                  });
                  go("chat");
                }}
              >
                Chat
              </button>
              {b.status === "confirmed" && (
                <button className="decline" disabled={busy === b.id} onClick={() => move(b, "cancelled")}>
                  Cancel
                </button>
              )}
              {next && (
                <button className="accept" disabled={busy === b.id} onClick={() => move(b, next.status)}>
                  {next.label}
                </button>
              )}
            </div>
          </article>
        );
      })}
      <BottomNav active="Jobs" workerMode go={go} />
    </main>
  );
}

// ------------------------------------------------------------------ earnings
const DAY_LABELS = ["M", "T", "W", "T", "F", "S", "S"];

function startOfWeek(d = new Date()) {
  const day = (d.getDay() + 6) % 7; // Monday = 0
  const start = new Date(d.getFullYear(), d.getMonth(), d.getDate() - day);
  return start;
}

export function Earnings({ go, back, flash }: ScreenProps) {
  const { worker } = useSession();
  const bookings = useQuery(() => listBookings("worker"), []);
  useLive(["bookings"], bookings.reload);
  if (!worker) return <NeedWorkerProfile go={go} />;

  const all = bookings.data ?? [];
  const done = all.filter((b) => b.status === "done");
  const weekStart = startOfWeek();
  const lastWeekStart = new Date(weekStart.getTime() - 7 * 86400000);
  const when = (b: BookingItem) => new Date(b.completed_at ?? b.updated_at);
  const thisWeek = done.filter((b) => when(b) >= weekStart);
  const lastWeek = done.filter((b) => when(b) >= lastWeekStart && when(b) < weekStart);
  const sum = (list: BookingItem[]) => list.reduce((n, b) => n + b.agreed_price, 0);
  const total = sum(thisWeek);
  const previous = sum(lastWeek);
  const change = previous ? Math.round(((total - previous) / previous) * 100) : null;
  const perDay = DAY_LABELS.map((_, i) =>
    sum(thisWeek.filter((b) => (when(b).getDay() + 6) % 7 === i)),
  );
  const max = Math.max(...perDay, 1);
  const pending = sum(all.filter((b) => ACTIVE_STATUSES.includes(b.status)));

  return (
    <main className="app-screen worker-portal">
      <TopBar title="Earnings" back={back} />
      <section className="earnings-total">
        <small>Total this week</small>
        <h1>{formatRs(total)}</h1>
        <span>
          {change == null
            ? "Completed jobs this week"
            : `${change >= 0 ? "+" : ""}${change}% from last week`}
        </span>
      </section>
      <section className="chart-card">
        <div className="section-title compact-title">
          <h3>Weekly earnings</h3>
          <small className="muted">Mon – Sun (Rs.)</small>
        </div>
        <div className="bar-chart">
          {perDay.map((amount, index) => (
            <div key={index} title={formatRs(amount)}>
              <i style={{ height: Math.max(4, Math.round((amount / max) * 88)) }} />
              <small>{DAY_LABELS[index]}</small>
            </div>
          ))}
        </div>
      </section>
      <div className="earning-stats">
        <article>
          <b>{done.length}</b>
          <span>Completed jobs</span>
        </article>
        <article>
          <b>{formatRs(pending)}</b>
          <span>From active jobs</span>
        </article>
      </div>
      <PrimaryButton onClick={() => flash("Payments are settled in cash with customers for now")}>
        Withdraw
      </PrimaryButton>
      <BottomNav active="Earnings" workerMode go={go} />
    </main>
  );
}

// ------------------------------------------------------------------ worker's own profile
export function WorkerOwnProfile({ go, back, flash, openRoleSelection }: ScreenProps) {
  const { worker, profile, userId, refreshAccount, select } = useSession();
  const detail = useQuery(() => (userId ? getWorker(userId) : Promise.resolve(null)), [userId, worker?.updated_at]);
  const avatarInput = useRef<HTMLInputElement>(null);
  const photoInput = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  if (!worker) return <NeedWorkerProfile go={go} />;
  const d = detail.data;

  const upload = async (file: File | undefined, kind: "avatar" | "portfolio") => {
    if (!file) return;
    setUploading(true);
    try {
      if (kind === "avatar") {
        const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
        const path = await uploadFile("avatars", file, ext);
        await updateProfile({ avatar_url: publicUrl("avatars", path) });
        await refreshAccount();
      } else {
        await addPortfolioPhoto(file);
      }
      detail.reload();
      flash(kind === "avatar" ? "Photo updated" : "Photo added");
    } catch (e) {
      flash(readError(e));
    } finally {
      setUploading(false);
    }
  };

  const edit = () => {
    select({ voiceDraft: undefined });
    go("ai-extraction");
  };

  return (
    <main className="app-screen portal-profile worker-portal">
      <TopBar title="Professional Profile" back={back} />
      <RoleSwitchRow onClick={openRoleSelection} />
      <div className="profile-summary">
        <button className="avatar-button" onClick={() => avatarInput.current?.click()} aria-label="Change photo">
          <Avatar large src={profile?.avatar_url} name={profile?.full_name} />
          <small>{uploading ? "..." : "Edit"}</small>
        </button>
        <input
          ref={avatarInput}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          hidden
          onChange={(e) => upload(e.target.files?.[0], "avatar")}
        />
        <div>
          <h2>{profile?.full_name ?? "Worker"}</h2>
          <p>
            {d?.service?.name ?? "Worker"} •{" "}
            {worker.rating_count > 0 ? `${Number(worker.rating_avg).toFixed(1)} ★ (${worker.rating_count})` : "No ratings yet"}
          </p>
        </div>
      </div>
      <section className="edit-section">
        <div className="section-title compact-title">
          <h3>Skills & Services</h3>
          <button onClick={edit}>Edit</button>
        </div>
        <div className="skill-chips">
          {worker.skills.length ? worker.skills.map((s) => <span key={s}>{s}</span>) : <span>Add your skills</span>}
        </div>
      </section>
      <section className="edit-section">
        <div className="section-title compact-title">
          <h3>Service Areas</h3>
          <button onClick={edit}>Edit</button>
        </div>
        <p>{worker.service_areas.length ? worker.service_areas.join(", ") : (worker.area ?? "Add your areas")}</p>
      </section>
      <section className="rate-grid">
        <div>
          <small>Hourly rate</small>
          <b>{worker.hourly_rate ? formatRs(worker.hourly_rate) : "—"}</b>
        </div>
        <div>
          <small>Fixed jobs from</small>
          <b>{worker.fixed_rate_from ? formatRs(worker.fixed_rate_from) : "—"}</b>
        </div>
      </section>
      {worker.voice_intro_path && <VoiceNote path={worker.voice_intro_path} />}
      <button className="voice-profile-button" onClick={() => go("voice-register")}>
        <Icon name="mic" />
        {worker.voice_intro_path ? "Re-record voice profile" : "Record voice profile"}
      </button>
      <section className="reviews-block">
        <h3>
          Reviews received{" "}
          {worker.rating_count > 0 && <span>{Number(worker.rating_avg).toFixed(1)} ★</span>}
        </h3>
        {!d?.reviews.length && <p>No reviews yet. Finish jobs to collect ratings.</p>}
        {d?.reviews.slice(0, 3).map((r) => (
          <p key={r.id}>
            {"★".repeat(r.rating)} {r.comment ? `“${r.comment}”` : ""}
            <small> — {r.customer?.full_name ?? "Customer"}</small>
          </p>
        ))}
      </section>
      <section className="portfolio">
        <h3>Portfolio photos</h3>
        <div>
          {d?.portfolio.map((p) => (
            <img key={p.id} src={publicUrl("portfolio", p.image_path)} alt={p.caption ?? "Work photo"} />
          ))}
          <button className="add-photo" onClick={() => photoInput.current?.click()} disabled={uploading}>
            {uploading ? "Uploading..." : "+ Add photo"}
          </button>
        </div>
        <input
          ref={photoInput}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          hidden
          onChange={(e) => upload(e.target.files?.[0], "portfolio")}
        />
      </section>
      <ProfileRow
        icon="user"
        title="Sign out"
        detail="Log out of this device"
        onClick={async () => {
          await signOut();
          go("home");
        }}
      />
      <BottomNav active="Profile" workerMode go={go} />
    </main>
  );
}
