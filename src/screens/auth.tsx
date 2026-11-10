import { useState, type FormEvent } from "react";
import { ErrorNote, Logo, PrimaryButton, TopBar, type Role } from "../ui";
import { signIn, signUp } from "../lib/api";
import { readError } from "./common";

/** After a successful sign-in the router notices the new session and moves on. */
export function AuthScreen({ role, back }: { role: Role | null; back: () => void }) {
  const [mode, setMode] = useState<"signup" | "signin">("signup");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setNotice(null);
    if (mode === "signup" && !name.trim()) return setError("Please enter your name");
    if (password.length < 6) return setError("Password must be at least 6 characters");
    setLoading(true);
    try {
      if (mode === "signup") {
        const { needsConfirmation } = await signUp(email.trim(), password, name.trim());
        if (needsConfirmation) {
          setNotice("Almost done! Open the email we sent you and tap the link to confirm, then sign in here.");
          setMode("signin");
          return;
        }
      } else {
        await signIn(email.trim(), password);
      }
    } catch (err) {
      setError(readError(err));
    } finally {
      setLoading(false);
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
      <button
        className="text-button"
        onClick={() => {
          setMode(mode === "signup" ? "signin" : "signup");
          setError(null);
        }}
      >
        {mode === "signup" ? "Already have an account? Sign in" : "New here? Create an account"}
      </button>
    </main>
  );
}
