"use client";

import { useState } from "react";
import { useUser } from "@/components/providers/user-provider";
import { useToast } from "@/components/ui/toast";
import { cn } from "@/lib/utils";

export function AuthForm({ initialMode = "signin", onDone }: { initialMode?: "signin" | "signup"; onDone?: () => void }) {
  const { signIn, signUp, supabaseReady } = useUser();
  const toast = useToast();
  const [mode, setMode] = useState(initialMode);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirm, setConfirm] = useState(false);

  if (!supabaseReady) {
    return (
      <div className="rounded-[22px] bg-surface-2 p-5">
        <p className="font-bold">Accounts aren&apos;t connected in this build yet.</p>
        <p className="mt-1 text-sm text-ink-soft">
          Your saved places and preferences are kept on this device for now. Sign-up turns on once the site owner adds Supabase keys (see the README).
        </p>
      </div>
    );
  }
  if (confirm) {
    return (
      <div className="rounded-[22px] bg-surface-2 p-5">
        <p className="font-bold">Check your email</p>
        <p className="mt-1 text-sm text-ink-soft">We sent a confirmation link to {email}. Open it to finish creating your account.</p>
      </div>
    );
  }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    if (mode === "signin") {
      const err = await signIn(email, password);
      setBusy(false);
      if (err) return setError(err);
      toast("Signed in");
      onDone?.();
    } else {
      const { error: err, needsConfirm } = await signUp(email, password, name);
      setBusy(false);
      if (err) return setError(err);
      if (needsConfirm) setConfirm(true);
      else {
        toast("Account created");
        onDone?.();
      }
    }
  };

  const input = "w-full rounded-2xl border border-line bg-surface px-4 py-3 outline-none focus:border-primary";
  return (
    <form onSubmit={submit} className="flex flex-col gap-3">
      <div className="mb-1 flex rounded-full border border-line bg-surface p-1" role="tablist">
        {(["signin", "signup"] as const).map((m) => (
          <button key={m} type="button" role="tab" aria-selected={mode === m} onClick={() => { setMode(m); setError(null); }}
            className={cn("flex-1 rounded-full py-2 text-sm font-extrabold", mode === m && "bg-primary text-on-primary")}>
            {m === "signin" ? "Sign in" : "Create account"}
          </button>
        ))}
      </div>
      {mode === "signup" && (
        <div>
          <label htmlFor="auth-name" className="mb-1 block text-sm font-bold">Name</label>
          <input id="auth-name" value={name} onChange={(e) => setName(e.target.value)} required autoComplete="name" className={input} />
        </div>
      )}
      <div>
        <label htmlFor="auth-email" className="mb-1 block text-sm font-bold">Email</label>
        <input id="auth-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="email" className={input} />
      </div>
      <div>
        <label htmlFor="auth-pass" className="mb-1 block text-sm font-bold">Password</label>
        <input id="auth-pass" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={8} autoComplete={mode === "signin" ? "current-password" : "new-password"} className={input} />
        {mode === "signup" && <p className="mt-1 text-xs text-ink-soft">At least 8 characters.</p>}
      </div>
      {error && <p className="rounded-xl bg-sponsor-bg p-3 text-sm font-bold text-sponsor-ink" role="alert">{error}</p>}
      <button type="submit" disabled={busy} className="mt-1 rounded-full bg-primary py-3.5 font-extrabold text-on-primary disabled:opacity-60">
        {busy ? "One moment…" : mode === "signin" ? "Sign in" : "Create account"}
      </button>
    </form>
  );
}
