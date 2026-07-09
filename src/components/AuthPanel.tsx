import { Loader2, LogIn } from "lucide-react";
import { FormEvent, useState } from "react";
import { supabase } from "../lib/supabase";

interface AuthPanelProps {
  onSignedIn: () => Promise<void>;
}

export function AuthPanel({ onSignedIn }: AuthPanelProps) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [status, setStatus] = useState<"idle" | "loading">("idle");
  const [message, setMessage] = useState("");

  const submit = async (event: FormEvent) => {
    event.preventDefault();

    if (!supabase) {
      setMessage("Supabase ist lokal noch nicht konfiguriert.");
      return;
    }

    setStatus("loading");
    setMessage("");

    const credentials = { email: email.trim(), password };
    const result =
      mode === "signin"
        ? await supabase.auth.signInWithPassword(credentials)
        : await supabase.auth.signUp(credentials);

    setStatus("idle");

    if (result.error) {
      setMessage(result.error.message);
      return;
    }

    if (mode === "signup" && !result.data.session) {
      setMessage("Bitte bestaetige deine E-Mail. Danach kannst du dich anmelden.");
      return;
    }

    await onSignedIn();
  };

  return (
    <section className="auth-shell">
      <form className="auth-card" onSubmit={submit}>
        <div>
          <span className="eyebrow">Account</span>
          <h1>{mode === "signin" ? "Einloggen" : "Registrieren"}</h1>
          <p>Speichere deine Woerter sicher in Supabase.</p>
        </div>

        <label>
          <span>E-Mail</span>
          <input
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="deine@email.de"
            autoComplete="email"
            required
          />
        </label>

        <label>
          <span>Passwort</span>
          <input
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder="Mindestens 6 Zeichen"
            autoComplete={mode === "signin" ? "current-password" : "new-password"}
            minLength={6}
            required
          />
        </label>

        {message && <p className="auth-message">{message}</p>}

        <button className="auth-submit" type="submit" disabled={status === "loading"}>
          {status === "loading" ? <Loader2 className="spin" size={18} /> : <LogIn size={18} />}
          {mode === "signin" ? "Einloggen" : "Account erstellen"}
        </button>

        <button
          className="auth-switch"
          type="button"
          onClick={() => {
            setMode(mode === "signin" ? "signup" : "signin");
            setMessage("");
          }}
        >
          {mode === "signin" ? "Noch keinen Account? Registrieren" : "Schon registriert? Einloggen"}
        </button>
      </form>
    </section>
  );
}
