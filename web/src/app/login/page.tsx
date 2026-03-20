"use client";

import Image from "next/image";
import { Suspense, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { KeyRound, Mail, ShieldCheck } from "lucide-react";
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

function sanitizeNextDestination(value: string | null | undefined): string {
  const trimmedValue = value?.trim() ?? "";
  if (!trimmedValue.startsWith("/") || trimmedValue.startsWith("//")) {
    return "/dashboard";
  }

  try {
    const parsedUrl = new URL(trimmedValue, "http://localhost");
    return `${parsedUrl.pathname}${parsedUrl.search}${parsedUrl.hash}` || "/dashboard";
  } catch {
    return "/dashboard";
  }
}

function buildLoginRedirectUrl(search: string): string {
  const currentOrigin = window.location.origin;
  const configuredAppUrl = process.env.NEXT_PUBLIC_APP_URL?.trim();
  const normalizedSearch = search.trim();
  if (!configuredAppUrl) {
    return `${currentOrigin.replace(/\/+$/, "")}/login${normalizedSearch}`;
  }

  try {
    const configuredUrl = new URL(configuredAppUrl);
    const currentUrl = new URL(currentOrigin);
    const shouldUseConfiguredOrigin = configuredUrl.hostname === currentUrl.hostname;
    const baseUrl = shouldUseConfiguredOrigin ? configuredUrl.origin : currentOrigin;
    return `${baseUrl.replace(/\/+$/, "")}/login${normalizedSearch}`;
  } catch {
    return `${currentOrigin.replace(/\/+$/, "")}/login${normalizedSearch}`;
  }
}

function LoginPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("");
  const [otpCode, setOtpCode] = useState("");
  const [pendingEmail, setPendingEmail] = useState("");
  const [isGoogleSubmitting, setIsGoogleSubmitting] = useState(false);
  const [isSendingCode, setIsSendingCode] = useState(false);
  const [isVerifyingCode, setIsVerifyingCode] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const loginSearch = searchParams.toString();
  const loginSearchSuffix = loginSearch ? `?${loginSearch}` : "";
  const nextDestination = useMemo(() => sanitizeNextDestination(searchParams.get("next")), [searchParams]);
  const prefilledInviteEmail = useMemo(() => {
    const normalizedEmail = (searchParams.get("email") ?? "").trim().toLowerCase();
    return looksLikeEmail(normalizedEmail) ? normalizedEmail : "";
  }, [searchParams]);

  useEffect(() => {
    if (!prefilledInviteEmail) {
      return;
    }
    setEmail((currentValue) => currentValue || prefilledInviteEmail);
  }, [prefilledInviteEmail]);

  useEffect(() => {
    let isCancelled = false;

    async function checkSession() {
      const { data } = await supabase.auth.getSession();
      if (!isCancelled && data.session) {
        router.replace(nextDestination);
      }
    }

    void checkSession();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session) {
        router.replace(nextDestination);
      }
    });

    return () => {
      isCancelled = true;
      subscription.unsubscribe();
    };
  }, [nextDestination, router]);

  async function handleGoogleSignIn() {
    if (!isSupabaseConfigured) {
      setErrorMessage("Supabase is not configured for this environment.");
      return;
    }

    setErrorMessage(null);
    setSuccessMessage(null);
    setIsGoogleSubmitting(true);

    const redirectTo = buildLoginRedirectUrl(loginSearchSuffix);
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

    router.replace(nextDestination);
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-[radial-gradient(circle_at_top_right,#dbeafe_0%,#f8fafc_35%,#f8fafc_100%)] p-4 md:p-8">
      <div className="grid w-full max-w-5xl overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl md:grid-cols-[1.1fr_1fr]">
        <section className="hidden border-r border-slate-200 bg-slate-900 p-8 text-slate-100 md:flex md:flex-col">
          <div className="flex items-center gap-3">
            <Image src="/materia-logo.png" alt="Materia" width={28} height={28} className="rounded-sm" />
            <span className="text-lg font-semibold tracking-wide">Materia</span>
          </div>
          <h2 className="mt-10 text-3xl font-semibold leading-tight">
            Design and procurement workspace for modern villa projects.
          </h2>
          <p className="mt-3 max-w-sm text-sm text-slate-300">
            Secure access to projects, houses, rooms, object options, and budget tracking.
          </p>

          <div className="mt-8 space-y-4 text-sm">
            <div className="flex items-center gap-3">
              <ShieldCheck className="h-4 w-4 text-blue-300" />
              <span>Supabase-backed authentication</span>
            </div>
            <div className="flex items-center gap-3">
              <Mail className="h-4 w-4 text-blue-300" />
              <span>Email one-time passcode login</span>
            </div>
            <div className="flex items-center gap-3">
              <KeyRound className="h-4 w-4 text-blue-300" />
              <span>Google OAuth sign-in</span>
            </div>
          </div>
        </section>

        <section className="p-6 md:p-8">
          <div className="mx-auto w-full max-w-md">
            <div className="flex items-center gap-3">
              <Image src="/materia-logo.png" alt="Materia logo" width={24} height={24} className="rounded-sm" />
              <p className="text-sm font-semibold uppercase tracking-wide text-slate-600">Materia</p>
            </div>
            <h1 className="mt-5 text-2xl font-semibold text-slate-900">Sign in</h1>
            <p className="mt-1 text-sm text-slate-600">
              Use Google or request a one-time verification code by email.
            </p>
            {prefilledInviteEmail ? (
              <p className="mt-3 rounded-md border border-blue-200 bg-blue-50 px-3 py-2 text-sm text-blue-800">
                This link is reserved for <strong>{prefilledInviteEmail}</strong>. Sign in with that email to open the
                shared project.
              </p>
            ) : null}

            <div className="mt-6 space-y-4">
              <Button
                className="h-10 w-full"
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

              <label className="block space-y-1">
                <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Email</span>
                <Input
                  placeholder="you@company.com"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  autoComplete="email"
                />
              </label>
              <Button className="h-10 w-full" type="button" onClick={handleSendCode} disabled={isSendingCode}>
                Send code
              </Button>

              {pendingEmail ? (
                <p className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600">
                  Latest code sent to: {pendingEmail}
                </p>
              ) : null}

              <label className="block space-y-1">
                <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Verification code</span>
                <Input
                  placeholder="Enter code"
                  value={otpCode}
                  onChange={(event) => setOtpCode(event.target.value)}
                  autoComplete="one-time-code"
                />
              </label>
              <Button className="h-10 w-full" type="button" onClick={handleVerifyCode} disabled={isVerifyingCode}>
                Verify and continue
              </Button>

              {errorMessage ? (
                <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                  {errorMessage}
                </p>
              ) : null}
              {successMessage ? (
                <p className="rounded-md border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-700">
                  {successMessage}
                </p>
              ) : null}
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<main className="p-6">Loading sign-in...</main>}>
      <LoginPageContent />
    </Suspense>
  );
}

