import { useState, type FormEvent } from "react";
import { ErrorNote, Icon, Logo, PrimaryButton, TopBar, type Role } from "../ui";
import {
  EmailNotConfirmedError,
  hasDeviceAccount,
  quickStartWorker,
  resendConfirmation,
  signIn,
  signUp,
} from "../lib/api";
import { speak } from "../lib/hooks";
import { readError } from "./common";

/** After a successful sign-in the router notices the new session and moves on. */
export function AuthScreen({
  role,
  back,
  initialNotice = null,
}: {
  role: Role | null;
  back: () => void;
  initialNotice?: string | null;
}) {
  const [mode, setMode] = useState<"signup" | "signin">(initialNotice ? "signin" : "signup");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(initialNotice);
  const [canResend, setCanResend] = useState(!!initialNotice);
  const [resending, setResending] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setNotice(null);
    setCanResend(false);
    if (mode === "signup" && !name.trim()) return setError("Please enter your name");
    if (password.length < 6) return setError("Password must be at least 6 characters");
    setLoading(true);
    try {
      if (mode === "signup") {
        const { needsConfirmation } = await signUp(email.trim(), password, name.trim());
        if (needsConfirmation) {
          setNotice(
            `Almost done! We sent a confirmation link to ${email.trim()}. Open it on this device, then sign in here. Check your spam folder if you don't see it.`,
          );
          setCanResend(true);
          setMode("signin");
          return;
        }
      } else {
        await signIn(email.trim(), password);
      }
    } catch (err) {
      setError(readError(err));
      if (err instanceof EmailNotConfirmedError) setCanResend(true);
    } finally {
      setLoading(false);
    }
  };

  const [quickLoading, setQuickLoading] = useState(false);
  const startWorker = async () => {
    setError(null);
    setQuickLoading(true);
    try {
      await quickStartWorker();
    } catch (err) {
      setError(readError(err));
    } finally {
      setQuickLoading(false);
    }
  };

  const resend = async () => {
    if (!email.trim()) return setError("Enter your email above first");
    setError(null);
    setResending(true);
    try {
      await resendConfirmation(email.trim());
      setNotice(`New confirmation link sent to ${email.trim()}. Only the newest link works.`);
    } catch (err) {
      setError(readError(err));
    } finally {
      setResending(false);
    }
  };

  return (
    <main className="app-screen auth-screen">
      <TopBar back={back} />
      <div className="auth-logo">
        <Logo />
      </div>
      <h1>{mode === "signup" ? "Create your account" : "Welcome back"}</h1>
      <p className="auth-sub">
        {role === "worker"
          ? "Sign up to get job requests from customers near you."
          : "Sign up to book trusted workers near you."}
      </p>
      {role === "worker" && (
        <section className="quick-start">
          <PrimaryButton loading={quickLoading} onClick={startWorker}>
            {hasDeviceAccount() ? "Continue on this phone" : "Start now — no email needed"}
          </PrimaryButton>
          <div className="quick-start-ur">
            <span lang="ur" dir="rtl">
              بغیر ای میل کے شروع کریں
            </span>
            <button
              className="listen-button"
              onClick={() =>
                speak("کام تلاش کرنے کے لیے یہ سبز بٹن دبائیں۔ کوئی ای میل یا پاس ورڈ نہیں چاہیے۔", "ur")
              }
              aria-label="Listen"
            >
              <Icon name="speaker" size={18} />
            </button>
          </div>
          <small className="muted-line">Or use email below if you want to sign in on other phones.</small>
        </section>
      )}
      <form className="form-grid single" onSubmit={submit}>
        {mode === "signup" && (
          <label className="field">
            Full name
            <input value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" />
          </label>
        )}
        <label className="field">
          Email
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
          />
        </label>
        <label className="field">
          Password
          <input
            type="password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete={mode === "signup" ? "new-password" : "current-password"}
          />
        </label>
        {notice && <div className="notice-note">{notice}</div>}
        <ErrorNote message={error} />
        <PrimaryButton loading={loading}>{mode === "signup" ? "Sign Up" : "Sign In"}</PrimaryButton>
      </form>
      {canResend && mode === "signin" && (
        <button className="text-button" onClick={resend} disabled={resending}>
          {resending ? "Sending…" : "Resend confirmation email"}
        </button>
      )}
      <button
        className="text-button"
        onClick={() => {
          setMode(mode === "signup" ? "signin" : "signup");
          setError(null);
          setNotice(null);
          setCanResend(false);
        }}
      >
        {mode === "signup" ? "Already have an account? Sign in" : "New here? Create an account"}
      </button>
    </main>
  );
}
