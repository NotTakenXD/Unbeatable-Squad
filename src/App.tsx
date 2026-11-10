import { useEffect, useRef, useState, type ReactNode } from "react";
import { Icon, Logo, PrimaryButton, type Role, type ScreenId } from "./ui";
import { SessionProvider, useSession } from "./lib/session";
import { updateProfile } from "./lib/api";
import { authLinkError } from "./lib/supabase";
import type { ScreenProps } from "./screens/common";
import { AuthScreen } from "./screens/auth";
import {
  BookingsScreen,
  ChatScreen,
  ConfirmedScreen,
  CustomerDashboard,
  CustomerProfile,
  OffersScreen,
  RatingScreen,
  RequestScreen,
  SearchScreen,
  WorkerProfileView,
} from "./screens/customer";
import {
  ApplyScreen,
  Earnings,
  FindWork,
  VoiceRegister,
  WorkerBookings,
  WorkerDashboard,
  WorkerDetailsForm,
  WorkerOwnProfile,
} from "./screens/worker";

const DASHBOARDS: ScreenId[] = [
  "customer-dashboard",
  "worker-dashboard",
  "customer-profile",
  "worker-profile",
];
// Screens that need a signed-in user.
const PUBLIC_SCREENS: ScreenId[] = ["splash", "home", "auth"];

function Shell({
  urdu,
  toast,
  showRoleSwitch,
  onRoleSwitch,
  className = "",
  children,
}: {
  urdu: boolean;
  toast: string;
  showRoleSwitch: boolean;
  onRoleSwitch: () => void;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div
      className={`screen ${className} ${urdu ? "urdu-mode" : ""} ${showRoleSwitch ? "with-role-strip" : ""}`}
      dir={urdu ? "rtl" : "ltr"}
    >
      {toast && <div className="toast">{toast}</div>}
      {showRoleSwitch && (
        <div className="role-strip">
          <button className="global-role-switch" onClick={onRoleSwitch}>
            <Icon name="swap" size={15} />
            Switch Role
          </button>
        </div>
      )}
      {children}
    </div>
  );
}

function Splash({ go }: { go: (id: ScreenId) => void }) {
  const goRef = useRef(go);
  goRef.current = go;
  useEffect(() => {
    const timer = window.setTimeout(() => goRef.current("home"), 2000);
    return () => window.clearTimeout(timer);
  }, []);
  return (
    <main className="splash-content">
      <div className="splash-logo">
        <Logo />
      </div>
      <p>
        Awaz se kaam,
        <br />
        bharose ke saath.
      </p>
      <small>Work through your voice. Trust through experience.</small>
      <svg className="mosque-art" viewBox="0 0 390 120" preserveAspectRatio="xMidYMax slice" aria-hidden="true">
        <path d="M0 92 C70 70 120 84 195 80 C270 76 320 66 390 82 V120 H0Z" fill="#1e8e5a" opacity=".35" />
        {/* minarets */}
        <rect x="128" y="34" width="12" height="62" rx="2" />
        <path d="M126 36 L134 18 L142 36Z" />
        <rect x="250" y="34" width="12" height="62" rx="2" />
        <path d="M248 36 L256 18 L264 36Z" />
        {/* prayer hall + dome */}
        <rect x="150" y="66" width="90" height="30" rx="2" />
        <path d="M160 68 C160 40 178 30 195 26 C212 30 230 40 230 68Z" />
        <rect x="193.5" y="12" width="3" height="16" rx="1.5" />
        <circle cx="195" cy="11" r="3.5" />
        <path d="M0 100 C80 90 140 98 195 96 C260 94 320 88 390 98 V120 H0Z" />
      </svg>
    </main>
  );
}

function Home({
  role,
  urdu,
  setUrdu,
  selectRole,
  notice,
}: {
  role: Role | null;
  urdu: boolean;
  setUrdu: (v: boolean) => void;
  selectRole: (role: Role) => void;
  notice?: string | null;
}) {
  const [langOpen, setLangOpen] = useState(false);
  return (
    <main className="home-screen">
      {notice && <div className="notice-note">{notice}</div>}
      <div className="home-head">
        <Logo compact />
        <button className="language" onClick={() => setLangOpen(!langOpen)}>
          {urdu ? "اردو" : "EN"}⌄
        </button>
        {langOpen && (
          <div className="language-menu">
            <button
              onClick={() => {
                setUrdu(false);
                setLangOpen(false);
              }}
            >
              English
            </button>
            <button
              onClick={() => {
                setUrdu(true);
                setLangOpen(false);
              }}
            >
              اردو
            </button>
          </div>
        )}
      </div>
      <section className="home-hero">
        <div>
          <h1>
            Skilled workers,
            <br />
            just a few steps away.
          </h1>
          <p lang="ur" dir="rtl">
            ماہر کاریگر، آپ کے قریب
          </p>
        </div>
        <img src="/assets/worker-hero.jpg" alt="Smiling skilled worker in a hard hat" />
      </section>
      <div className="role-grid">
        <article className={`role-card ${role === "customer" ? "current-role" : ""}`}>
          {role === "customer" && <span className="current-badge">Current</span>}
          <div className="role-icon">
            <Icon name="home" size={32} />
          </div>
          <h3>I need a worker</h3>
          <p lang="ur">مجھے کاریگر چاہیے</p>
          <PrimaryButton onClick={() => selectRole("customer")}>Continue</PrimaryButton>
        </article>
        <article className={`role-card ${role === "worker" ? "current-role" : ""}`}>
          {role === "worker" && <span className="current-badge">Current</span>}
          <div className="role-icon gold">
            <Icon name="hardhat" size={32} />
          </div>
          <h3>I want to find work</h3>
          <p lang="ur">میں کام تلاش کرنا چاہتا ہوں</p>
          <PrimaryButton onClick={() => selectRole("worker")}>Continue</PrimaryButton>
        </article>
      </div>
      <p className="tagline">Awaz se kaam, bharose ke saath.</p>
    </main>
  );
}

function CustomerWelcome({ go }: { go: (id: ScreenId) => void }) {
  return (
    <main
      className="welcome-screen"
      onClick={() => go("customer-dashboard")}
      role="button"
      tabIndex={0}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") go("customer-dashboard");
      }}
    >
      <div className="welcome-landscape">
        <div className="sun" />
        <div className="mountain m1" />
        <div className="mountain m2" />
        <div className="little-house">⌂</div>
      </div>
      <div className="welcome-icon">
        <Icon name="home" size={55} />
        <b>
          <Icon name="check" size={20} />
        </b>
      </div>
      <h1>Welcome!</h1>
      <h2>
        Find a skilled worker
        <br />
        near you.
      </h2>
      <p lang="ur" dir="rtl">
        اپنے قریب ماہر کاریگر تلاش کریں
      </p>
      <small className="tap-hint">Tap anywhere to continue</small>
    </main>
  );
}

function WorkerWelcome({ go }: { go: (id: ScreenId) => void }) {
  return (
    <main className="welcome-screen worker-welcome">
      <div className="welcome-icon">
        <Icon name="hardhat" size={62} />
      </div>
      <h1>Welcome!</h1>
      <h2>Ready to find work?</h2>
      <p>
        Just speak or register
        <br />
        to create your profile.
      </p>
      <p lang="ur" dir="rtl">
        کام تلاش کرنے کے لیے تیار ہیں؟
      </p>
      <img src="/assets/worker-hero.jpg" alt="Worker standing ready for work" />
      <PrimaryButton onClick={() => go("voice-register")}>Start Registration</PrimaryButton>
    </main>
  );
}

function Router() {
  const { ready, session, worker, profile, accountReady } = useSession();
  const [current, setCurrent] = useState<ScreenId>("splash");
  const [history, setHistory] = useState<ScreenId[]>([]);
  const [direction, setDirection] = useState<"forward" | "back" | "down">("forward");
  const [role, setRole] = useState<Role | null>(null);
  const [pendingRole, setPendingRole] = useState<Role | null>(null);
  const [visitedRoles, setVisitedRoles] = useState<Role[]>([]);
  const [urdu, setUrdu] = useState(false);
  const [toast, setToast] = useState("");
  const toastTimer = useRef<number | null>(null);
  // Shown when the user opened a used/expired confirmation link; cleared once they're signed in.
  const [authNotice, setAuthNotice] = useState<string | null>(authLinkError);

  useEffect(() => {
    if (session) setAuthNotice(null);
  }, [session]);

  useEffect(() => {
    if (profile?.preferred_language === "ur") setUrdu(true);
  }, [profile?.preferred_language]);

  const flash = (message: string) => {
    setToast(message);
    if (toastTimer.current) window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToast(""), 2200);
  };

  const navigate = (next: ScreenId) => {
    setDirection("forward");
    setHistory((previous) => (next === "splash" || next === "home" ? [] : [...previous, current]));
    setCurrent(next);
  };

  const enterRole = (nextRole: Role) => {
    const repeatVisit = visitedRoles.includes(nextRole);
    setRole(nextRole);
    setVisitedRoles((roles) => (roles.includes(nextRole) ? roles : [...roles, nextRole]));
    setHistory([]);
    setDirection("forward");
    void updateProfile({ last_role: nextRole }).catch(() => undefined);
    if (nextRole === "customer") setCurrent(repeatVisit ? "customer-dashboard" : "customer-welcome");
    else setCurrent(worker ? "worker-dashboard" : "worker-welcome");
  };

  const selectRole = (nextRole: Role) => {
    if (!session) {
      setPendingRole(nextRole);
      setDirection("forward");
      setHistory(["home"]);
      setCurrent("auth");
      return;
    }
    enterRole(nextRole);
  };

  // If the user signs out (or the session expires) send them back to the start.
  useEffect(() => {
    if (ready && !session && !PUBLIC_SCREENS.includes(current)) {
      setRole(null);
      setHistory([]);
      setCurrent("home");
    }
  }, [ready, session, current]);

  // After signing in (and once their profile has loaded), continue to the role they picked.
  useEffect(() => {
    if (session && accountReady && current === "auth" && pendingRole) {
      const next = pendingRole;
      setPendingRole(null);
      enterRole(next);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session, accountReady, current, pendingRole]);

  const openRoleSelection = () => {
    setDirection("down");
    setHistory((previous) => [...previous, current]);
    setCurrent("home");
  };

  const goBack = () => {
    const previous = history.at(-1);
    if (!previous) {
      const fallback: ScreenId =
        role === "worker" ? "worker-dashboard" : role === "customer" ? "customer-dashboard" : "home";
      if (fallback !== current) {
        setDirection("back");
        setCurrent(fallback);
      }
      return;
    }
    setDirection("back");
    setHistory((items) => items.slice(0, -1));
    setCurrent(previous);
  };

  const props: ScreenProps = { go: navigate, back: goBack, flash, urdu, openRoleSelection };

  const render = (): { node: ReactNode; className?: string } => {
    switch (current) {
      case "splash":
        return { node: <Splash go={navigate} />, className: "splash-screen" };
      case "home":
        return {
          node: (
            <Home
              role={role}
              urdu={urdu}
              setUrdu={setUrdu}
              selectRole={selectRole}
              notice={session ? null : authNotice}
            />
          ),
        };
      case "auth":
        return {
          node: <AuthScreen role={pendingRole} back={goBack} initialNotice={authNotice} />,
        };
      case "customer-welcome":
        return { node: <CustomerWelcome go={navigate} />, className: "welcome-bg" };
      case "worker-welcome":
        return { node: <WorkerWelcome go={navigate} /> };
      case "customer-dashboard":
        return { node: <CustomerDashboard {...props} /> };
      case "search":
        return { node: <SearchScreen {...props} /> };
      case "profile":
        return { node: <WorkerProfileView {...props} /> };
      case "request":
        return { node: <RequestScreen {...props} /> };
      case "offers":
        return { node: <OffersScreen {...props} /> };
      case "chat":
        return { node: <ChatScreen {...props} /> };
      case "confirmed":
        return { node: <ConfirmedScreen {...props} /> };
      case "bookings":
        return { node: <BookingsScreen {...props} /> };
      case "rating":
        return { node: <RatingScreen {...props} /> };
      case "customer-profile":
        return { node: <CustomerProfile {...props} /> };
      case "voice-register":
        return { node: <VoiceRegister {...props} /> };
      case "ai-extraction":
        return { node: <WorkerDetailsForm {...props} /> };
      case "worker-dashboard":
        return { node: <WorkerDashboard {...props} /> };
      case "find-work":
        return { node: <FindWork {...props} /> };
      case "apply":
        return { node: <ApplyScreen {...props} /> };
      case "worker-bookings":
        return { node: <WorkerBookings {...props} /> };
      case "earnings":
        return { node: <Earnings {...props} /> };
      case "worker-profile":
        return { node: <WorkerOwnProfile {...props} /> };
    }
  };

  const { node, className } = render();
  const showRoleSwitch =
    !!role && !PUBLIC_SCREENS.includes(current) && !DASHBOARDS.includes(current) && current !== "chat";

  return (
    <main className="app-viewport">
      <div className={`screen-transition ${direction}`} key={current}>
        <Shell
          urdu={urdu}
          toast={toast}
          showRoleSwitch={showRoleSwitch}
          onRoleSwitch={openRoleSelection}
          className={className}
        >
          {node}
        </Shell>
      </div>
    </main>
  );
}

export default function App() {
  return (
    <SessionProvider>
      <Router />
    </SessionProvider>
  );
}
