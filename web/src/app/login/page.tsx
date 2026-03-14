"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { isSupabaseConfigured, supabase } from "@/lib/supabase/client";
import { Separator } from "@/components/ui/separator";

function looksLikeEmail(value: string): boolean {
  const email = value.trim().toLowerCase();
  return /^[^@\s]+@[^@\s]+\.[^@\s]{2,}$/.test(email);
}

function normalizeOtpToken(value: string): string {
  return value.replace(/[^a-zA-Z0-9]/g, "").trim();
}

function buildLoginRedirectUrl(): string {
  const currentOrigin = window.location.origin;
  const configuredAppUrl = process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (!configuredAppUrl) {
    return `${currentOrigin.replace(/\/+$/, "")}/login`;
  }

  try {
    const configuredUrl = new URL(configuredAppUrl);
    const currentUrl = new URL(currentOrigin);
    const shouldUseConfiguredOrigin = configuredUrl.hostname === currentUrl.hostname;
    const baseUrl = shouldUseConfiguredOrigin ? configuredUrl.origin : currentOrigin;
    return `${baseUrl.replace(/\/+$/, "")}/login`;
  } catch {
    return `${currentOrigin.replace(/\/+$/, "")}/login`;
  }
}

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [otpCode, setOtpCode] = useState("");
  const [pendingEmail, setPendingEmail] = useState("");
  const [isGoogleSubmitting, setIsGoogleSubmitting] = useState(false);
  const [isSendingCode, setIsSendingCode] = useState(false);
  const [isVerifyingCode, setIsVerifyingCode] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

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

  async function handleGoogleSignIn() {
    if (!isSupabaseConfigured) {
      setErrorMessage("Supabase is not configured for this environment.");
      return;
    }

    setErrorMessage(null);
    setSuccessMessage(null);
    setIsGoogleSubmitting(true);

    const redirectTo = buildLoginRedirectUrl();
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo,
      },
    });

    setIsGoogleSubmitting(false);

    if (error) {
      setErrorMessage(error.message);
      return;
    }
  }

  async function handleSendCode() {
    if (!isSupabaseConfigured) {
      setErrorMessage("Supabase is not configured for this environment.");
      return;
    }

    const normalizedEmail = email.trim().toLowerCase();
    if (!looksLikeEmail(normalizedEmail)) {
      setErrorMessage("Enter a valid email address.");
      return;
    }

    setErrorMessage(null);
    setSuccessMessage(null);
    setIsSendingCode(true);

    const { error } = await supabase.auth.signInWithOtp({
      email: normalizedEmail,
      options: {
        shouldCreateUser: true,
      },
    });

    setIsSendingCode(false);

    if (error) {
      setErrorMessage(error.message);
      return;
    }

    setPendingEmail(normalizedEmail);
    setSuccessMessage("Code sent. Check your inbox and spam folder.");
  }

  async function handleVerifyCode() {
    if (!isSupabaseConfigured) {
      setErrorMessage("Supabase is not configured for this environment.");
      return;
    }

    const normalizedEmail = (pendingEmail || email).trim().toLowerCase();
    const token = normalizeOtpToken(otpCode);

    if (!looksLikeEmail(normalizedEmail)) {
      setErrorMessage("Enter your email and request a code first.");
      return;
    }

    if (!token) {
      setErrorMessage("Enter a valid verification code.");
      return;
    }

    setErrorMessage(null);
    setSuccessMessage(null);
    setIsVerifyingCode(true);

    const { error } = await supabase.auth.verifyOtp({
      email: normalizedEmail,
      token,
      type: "email",
    });

    setIsVerifyingCode(false);

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
        <p className="mt-1 text-sm text-gray-600">Sign in with Google or with a one-time code sent to your email.</p>

        <div className="mt-5 space-y-4">
          <Button
            className="w-full"
            type="button"
            onClick={handleGoogleSignIn}
            disabled={isGoogleSubmitting || !isSupabaseConfigured}
          >
            Continue with Google
          </Button>

          <div className="flex items-center gap-3">
            <Separator className="flex-1" />
            <span className="text-xs font-medium uppercase tracking-wide text-slate-500">or</span>
            <Separator className="flex-1" />
          </div>

          <Input
            placeholder="Email address"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            autoComplete="email"
          />
          <Button className="w-full" type="button" onClick={handleSendCode} disabled={isSendingCode}>
            Send code
          </Button>

          {pendingEmail ? <p className="text-xs text-slate-600">Latest code sent to: {pendingEmail}</p> : null}

          <Input
            placeholder="Verification code"
            value={otpCode}
            onChange={(event) => setOtpCode(event.target.value)}
            autoComplete="one-time-code"
          />
          <Button className="w-full" type="button" onClick={handleVerifyCode} disabled={isVerifyingCode}>
            Verify and continue
          </Button>

          {errorMessage ? <p className="text-sm text-red-600">{errorMessage}</p> : null}
          {successMessage ? <p className="text-sm text-green-600">{successMessage}</p> : null}
        </div>
      </div>
    </main>
  );
}

