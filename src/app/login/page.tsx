"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Shield } from "lucide-react";
import { supabase } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/input";

export default function LoginPage() {
  const router = useRouter();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setMessage(null);
    setLoading(true);
    const sb = supabase();
    if (mode === "signin") {
      const { error } = await sb.auth.signInWithPassword({ email, password });
      if (error) setError(error.message);
      else {
        router.replace("/dashboard");
        return;
      }
    } else {
      const { data, error } = await sb.auth.signUp({
        email,
        password,
        options: { data: { full_name: fullName } },
      });
      if (error) setError(error.message);
      else if (data.session) {
        router.replace("/dashboard");
        return;
      } else {
        setMessage("Account creato. Controlla la tua email per confermare l'indirizzo, poi accedi.");
        setMode("signin");
      }
    }
    setLoading(false);
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-background p-4">
      <div className="w-full max-w-sm animate-fade-up">
        <div className="mb-8 text-center">
          <span className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-brand text-white shadow-lg shadow-brand/20">
            <Shield className="h-7 w-7" />
          </span>
          <h1 className="text-lg font-semibold tracking-tight">Real San Basilio — Club OS</h1>
          <p className="mt-1 text-[11px] font-medium uppercase tracking-widest text-muted">
            Powered by <span className="text-brand">AUVI</span>
          </p>
        </div>

        <form
          onSubmit={submit}
          className="space-y-4 rounded-2xl border border-line bg-surface p-6 shadow-sm"
        >
          {mode === "signup" && (
            <Field label="Nome e cognome" required>
              <Input
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Mario Rossi"
                required
              />
            </Field>
          )}
          <Field label="Email" required>
            <Input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="nome@auviagency.com"
              required
            />
          </Field>
          <Field label="Password" required>
            <Input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              minLength={6}
              required
            />
          </Field>

          {error && (
            <p className="rounded-lg bg-danger-soft px-3 py-2 text-xs text-danger">{error}</p>
          )}
          {message && (
            <p className="rounded-lg bg-ok-soft px-3 py-2 text-xs text-ok">{message}</p>
          )}

          <Button type="submit" variant="primary" size="lg" className="w-full" loading={loading}>
            {mode === "signin" ? "Accedi" : "Crea account"}
          </Button>

          <p className="text-center text-xs text-muted">
            {mode === "signin" ? "Non hai un account?" : "Hai già un account?"}{" "}
            <button
              type="button"
              onClick={() => setMode(mode === "signin" ? "signup" : "signin")}
              className="font-medium text-brand hover:underline cursor-pointer"
            >
              {mode === "signin" ? "Registrati" : "Accedi"}
            </button>
          </p>
        </form>
      </div>
    </main>
  );
}
