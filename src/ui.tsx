import type { ReactNode, CSSProperties } from "react";

export type ScreenId =
  | "splash"
  | "home"
  | "customer-welcome"
  | "worker-welcome"
  | "customer-dashboard"
  | "search"
  | "profile"
  | "request"
  | "chat"
  | "confirmed"
  | "bookings"
  | "voice-register"
  | "ai-extraction"
  | "worker-dashboard"
  | "find-work"
  | "apply"
  | "worker-bookings"
  | "customer-profile"
  | "earnings"
  | "worker-profile"
  | "rating"
  | "auth"
  | "offers";

export type Role = "customer" | "worker";

export type IconName =
  | "home"
  | "search"
  | "calendar"
  | "user"
  | "bell"
  | "pin"
  | "bolt"
  | "drop"
  | "hammer"
  | "snow"
  | "mic"
  | "chevron"
  | "arrow"
  | "share"
  | "heart"
  | "check"
  | "send"
  | "shield"
  | "star"
  | "hardhat"
  | "briefcase"
  | "message"
  | "filter"
  | "swap"
  | "wallet"
  | "speaker";

export function Icon({
  name,
  size = 24,
  filled = false,
}: {
  name: IconName;
  size?: number;
  filled?: boolean;
}) {
  const paths: Record<IconName, ReactNode> = {
    home: (
      <>
        <path d="M3 11.5 12 4l9 7.5" />
        <path d="M5.5 10v10h13V10M9 20v-6h6v6" />
      </>
    ),
    search: (
      <>
        <circle cx="11" cy="11" r="6.5" />
        <path d="m16 16 5 5" />
      </>
    ),
    calendar: (
      <>
        <rect x="3" y="5" width="18" height="16" rx="3" />
        <path d="M8 3v4m8-4v4M3 10h18" />
      </>
    ),
    user: (
      <>
        <circle cx="12" cy="8" r="4" />
        <path d="M4.5 21c.7-4.2 3.2-6 7.5-6s6.8 1.8 7.5 6" />
      </>
    ),
    bell: (
      <>
        <path d="M6 17h12l-1.5-2.5V10a4.5 4.5 0 0 0-9 0v4.5L6 17Z" />
        <path d="M10 20h4" />
      </>
    ),
    pin: (
      <>
        <path d="M20 10c0 5-8 11-8 11S4 15 4 10a8 8 0 1 1 16 0Z" />
        <circle cx="12" cy="10" r="2.5" />
      </>
    ),
    bolt: <path d="m13 2-8 12h7l-1 8 8-12h-7l1-8Z" />,
    drop: <path d="M12 2S5 10.2 5 15a7 7 0 0 0 14 0c0-4.8-7-13-7-13Z" />,
    hammer: (
      <>
        <path d="m14 6 4-4 4 4-4 4" />
        <path d="m16 8-3 3M4 20l9-9 3 3-9 9Z" />
      </>
    ),
    snow: (
      <>
        <path d="M12 2v20M4 7l16 10M4 17 20 7" />
        <path d="m9 4 3 3 3-3M9 20l3-3 3 3" />
      </>
    ),
    mic: (
      <>
        <rect x="8" y="3" width="8" height="13" rx="4" />
        <path d="M5 12a7 7 0 0 0 14 0M12 19v3" />
      </>
    ),
    chevron: <path d="m9 6 6 6-6 6" />,
    arrow: <path d="m15 18-6-6 6-6" />,
    share: (
      <>
        <circle cx="18" cy="5" r="2.5" />
        <circle cx="6" cy="12" r="2.5" />
        <circle cx="18" cy="19" r="2.5" />
        <path d="m8.2 10.8 7.5-4.5m-7.5 6.9 7.5 4.5" />
      </>
    ),
    heart: (
      <path
        fill={filled ? "currentColor" : "none"}
        d="M20.8 5.8c-2.6-2.7-6.8-1.2-8.8 1.4-2-2.6-6.2-4.1-8.8-1.4C.2 9 3 14.7 12 21c9-6.3 11.8-12 8.8-15.2Z"
      />
    ),
    check: <path d="m5 12 4 4L19 6" />,
    send: <path d="m3 3 19 9-19 9 4-9-4-9Zm4 9h15" />,
    shield: (
      <>
        <path d="M12 2 4 5v6c0 5.4 3 8.8 8 11 5-2.2 8-5.6 8-11V5l-8-3Z" />
        <path d="m8.5 12 2.2 2.2L16 9" />
      </>
    ),
    star: (
      <path
        fill={filled ? "currentColor" : "none"}
        d="m12 2.5 3 6 6.6 1-4.8 4.7 1.2 6.6-6-3.1-6 3.1 1.2-6.6-4.8-4.7 6.6-1 3-6Z"
      />
    ),
    hardhat: (
      <>
        <path d="M4 14a8 8 0 0 1 16 0" />
        <path d="M2 14h20v4H2zM9 6v8m6-8v8" />
      </>
    ),
    briefcase: (
      <>
        <rect x="3" y="7" width="18" height="14" rx="2" />
        <path d="M9 7V4h6v3M3 13h18M10 12h4v3h-4z" />
      </>
    ),
    message: <path d="M4 4h16v13H9l-5 4V4Z" />,
    filter: <path d="M4 6h16M7 12h10m-7 6h4" />,
    swap: (
      <>
        <path d="M4 8h13l-3-3m3 3-3 3" />
        <path d="M20 16H7l3 3m-3-3 3-3" />
      </>
    ),
    wallet: (
      <>
        <path d="M4 6h15a2 2 0 0 1 2 2v11H4a2 2 0 0 1-2-2V6a3 3 0 0 1 3-3h13" />
        <path d="M15 11h6v5h-6a2.5 2.5 0 0 1 0-5Z" />
      </>
    ),
    speaker: (
      <>
        <path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4z" />
        <path d="M15.5 9a4 4 0 0 1 0 6M18 6.5a7.5 7.5 0 0 1 0 11" />
      </>
    ),
  };
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.9"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {paths[name]}
    </svg>
  );
}

export function Logo({ compact = false }: { compact?: boolean }) {
  return (
    <div className={`logo ${compact ? "logo-compact" : ""}`} aria-label="Roshan Rozgar">
      <div className="logo-mark">
        <svg viewBox="0 0 80 74" aria-hidden="true">
          <path
            d="M9 34 40 8l31 26v31H51V46H29v19H9V34Z"
            fill="none"
            stroke="#0B5D3B"
            strokeWidth="6"
            strokeLinejoin="round"
          />
          <path
            d="m22 42 12 11 9-8 15 13"
            fill="none"
            stroke="#D9A520"
            strokeWidth="7"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path
            d="m28 54 9 8 14-13"
            fill="none"
            stroke="#0B5D3B"
            strokeWidth="7"
            strokeLinecap="round"
          />
        </svg>
      </div>
      {!compact && (
        <div className="logo-copy">
          <strong>Roshan Rozgar</strong>
          <span lang="ur" dir="rtl">
            روشن روزگار
          </span>
        </div>
      )}
    </div>
  );
}

export function PrimaryButton({
  children,
  onClick,
  loading = false,
  outline = false,
  disabled = false,
}: {
  children: ReactNode;
  onClick?: () => void;
  loading?: boolean;
  outline?: boolean;
  disabled?: boolean;
}) {
  return (
    <button
      disabled={disabled || loading}
      className={`primary-button ${outline ? "outline" : ""} ${loading ? "loading" : ""}`}
      onClick={onClick}
    >
      {loading ? <span className="spinner" /> : children}
    </button>
  );
}

// Bar shape so the meter looks like a voice wave, not a flat block.
const WAVE_SHAPE = Array.from({ length: 25 }, (_, i) => 0.35 + 0.65 * Math.sin((i / 24) * Math.PI) * (0.6 + 0.4 * Math.abs(Math.sin(i * 1.7))));

/**
 * Shows that the microphone is hearing something.
 * - `level` (0..1): real loudness from the mic, when available.
 * - otherwise `hearing`: the speech recogniser detected speech.
 * When recording but nothing is heard, the bars stay low (honest feedback).
 */
export function Waveform({
  active,
  level,
  hearing = false,
}: {
  active: boolean;
  level?: number;
  hearing?: boolean;
}) {
  if (active && level != null) {
    return (
      <div className="waveform live" aria-hidden="true">
        {WAVE_SHAPE.map((shape, i) => (
          <i key={i} style={{ height: `${6 + Math.round(level * 52 * shape)}px` }} />
        ))}
      </div>
    );
  }
  return (
    <div className={`waveform ${active && hearing ? "active" : ""} ${active && !hearing ? "waiting" : ""}`} aria-hidden="true">
      {Array.from({ length: 25 }, (_, i) => (
        <i key={i} style={{ "--i": i } as CSSProperties} />
      ))}
    </div>
  );
}

export function RoleSwitchRow({ onClick }: { onClick: () => void }) {
  return (
    <button className="role-switch-row" onClick={onClick}>
      <span>
        <Icon name="swap" />
      </span>
      <div>
        <strong>Switch Role</strong>
        <small lang="ur">کردار تبدیل کریں</small>
      </div>
      <Icon name="chevron" size={18} />
    </button>
  );
}

export function ProfileRow({
  icon,
  title,
  detail,
  onClick,
}: {
  icon: IconName;
  title: string;
  detail: string;
  onClick?: () => void;
}) {
  return (
    <button className="profile-row" onClick={onClick}>
      <span>
        <Icon name={icon} />
      </span>
      <div>
        <strong>{title}</strong>
        <small>{detail}</small>
      </div>
      <Icon name="chevron" size={18} />
    </button>
  );
}


export function Avatar({
  src,
  name,
  large = false,
}: {
  src?: string | null;
  name?: string | null;
  large?: boolean;
}) {
  if (src)
    return (
      <img className={`avatar ${large ? "avatar-large" : ""}`} src={src} alt={name ?? "Profile photo"} />
    );
  return (
    <div className={`avatar avatar-initial ${large ? "avatar-large" : ""}`} aria-label={name ?? "User"}>
      {(name?.trim()[0] ?? "?").toUpperCase()}
    </div>
  );
}

export function Stars({
  value = 5,
  onChange,
  size = 22,
}: {
  value?: number;
  onChange?: (value: number) => void;
  size?: number;
}) {
  return (
    <div className={`stars ${onChange ? "interactive" : ""}`}>
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          disabled={!onChange}
          onClick={() => onChange?.(n)}
          aria-label={`${n} stars`}
        >
          <Icon name="star" size={size} filled={n <= Math.round(value)} />
        </button>
      ))}
    </div>
  );
}

export function BottomNav({
  active = "Home",
  workerMode = false,
  go,
}: {
  active?: string;
  workerMode?: boolean;
  go: (id: ScreenId) => void;
}) {
  const items: [string, IconName, ScreenId][] = workerMode
    ? [
        ["Home", "home", "worker-dashboard"],
        ["Jobs", "briefcase", "find-work"],
        ["Earnings", "wallet", "earnings"],
        ["Profile", "user", "worker-profile"],
      ]
    : [
        ["Home", "home", "customer-dashboard"],
        ["Search", "search", "search"],
        ["Bookings", "calendar", "bookings"],
        ["Profile", "user", "customer-profile"],
      ];
  return (
    <nav className="bottom-nav">
      {items.map(([label, icon, target]) => (
        <button key={label} className={active === label ? "active" : ""} onClick={() => go(target)}>
          <Icon name={icon} size={21} />
          <span>{label}</span>
        </button>
      ))}
    </nav>
  );
}

export function TopBar({
  title,
  back,
  action,
}: {
  title?: string;
  back?: () => void;
  action?: ReactNode;
}) {
  return (
    <header className="topbar">
      {back ? (
        <button className="icon-button" onClick={back} aria-label="Back">
          <Icon name="arrow" size={22} />
        </button>
      ) : (
        <Logo compact />
      )}
      <strong>{title}</strong>
      <div>{action}</div>
    </header>
  );
}

export function Service({
  icon,
  label,
  onClick,
}: {
  icon: IconName;
  label: string;
  onClick: () => void;
}) {
  return (
    <button className="service-item" onClick={onClick}>
      <span>
        <Icon name={icon} />
      </span>
      <small>{label}</small>
    </button>
  );
}

export function WorkerCard({
  name,
  avatar,
  service,
  rating,
  ratingCount,
  price,
  available,
  engaged = false,
  distanceKm = null,
  onClick,
}: {
  name: string;
  avatar?: string | null;
  service?: string | null;
  rating: number;
  ratingCount: number;
  price?: number | null;
  available: boolean;
  /** Has a booking right now (from the database), regardless of the toggle. */
  engaged?: boolean;
  distanceKm?: number | null;
  onClick: () => void;
}) {
  const free = available && !engaged;
  return (
    <article className="worker-card tappable" onClick={onClick}>
      <Avatar src={avatar} name={name} />
      <div className="grow">
        <div className="row">
          <strong>{name}</strong>
          <span className={`badge ${free ? "" : "badge-off"}`}>
            <i />
            {engaged ? "On a job" : available ? "Available" : "Busy"}
          </span>
        </div>
        <small>
          {service ?? "Skilled worker"}
          {distanceKm != null && (
            <span className="distance"> · {distanceKm === 0 ? "Your area" : `~${distanceKm} km away`}</span>
          )}
        </small>
        <div className="rating">
          {ratingCount > 0 ? `★ ${rating.toFixed(1)} (${ratingCount})` : "New on Roshan Rozgar"}
        </div>
        {price ? <b>From {formatRs(price)}</b> : <b>Price on request</b>}
      </div>
      <span className="mini-link">View Profile</span>
    </article>
  );
}

export function Empty({ children }: { children: ReactNode }) {
  return <div className="empty-state">{children}</div>;
}

export function Loading() {
  return (
    <div className="empty-state">
      <span className="spinner dark" /> Loading...
    </div>
  );
}

export function ErrorNote({ message }: { message: string | null | undefined }) {
  if (!message) return null;
  return <div className="error-note">{message}</div>;
}

export function formatRs(amount: number | null | undefined) {
  if (amount == null) return "Rs. —";
  return `Rs. ${amount.toLocaleString("en-PK")}`;
}

export function formatWhen(iso: string | null | undefined) {
  if (!iso) return "Time to be agreed";
  const date = new Date(iso);
  const now = new Date();
  const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const diffDays = Math.round((startOfDay(date) - startOfDay(now)) / 86400000);
  const time = date.toLocaleTimeString("en-PK", { hour: "numeric", minute: "2-digit" });
  if (diffDays === 0) return `Today, ${time}`;
  if (diffDays === 1) return `Tomorrow, ${time}`;
  if (diffDays === -1) return `Yesterday, ${time}`;
  return `${date.toLocaleDateString("en-PK", { day: "numeric", month: "short" })}, ${time}`;
}

export function timeAgo(iso: string) {
  const minutes = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.round(hours / 24)}d ago`;
}

export const serviceIcon = (icon: string | null | undefined): IconName =>
  (["bolt", "drop", "hammer", "snow"].includes(icon ?? "") ? icon : "briefcase") as IconName;
