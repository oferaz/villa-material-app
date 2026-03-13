"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { isSupabaseConfigured, supabase } from "@/lib/supabase/client";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    let isCancelled = false;

    async function checkSession() {
      const { data } = await supabase.auth.getSession();
      if (!isCancelled && data.session) {
        router.replace("/dashboard");
      }
    }

    void checkSession();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session) {
        router.replace("/dashboard");
      }
    });

    return () => {
      isCancelled = true;
      subscription.unsubscribe();
    };
  }, [router]);

  async function handleSignIn() {
    if (!isSupabaseConfigured) {
      setErrorMessage("Supabase is not configured for this environment.");
      return;
    }

    const normalizedEmail = email.trim().toLowerCase();
    if (!normalizedEmail || !password) {
      setErrorMessage("Enter both email and password.");
      return;
    }

    setErrorMessage(null);
    setIsSubmitting(true);

    const { error } = await supabase.auth.signInWithPassword({
      email: normalizedEmail,
      password,
    });

    setIsSubmitting(false);

    if (error) {
      setErrorMessage(error.message);
      return;
    }

    router.replace("/dashboard");
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-gray-50 p-6">
      <div className="w-full max-w-md rounded-xl border border-border bg-white p-6 shadow-sm">
        <h1 className="text-xl font-semibold">Materia Login</h1>
        <p className="mt-1 text-sm text-gray-600">Sign in with your Supabase user to access real project data.</p>
        <div className="mt-5 space-y-3">
          <Input
            placeholder="Email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            autoComplete="email"
          />
          <Input
            placeholder="Password"
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            autoComplete="current-password"
          />
          {errorMessage ? <p className="text-sm text-red-600">{errorMessage}</p> : null}
          <Button className="w-full" type="button" onClick={handleSignIn} disabled={isSubmitting}>
            Sign in
          </Button>
        </div>
        <Link href="/dashboard" className="mt-4 inline-block text-sm text-blue-600 underline">
          Continue with mock mode
        </Link>
      </div>
    </main>
  );
}

