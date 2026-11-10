import { useEffect, useRef, useState, type FormEvent } from "react";
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
  Service,
  Stars,
  TopBar,
  Waveform,
  formatRs,
  formatWhen,
  serviceIcon,
  timeAgo,
} from "../ui";
import {
  acceptOffer,
  cancelJob,
  declineOffer,
  getBooking,
  getWorker,
  listBookings,
  listConversation,
  listMyOpenJobs,
  listMyReviewedBookingIds,
  listSavedWorkerIds,
  listSavedWorkers,
  listWorkers,
  markConversationRead,
  postJob,
  publicUrl,
  sendMessage,
  setSaved,
  signOut,
  submitReview,
  updateBookingStatus,
  updateProfile,
  uploadFile,
} from "../lib/api";
import { formatClock, speak, useLive, useQuery, useRecorder } from "../lib/hooks";
import { workerDistanceKm } from "../lib/nearby";
import { aiAssist, listEngagedWorkerIds, type WorkerListItem } from "../lib/api";

/** Turns the AI's "when" into a value for the date-time field. */
function urgencyToTime(urgency: string): string | null {
  const d = new Date();
  if (urgency === "now") d.setMinutes(d.getMinutes() + 30);
  else if (urgency === "today") d.setHours(Math.max(d.getHours() + 2, 10), 0, 0, 0);
  else if (urgency === "tomorrow") {
    d.setDate(d.getDate() + 1);
    d.setHours(10, 0, 0, 0);
  } else return null;
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
import { useSession } from "../lib/session";
import {
  ACTIVE_STATUSES,
  STATUS_LABEL,
  StatusStepper,
  VoiceNote,
  WorkerItem,
  readError,
  type ScreenProps,
} from "./common";

// ------------------------------------------------------------------ dashboard
export function CustomerDashboard({ go, urdu, openRoleSelection }: ScreenProps) {
  const { profile, services, select } = useSession();
  const workers = useQuery(() => listWorkers(), []);
  const saved = useQuery(listSavedWorkers, []);
  const jobs = useQuery(listMyOpenJobs, []);
  const bookings = useQuery(() => listBookings("customer"), []);
  useLive(["job_offers", "bookings", "jobs"], () => {
    jobs.reload();
    bookings.reload();
  });

  const name = profile?.full_name?.split(" ")[0] || "there";
  const openWorker = (id: string) => {
    select({ workerId: id });
    go("profile");
  };
  const pendingOffers = (jobs.data ?? []).reduce(
    (n, j) => n + j.offers.filter((o) => o.status === "pending").length,
    0,
  );
  const recent = bookings.data?.[0];

  return (
    <main className="app-screen customer-portal">
      <div className="portal-accent customer" />
      <div className="dashboard-head">
        <div className="person">
          <Avatar src={profile?.avatar_url} name={profile?.full_name ?? name} />
          <div>
            <small>Assalam-o-Alaikum,</small>
            <strong>{name}!</strong>
          </div>
        </div>
        <div className="header-actions">
          <button className="switch-role-pill" onClick={openRoleSelection}>
            <Icon name="swap" size={15} />
            <span>
              Switch Role<small lang="ur">کردار تبدیل کریں</small>
            </span>
          </button>
          <button className="bell" onClick={() => go("offers")} aria-label="Offers">
            <Icon name="bell" />
            {pendingOffers > 0 && <i />}
          </button>
        </div>
      </div>
      <button className="location-chip" onClick={() => go("customer-profile")}>
        <Icon name="pin" size={16} />
        {profile?.city ?? "Islamabad"}⌄
      </button>
      <button
        className="search-field"
        onClick={() => {
          select({ serviceId: null });
          go("search");
        }}
      >
        <Icon name="search" size={19} />
        <span>What service do you need?</span>
      </button>
      <div className="section-title">
        <h3>Popular Services</h3>
        <button
          onClick={() => {
            select({ serviceId: null });
            go("search");
          }}
        >
          See all
        </button>
      </div>
      <div className="services">
        {services.map((s) => (
          <Service
            key={s.id}
            icon={serviceIcon(s.icon)}
            label={urdu && s.name_ur ? s.name_ur : s.name}
            onClick={() => {
              select({ serviceId: s.id });
              go("search");
            }}
          />
        ))}
      </div>

      <button
        className="post-job-card"
        onClick={() => {
          select({ requestWorker: null });
          go("request");
        }}
      >
        <span>
          <Icon name="briefcase" />
        </span>
        <div>
          <strong>Post a Job</strong>
          <small>Describe the work and receive offers</small>
        </div>
        <Icon name="chevron" size={18} />
      </button>
      {(jobs.data?.length ?? 0) > 0 && (
        <button className="post-job-card offers-card" onClick={() => go("offers")}>
          <span>
            <Icon name="message" />
          </span>
          <div>
            <strong>
              {jobs.data!.length} open request{jobs.data!.length > 1 ? "s" : ""}
            </strong>
            <small>
              {pendingOffers > 0
                ? `${pendingOffers} offer${pendingOffers > 1 ? "s" : ""} waiting for you`
                : "Waiting for workers to respond"}
            </small>
          </div>
          <Icon name="chevron" size={18} />
        </button>
      )}

      <div className="section-title">
        <h3>Top Rated Workers</h3>
        <button
          onClick={() => {
            select({ serviceId: null });
            go("search");
          }}
        >
          See all
        </button>
      </div>
      {workers.loading && <Loading />}
      <ErrorNote message={workers.error} />
      {workers.data?.length === 0 && (
        <Empty>No workers have joined yet. Switch role to register as the first one!</Empty>
      )}
      {workers.data?.slice(0, 2).map((w) => (
        <WorkerItem key={w.id} worker={w} onOpen={() => openWorker(w.id)} />
      ))}

      {(saved.data?.length ?? 0) > 0 && (
        <>
          <div className="section-title compact-title">
            <h3>
              <Icon name="heart" size={17} filled /> Saved Workers
            </h3>
          </div>
          {saved.data!.slice(0, 2).map((w) => (
            <WorkerItem key={w.id} worker={w} onOpen={() => openWorker(w.id)} />
          ))}
        </>
      )}

      {recent && (
        <>
          <div className="section-title compact-title">
            <h3>Recent Bookings</h3>
          </div>
          <article className="recent-booking">
            <Avatar src={recent.worker?.profile?.avatar_url} name={recent.worker?.profile?.full_name} />
            <div className="grow">
              <strong>{recent.worker?.profile?.full_name ?? "Worker"}</strong>
              <small>
                {recent.job?.title ?? "Job"} • {STATUS_LABEL[recent.status]}
              </small>
            </div>
            <button
              onClick={() => {
                if (!recent.worker) return;
                select({ workerId: recent.worker.id });
                go("profile");
              }}
            >
              Book Again
            </button>
          </article>
        </>
      )}
      <BottomNav active="Home" go={go} />
    </main>
  );
}

// ------------------------------------------------------------------ search
export function SearchScreen({ go, back }: ScreenProps) {
  const { selection, services, select } = useSession();
  const serviceId = selection.serviceId ?? null;
  const [text, setText] = useState("");
  const [filter, setFilter] = useState("All");
  const workers = useQuery(() => listWorkers(serviceId), [serviceId]);
  const saved = useQuery(listSavedWorkerIds, []);
  const engaged = useQuery(listEngagedWorkerIds, []);
  useLive(["bookings"], engaged.reload);
  const [myArea, setMyArea] = useState(() => {
    try {
      return localStorage.getItem("rr-my-area") ?? "";
    } catch {
      return "";
    }
  });
  const rememberArea = (value: string) => {
    setMyArea(value);
    try {
      localStorage.setItem("rr-my-area", value);
    } catch {
      /* private mode */
    }
  };
  const engagedIds = new Set(engaged.data ?? []);
  const distanceOf = (w: WorkerListItem) =>
    myArea.trim() ? workerDistanceKm(myArea, [w.area, ...w.service_areas]) : null;

  const query = text.trim().toLowerCase();
  let list = (workers.data ?? []).filter((w) => {
    if (!query) return true;
    const haystack = [
      w.profile?.full_name,
      w.service?.name,
      w.area,
      ...w.skills,
      ...w.service_areas,
    ]
      .join(" ")
      .toLowerCase();
    return haystack.includes(query);
  });
  if (filter === "Available") list = list.filter((w) => w.is_available && !engagedIds.has(w.id));
  if (filter === "Top Rated") list = list.filter((w) => w.rating_count > 0);
  if (filter === "Saved") list = list.filter((w) => saved.data?.includes(w.id));
  // Free workers first, then nearest, then best rated.
  list = [...list].sort((a, b) => {
    const freeA = a.is_available && !engagedIds.has(a.id) ? 0 : 1;
    const freeB = b.is_available && !engagedIds.has(b.id) ? 0 : 1;
    if (freeA !== freeB) return freeA - freeB;
    const da = distanceOf(a) ?? 99;
    const db = distanceOf(b) ?? 99;
    if (da !== db) return da - db;
    return Number(b.rating_avg) - Number(a.rating_avg);
  });

  return (
    <main className="app-screen">
      <TopBar title="Search Workers" back={back} />
      <div className="search-row">
        <div className="search-field">
          <Icon name="search" size={19} />
          <input
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Name, skill or area (e.g. G-11)"
          />
          {text && (
            <button onClick={() => setText("")} aria-label="Clear search">
              ×
            </button>
          )}
        </div>
      </div>
      <label className="my-area">
        <Icon name="pin" size={16} />
        <span>Your area</span>
        <input
          value={myArea}
          onChange={(e) => rememberArea(e.target.value)}
          placeholder="e.g. G-11 — nearest first"
        />
      </label>
      <div className="chips">
        <button className={serviceId == null ? "active" : ""} onClick={() => select({ serviceId: null })}>
          All services
        </button>
        {services.map((s) => (
          <button
            key={s.id}
            className={serviceId === s.id ? "active" : ""}
            onClick={() => select({ serviceId: s.id })}
          >
            {s.name}
          </button>
        ))}
      </div>
      <div className="chips">
        {["All", "Available", "Top Rated", "Saved"].map((item) => (
          <button key={item} className={filter === item ? "active" : ""} onClick={() => setFilter(item)}>
            {item}
          </button>
        ))}
      </div>
      <div className="card-stack" key={`${filter}-${serviceId}`}>
        {workers.loading && <Loading />}
        <ErrorNote message={workers.error} />
        {!workers.loading && list.length === 0 && <Empty>No workers match yet.</Empty>}
        {list.map((w) => (
          <WorkerItem
            key={w.id}
            worker={w}
            engaged={engagedIds.has(w.id)}
            distanceKm={distanceOf(w)}
            onOpen={() => {
              select({ workerId: w.id });
              go("profile");
            }}
          />
        ))}
      </div>
      <BottomNav active="Search" go={go} />
    </main>
  );
}

// ------------------------------------------------------------------ worker profile (customer view)
export function WorkerProfileView({ go, back, flash }: ScreenProps) {
  const { selection, select, userId } = useSession();
  const id = selection.workerId;
  const worker = useQuery(() => (id ? getWorker(id) : Promise.resolve(null)), [id]);
  const saved = useQuery(listSavedWorkerIds, []);
  const [savedOverride, setSavedOverride] = useState<boolean | null>(null);
  const isSaved = savedOverride ?? (id ? (saved.data?.includes(id) ?? false) : false);

  if (!id) return <Empty>Choose a worker first.</Empty>;
  if (worker.loading)
    return (
      <main className="profile-screen">
        <Loading />
      </main>
    );
  const w = worker.data;
  if (!w)
    return (
      <main className="app-screen">
        <TopBar back={back} />
        <ErrorNote message={worker.error ?? "Worker not found"} />
      </main>
    );
  const name = w.profile?.full_name || "Worker";
  const own = w.id === userId;

  const toggleSave = () => {
    const next = !isSaved;
    setSavedOverride(next);
    setSaved(w.id, next)
      .then(() => flash(next ? "Saved to your list" : "Removed from saved"))
      .catch((e) => {
        setSavedOverride(!next);
        flash(readError(e));
      });
  };

  const share = async () => {
    const textToShare = `${name} — ${w.service?.name ?? "Skilled worker"} on Roshan Rozgar`;
    try {
      if (navigator.share) await navigator.share({ title: "Roshan Rozgar", text: textToShare });
      else {
        await navigator.clipboard.writeText(textToShare);
        flash("Profile details copied");
      }
    } catch {
      /* share cancelled */
    }
  };

  return (
    <main className="profile-screen">
      <div className="profile-photo">
        {w.profile?.avatar_url ? (
          <img src={w.profile.avatar_url} alt={name} />
        ) : (
          <div className="profile-photo-placeholder">{name[0]?.toUpperCase()}</div>
        )}
        <button className="floating back" onClick={back} aria-label="Back">
          <Icon name="arrow" />
        </button>
        <div className="profile-actions">
          <button className="floating" onClick={share} aria-label="Share">
            <Icon name="share" />
          </button>
          {!own && (
            <button className={`floating ${isSaved ? "saved" : ""}`} onClick={toggleSave} aria-label="Save">
              <Icon name="heart" filled={isSaved} />
            </button>
          )}
        </div>
      </div>
      <div className="profile-body">
        <h1>{name}</h1>
        <div className="profile-rating">
          {w.rating_count > 0 ? (
            <>
              <span>★</span> {Number(w.rating_avg).toFixed(1)} ({w.rating_count} reviews)
            </>
          ) : (
            "No reviews yet"
          )}
          {" • "}
          {w.is_available ? "Available now" : "Currently busy"}
        </div>
        <div className="info-row">
          <span>
            <b>{w.years_experience ?? 0}</b> years exp.
          </span>
          <span>
            <Icon name="pin" size={17} />
            {w.area ?? w.profile?.city ?? "Islamabad"}
          </span>
        </div>
        <h3>{w.service?.name ?? "Skills"}</h3>
        <div className="skill-chips">
          {w.skills.length ? w.skills.map((s) => <span key={s}>{s}</span>) : <span>General work</span>}
        </div>
        {w.service_areas.length > 0 && (
          <>
            <h3>Service Areas</h3>
            <div className="services-list">
              {w.service_areas.map((a) => (
                <span key={a}>{a}</span>
              ))}
            </div>
          </>
        )}
        {(w.hourly_rate || w.fixed_rate_from) && (
          <p className="rates-line">
            {w.hourly_rate ? `${formatRs(w.hourly_rate)}/hour` : ""}
            {w.hourly_rate && w.fixed_rate_from ? " • " : ""}
            {w.fixed_rate_from ? `Fixed jobs from ${formatRs(w.fixed_rate_from)}` : ""}
          </p>
        )}
        {w.bio && <p className="bio-text">{w.bio}</p>}
        {w.voice_intro_path && (
          <>
            <h3>Voice introduction</h3>
            <VoiceNote path={w.voice_intro_path} />
          </>
        )}
        {w.reviews.length > 0 && (
          <section className="reviews-block">
            <h3>
              Reviews <span>{Number(w.rating_avg).toFixed(1)} ★</span>
            </h3>
            {w.reviews.slice(0, 3).map((r) => (
              <p key={r.id}>
                {"★".repeat(r.rating)} {r.comment ? `“${r.comment}”` : ""}
                <small> — {r.customer?.full_name ?? "Customer"}</small>
              </p>
            ))}
          </section>
        )}
        {w.portfolio.length > 0 && (
          <section className="portfolio">
            <h3>Portfolio photos</h3>
            <div>
              {w.portfolio.map((p) => (
                <img key={p.id} src={publicUrl("portfolio", p.image_path)} alt={p.caption ?? "Work photo"} />
              ))}
            </div>
          </section>
        )}
        {!own && (
          <>
            <PrimaryButton
              onClick={() => {
                select({
                  requestWorker: { id: w.id, name, serviceId: w.service_id },
                  serviceId: w.service_id,
                });
                go("request");
              }}
            >
              Request This Worker
            </PrimaryButton>
            <PrimaryButton
              outline
              onClick={() => {
                select({ chatWith: { id: w.id, name, avatar: w.profile?.avatar_url ?? null } });
                go("chat");
              }}
            >
              Contact Worker
            </PrimaryButton>
          </>
        )}
      </div>
    </main>
  );
}

// ------------------------------------------------------------------ post a job
export function RequestScreen({ go, back, flash, urdu }: ScreenProps) {
  const { selection, services, select } = useSession();
  const target = selection.requestWorker ?? null;
  const [voiceMode, setVoiceMode] = useState(true);
  const rec = useRecorder(urdu ? "ur" : "en");
  const [text, setText] = useState("");
  const [serviceId, setServiceId] = useState<number | null>(
    target?.serviceId ?? selection.serviceId ?? null,
  );
  const [area, setArea] = useState("");
  const [budget, setBudget] = useState("");
  const [when, setWhen] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (serviceId == null && services.length) setServiceId(services[0].id);
  }, [services, serviceId]);

  // When a voice note finishes, let the AI fill in the form from what was said.
  const [aiTitle, setAiTitle] = useState<string | null>(null);
  const [aiState, setAiState] = useState<"idle" | "working" | "done" | "unavailable">("idle");
  const understood = useRef("");
  const fillFromSpeech = async (spoken: string) => {
    if (!spoken.trim() || understood.current === spoken) return;
    understood.current = spoken;
    setAiState("working");
    const ai = await aiAssist("job_request", spoken);
    if (!ai) {
      setAiState("unavailable");
      return;
    }
    const service = services.find((s) => s.slug === ai.service);
    if (service && !target) setServiceId(service.id);
    if (ai.area) setArea(ai.area);
    if (ai.budget) setBudget(String(ai.budget));
    const soon = urgencyToTime(ai.urgency);
    if (soon) setWhen(soon);
    setAiTitle(ai.title);
    if (ai.description && voiceMode) rec.setTranscript(ai.description);
    setAiState("done");
  };
  useEffect(() => {
    if (voiceMode && !rec.recording && rec.blob && rec.transcript) void fillFromSpeech(rec.transcript);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rec.recording, rec.blob]);

  const submit = async () => {
    setError(null);
    const description = (voiceMode ? rec.transcript : text).trim();
    if (!description && !(voiceMode && rec.blob)) {
      setError(voiceMode ? "Record a voice note first" : "Describe the work you need");
      return;
    }
    if (!area.trim()) {
      setError("Add your area (e.g. G-11) so nearby workers can find you");
      return;
    }
    setLoading(true);
    try {
      let voicePath: string | null = null;
      if (voiceMode && rec.blob) {
        voicePath = await uploadFile("voice-notes", rec.blob, rec.blob.type.includes("mp4") ? "m4a" : "webm");
      }
      const serviceName = services.find((s) => s.id === serviceId)?.name ?? "Service";
      const title = (aiTitle || description.split(/[.!?\n۔]/)[0] || `${serviceName} job (voice note)`).slice(0, 80);
      const jobId = await postJob({
        title,
        description: description || null,
        service_id: serviceId,
        area: area.trim(),
        budget: budget ? Number(budget.replace(/[^\d]/g, "")) || null : null,
        preferred_time: when ? new Date(when).toISOString() : null,
        requested_worker_id: target?.id ?? null,
        voice_note_path: voicePath,
      });
      select({ requestWorker: null, jobId });
      flash("Request sent");
      go("offers");
    } catch (e) {
      setError(readError(e));
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="app-screen request-screen">
      <TopBar title={target ? `Request ${target.name}` : "Describe Your Job"} back={back} />
      {target && (
        <div className="target-note">
          Only {target.name} will see this request.{" "}
          <button onClick={() => select({ requestWorker: null })}>Send to all workers instead</button>
        </div>
      )}
      <div className="segment">
        <button className={voiceMode ? "active" : ""} onClick={() => setVoiceMode(true)}>
          Voice
        </button>
        <button className={!voiceMode ? "active" : ""} onClick={() => setVoiceMode(false)}>
          Text
        </button>
      </div>
      {voiceMode ? (
        <div className="voice-panel">
          <button
            className={`mic-button ${rec.recording ? "recording" : ""}`}
            onClick={() => (rec.recording ? rec.stop() : rec.start())}
            aria-label={rec.recording ? "Stop recording" : "Start recording"}
          >
            {rec.recording ? "■" : <Icon name="mic" size={45} />}
          </button>
          <strong>{rec.recording ? "Listening..." : rec.blob ? "Recording ready" : "Tap to record"}</strong>
          <small>{formatClock(rec.seconds)}</small>
          <Waveform active={rec.recording} />
          {rec.blob && !rec.recording ? (
            <textarea
              className="hint editable-hint"
              value={rec.transcript}
              onChange={(e) => rec.setTranscript(e.target.value)}
              placeholder="Add a short written description (optional)"
            />
          ) : (
            <div className="hint">{rec.transcript || "e.g. Electrical wiring in kitchen..."}</div>
          )}
          <ErrorNote message={rec.error} />
        </div>
      ) : (
        <div className="text-panel">
          <textarea
            placeholder="Describe the work you need..."
            value={text}
            onChange={(e) => setText(e.target.value)}
            onBlur={() => void fillFromSpeech(text)}
          />
          <small>You can type in English, Urdu or Roman Urdu</small>
        </div>
      )}
      {aiState === "working" && <div className="ai-status">AI is reading your request…</div>}
      {aiState === "done" && (
        <div className="ai-status done">AI filled in the details below. Check them before sending.</div>
      )}
      {aiState === "unavailable" && (
        <div className="ai-status">AI is unavailable right now. Please fill in the details below.</div>
      )}
      <div className="form-grid">
        <label className="field">
          Service
          <select value={serviceId ?? ""} onChange={(e) => setServiceId(Number(e.target.value))}>
            {services.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          Area
          <input value={area} onChange={(e) => setArea(e.target.value)} placeholder="G-11" />
        </label>
        <label className="field">
          Budget (Rs.)
          <input
            inputMode="numeric"
            value={budget}
            onChange={(e) => setBudget(e.target.value)}
            placeholder="Optional"
          />
        </label>
        <label className="field">
          When
          <input type="datetime-local" value={when} onChange={(e) => setWhen(e.target.value)} />
        </label>
      </div>
      <ErrorNote message={error} />
      <PrimaryButton loading={loading} onClick={submit}>
        Send Request
      </PrimaryButton>
    </main>
  );
}

// ------------------------------------------------------------------ offers on my jobs
export function OffersScreen({ go, back, flash }: ScreenProps) {
  const { select } = useSession();
  const jobs = useQuery(listMyOpenJobs, []);
  useLive(["job_offers", "jobs"], jobs.reload);
  const [busy, setBusy] = useState<string | null>(null);

  const run = async (id: string, action: () => Promise<void>) => {
    setBusy(id);
    try {
      await action();
    } catch (e) {
      flash(readError(e));
    } finally {
      setBusy(null);
    }
  };

  return (
    <main className="app-screen">
      <TopBar title="My Job Requests" back={back} />
      {jobs.loading && !jobs.data && <Loading />}
      <ErrorNote message={jobs.error} />
      {jobs.data?.length === 0 && (
        <Empty>
          No open requests.
          <PrimaryButton onClick={() => go("request")}>Post a Job</PrimaryButton>
        </Empty>
      )}
      <div className="job-stack">
        {jobs.data?.map((job) => {
          const pending = job.offers.filter((o) => o.status === "pending");
          return (
            <article className="request-card" key={job.id}>
              <div className="row">
                <div className="job-symbol">
                  <Icon name={serviceIcon(job.service?.icon)} />
                </div>
                <div className="grow">
                  <strong>{job.title}</strong>
                  <small>
                    <Icon name="pin" size={13} />
                    {job.area ?? job.city} • {timeAgo(job.created_at)}
                  </small>
                </div>
                <span className="urgency">{job.budget ? formatRs(job.budget) : "Open budget"}</span>
              </div>
              {job.voice_note_path && <VoiceNote path={job.voice_note_path} />}
              {pending.length === 0 ? (
                <p className="muted-line">Waiting for workers to send offers. New offers appear here live.</p>
              ) : (
                pending.map((offer) => {
                  const workerName = offer.worker?.profile?.full_name ?? "Worker";
                  return (
                    <div className="offer-card" key={offer.id}>
                      <div className="row">
                        <Avatar src={offer.worker?.profile?.avatar_url} name={workerName} />
                        <div className="grow">
                          <strong>{workerName}</strong>
                          <small>
                            {offer.worker && offer.worker.rating_count > 0
                              ? `★ ${Number(offer.worker.rating_avg).toFixed(1)} (${offer.worker.rating_count})`
                              : "New worker"}
                          </small>
                        </div>
                        <b>{formatRs(offer.proposed_price)}</b>
                      </div>
                      {offer.message && <p className="offer-message">“{offer.message}”</p>}
                      <div className="request-actions">
                        <button
                          className="decline"
                          disabled={busy === offer.id}
                          onClick={() => run(offer.id, async () => {
                            await declineOffer(offer.id);
                            jobs.reload();
                          })}
                        >
                          Decline
                        </button>
                        <button
                          className="counter"
                          onClick={() => {
                            select({
                              chatWith: {
                                id: offer.worker_id,
                                name: workerName,
                                avatar: offer.worker?.profile?.avatar_url ?? null,
                              },
                            });
                            go("chat");
                          }}
                        >
                          Chat
                        </button>
                        <button
                          className="accept"
                          disabled={busy === offer.id}
                          onClick={() => run(offer.id, async () => {
                            const bookingId = await acceptOffer(offer.id);
                            select({ bookingId: bookingId ?? undefined });
                            go("confirmed");
                          })}
                        >
                          Accept
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
              <button
                className="text-button"
                disabled={busy === job.id}
                onClick={() => run(job.id, async () => {
                  await cancelJob(job.id);
                  flash("Request cancelled");
                  jobs.reload();
                })}
              >
                Cancel this request
              </button>
            </article>
          );
        })}
      </div>
      <BottomNav active="Bookings" go={go} />
    </main>
  );
}

// ------------------------------------------------------------------ chat (both roles)
export function ChatScreen({ back }: ScreenProps) {
  const { selection, userId } = useSession();
  const partner = selection.chatWith;
  const messages = useQuery(
    () => (partner ? listConversation(partner.id) : Promise.resolve([])),
    [partner?.id],
  );
  useLive(["messages"], messages.reload);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const end = useRef<HTMLDivElement>(null);
  // Speak instead of typing: speech is turned into the message text, which the
  // sender can check before sending.
  const [voiceLang, setVoiceLang] = useState<"ur" | "en">("ur");
  const dictation = useRecorder(voiceLang);
  useEffect(() => {
    if (dictation.recording || dictation.transcript) setDraft(dictation.transcript);
  }, [dictation.transcript, dictation.recording]);

  useEffect(() => {
    end.current?.scrollIntoView({ block: "end" });
    if (partner) void markConversationRead(partner.id);
  }, [messages.data?.length, partner]);

  if (!partner)
    return (
      <main className="app-screen">
        <TopBar back={back} />
        <Empty>Open a worker or booking to start a chat.</Empty>
      </main>
    );

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const body = draft.trim();
    if (!body) return;
    setSending(true);
    setError(null);
    try {
      await sendMessage(partner.id, body);
      setDraft("");
      dictation.reset();
      messages.reload();
    } catch (err) {
      setError(readError(err));
    } finally {
      setSending(false);
    }
  };

  return (
    <main className="app-screen chat-screen">
      <TopBar back={back} title="" />
      <div className="chat-person">
        <Avatar src={partner.avatar} name={partner.name} />
        <div>
          <strong>{partner.name}</strong>
          <small>Messages are private between you two</small>
        </div>
      </div>
      <div className="messages">
        {messages.data?.length === 0 && <Empty>Say Assalam-o-Alaikum 👋</Empty>}
        {messages.data?.map((m) => (
          <div
            key={m.id}
            className={`bubble ${m.sender_id === userId ? "customer-bubble" : "worker-bubble"}`}
          >
            {m.body}
            <time>
              {new Date(m.created_at).toLocaleTimeString("en-PK", { hour: "numeric", minute: "2-digit" })}
              <button
                type="button"
                className="bubble-listen"
                onClick={() => speak(m.body, /[؀-ۿ]/.test(m.body) ? "ur" : "en")}
                aria-label="Read this message aloud"
              >
                <Icon name="speaker" size={14} />
              </button>
            </time>
          </div>
        ))}
        <div ref={end} />
      </div>
      <ErrorNote message={error ?? dictation.error} />
      {dictation.recording && (
        <div className="dictation-hint">Listening… speak your message, then tap the mic again.</div>
      )}
      <form className="chat-input" onSubmit={submit}>
        <button
          type="button"
          className="chat-lang"
          onClick={() => setVoiceLang(voiceLang === "ur" ? "en" : "ur")}
          disabled={dictation.recording}
          aria-label="Change speaking language"
        >
          {voiceLang === "ur" ? <span lang="ur">اردو</span> : "EN"}
        </button>
        <input
          placeholder={dictation.recording ? "Listening…" : "Type or tap the mic…"}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
        />
        <button
          type="button"
          className={`chat-mic ${dictation.recording ? "recording" : ""}`}
          onClick={() => (dictation.recording ? dictation.stop() : dictation.start())}
          aria-label={dictation.recording ? "Stop speaking" : "Speak a message"}
        >
          <Icon name="mic" size={19} />
        </button>
        <button disabled={sending || dictation.recording} aria-label="Send">
          <Icon name="send" size={19} />
        </button>
      </form>
    </main>
  );
}

// ------------------------------------------------------------------ booking confirmed
export function ConfirmedScreen({ go, back }: ScreenProps) {
  const { selection } = useSession();
  const id = selection.bookingId;
  const booking = useQuery(() => (id ? getBooking(id) : Promise.resolve(null)), [id]);
  const b = booking.data;
  return (
    <main className="confirmed-screen">
      <button className="back-link" onClick={back} aria-label="Back">
        <Icon name="arrow" />
      </button>
      <div className="confetti">
        {Array.from({ length: 16 }, (_, i) => (
          <i key={i} />
        ))}
      </div>
      <div className="confirm-check">
        <Icon name="check" size={54} />
      </div>
      <h1>Booking Confirmed!</h1>
      <p>
        Your booking is confirmed
        <br />
        with <strong>{b?.worker?.profile?.full_name ?? "your worker"}.</strong>
      </p>
      <article className="details-card">
        <div>
          <Icon name="calendar" />
          <span>
            <small>Date & Time</small>
            <strong>{formatWhen(b?.scheduled_at)}</strong>
          </span>
        </div>
        <div>
          <Icon name="pin" />
          <span>
            <small>Location</small>
            <strong>{[b?.area, b?.city].filter(Boolean).join(", ") || "—"}</strong>
          </span>
        </div>
        <div>
          <Icon name="briefcase" />
          <span>
            <small>Agreed Price</small>
            <strong>{formatRs(b?.agreed_price)}</strong>
          </span>
        </div>
      </article>
      <PrimaryButton onClick={() => go("bookings")}>View Booking</PrimaryButton>
    </main>
  );
}

// ------------------------------------------------------------------ my bookings (customer)
export function BookingsScreen({ go, back, flash }: ScreenProps) {
  const { select } = useSession();
  const [tab, setTab] = useState<"Upcoming" | "Completed">("Upcoming");
  const bookings = useQuery(() => listBookings("customer"), []);
  const reviewed = useQuery(listMyReviewedBookingIds, []);
  useLive(["bookings"], bookings.reload);

  const list = (bookings.data ?? []).filter((b) =>
    tab === "Upcoming" ? ACTIVE_STATUSES.includes(b.status) : !ACTIVE_STATUSES.includes(b.status),
  );

  return (
    <main className="app-screen">
      <TopBar title="My Bookings" back={back} />
      <div className="segment tabs">
        {(["Upcoming", "Completed"] as const).map((t) => (
          <button key={t} className={tab === t ? "active" : ""} onClick={() => setTab(t)}>
            {t}
          </button>
        ))}
      </div>
      {bookings.loading && !bookings.data && <Loading />}
      <ErrorNote message={bookings.error} />
      {!bookings.loading && list.length === 0 && (
        <Empty>
          {tab === "Upcoming" ? "No upcoming bookings. Accept an offer to book a worker." : "No past bookings yet."}
        </Empty>
      )}
      {list.map((b) => {
        const workerName = b.worker?.profile?.full_name ?? "Worker";
        const canRate = b.status === "done" && !reviewed.data?.includes(b.id);
        return (
          <article className="booking-card" key={b.id}>
            <div className="row">
              <Avatar src={b.worker?.profile?.avatar_url} name={workerName} />
              <div className="grow">
                <strong>{workerName}</strong>
                <small>
                  {b.worker?.service?.name ?? "Worker"} • {b.job?.title ?? "Job"}
                </small>
              </div>
              <span className={`badge ${b.status === "cancelled" ? "badge-off" : "confirmed"}`}>
                <i />
                {STATUS_LABEL[b.status]}
              </span>
            </div>
            <div className="booking-meta">
              <span>
                <Icon name="calendar" size={17} />
                {formatWhen(b.scheduled_at)}
              </span>
              <b>{formatRs(b.agreed_price)}</b>
            </div>
            {b.status !== "cancelled" && (
              <div className="track-card inline-track">
                <StatusStepper status={b.status} />
              </div>
            )}
            <div className="request-actions">
              <button
                className="counter"
                onClick={() => {
                  if (!b.worker) return;
                  select({
                    chatWith: { id: b.worker.id, name: workerName, avatar: b.worker.profile?.avatar_url ?? null },
                  });
                  go("chat");
                }}
              >
                Chat
              </button>
              {b.status === "confirmed" && (
                <button
                  className="decline"
                  onClick={() =>
                    updateBookingStatus(b.id, "cancelled")
                      .then(() => {
                        flash("Booking cancelled");
                        bookings.reload();
                      })
                      .catch((e) => flash(readError(e)))
                  }
                >
                  Cancel
                </button>
              )}
              {canRate && (
                <button
                  className="accept"
                  onClick={() => {
                    select({ bookingId: b.id });
                    go("rating");
                  }}
                >
                  Rate Worker
                </button>
              )}
            </div>
          </article>
        );
      })}
      <BottomNav active="Bookings" go={go} />
    </main>
  );
}

// ------------------------------------------------------------------ rate a worker
const RATING_LABEL = ["", "Poor", "Below average", "Good", "Very good", "Excellent service"];

export function RatingScreen({ go, back, flash }: ScreenProps) {
  const { selection } = useSession();
  const id = selection.bookingId;
  const booking = useQuery(() => (id ? getBooking(id) : Promise.resolve(null)), [id]);
  const [stars, setStars] = useState(5);
  const [comment, setComment] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    const b = booking.data;
    if (!b) return;
    setLoading(true);
    setError(null);
    try {
      await submitReview(b.id, b.worker_id, stars, comment.trim() || null);
      flash("Thank you for your rating");
      go("bookings");
    } catch (e) {
      setError(readError(e));
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="rating-screen">
      <button className="back-link" onClick={back} aria-label="Back">
        <Icon name="arrow" />
      </button>
      <div className="star-hero">
        <Icon name="star" size={90} filled />
      </div>
      <h1>Rate {booking.data?.worker?.profile?.full_name ?? "your worker"}</h1>
      <p>
        Your rating helps
        <br />
        others choose with confidence.
      </p>
      <Stars value={stars} onChange={setStars} />
      <p className="rating-label">{RATING_LABEL[stars]}</p>
      <textarea
        className="rating-comment"
        placeholder="Write a short review (optional)"
        value={comment}
        onChange={(e) => setComment(e.target.value)}
      />
      <ErrorNote message={error ?? booking.error} />
      <PrimaryButton loading={loading} onClick={submit}>
        Submit Rating
      </PrimaryButton>
    </main>
  );
}

// ------------------------------------------------------------------ customer profile
export function CustomerProfile({ go, back, flash, openRoleSelection }: ScreenProps) {
  const { profile, refreshAccount } = useSession();
  const saved = useQuery(listSavedWorkerIds, []);
  const bookings = useQuery(() => listBookings("customer"), []);
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(profile?.full_name ?? "");
  const [city, setCity] = useState(profile?.city ?? "Islamabad");
  const [uploading, setUploading] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);

  const save = async () => {
    try {
      await updateProfile({ full_name: name.trim() || null, city: city.trim() || "Islamabad" });
      await refreshAccount();
      setEditing(false);
      flash("Profile updated");
    } catch (e) {
      flash(readError(e));
    }
  };

  const changePhoto = async (file: File | undefined) => {
    if (!file) return;
    setUploading(true);
    try {
      const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
      const path = await uploadFile("avatars", file, ext);
      await updateProfile({ avatar_url: publicUrl("avatars", path) });
      await refreshAccount();
      flash("Photo updated");
    } catch (e) {
      flash(readError(e));
    } finally {
      setUploading(false);
    }
  };

  const done = (bookings.data ?? []).filter((b) => b.status === "done").length;

  return (
    <main className="app-screen portal-profile customer-portal">
      <TopBar title="Profile" back={back} />
      <RoleSwitchRow onClick={openRoleSelection} />
      <div className="profile-summary">
        <button className="avatar-button" onClick={() => fileInput.current?.click()} aria-label="Change photo">
          <Avatar src={profile?.avatar_url} name={profile?.full_name} />
          <small>{uploading ? "..." : "Edit"}</small>
        </button>
        <input
          ref={fileInput}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          hidden
          onChange={(e) => changePhoto(e.target.files?.[0])}
        />
        {editing ? (
          <div className="grow form-grid single">
            <label className="field">
              Name
              <input value={name} onChange={(e) => setName(e.target.value)} />
            </label>
            <label className="field">
              City
              <input value={city} onChange={(e) => setCity(e.target.value)} />
            </label>
            <div className="request-actions">
              <button className="decline" onClick={() => setEditing(false)}>
                Cancel
              </button>
              <button className="accept" onClick={save}>
                Save
              </button>
            </div>
          </div>
        ) : (
          <div>
            <h2>{profile?.full_name || "Add your name"}</h2>
            <p>
              {profile?.city ?? "Islamabad"} • Customer{" "}
              <button className="text-button inline" onClick={() => setEditing(true)}>
                Edit
              </button>
            </p>
          </div>
        )}
      </div>
      <ProfileRow
        icon="heart"
        title="Saved Workers"
        detail={`${saved.data?.length ?? 0} trusted professionals`}
        onClick={() => go("search")}
      />
      <ProfileRow
        icon="briefcase"
        title="My job requests"
        detail="See offers from workers"
        onClick={() => go("offers")}
      />
      <ProfileRow
        icon="calendar"
        title="Booking history"
        detail={`${done} completed booking${done === 1 ? "" : "s"}`}
        onClick={() => go("bookings")}
      />
      <ProfileRow
        icon="user"
        title="Sign out"
        detail="Log out of this device"
        onClick={async () => {
          await signOut();
          go("home");
        }}
      />
      <BottomNav active="Profile" go={go} />
    </main>
  );
}
