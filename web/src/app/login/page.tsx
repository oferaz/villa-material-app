"use client";

import { useState } from "react";
import Link from "next/link";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  return (
    <main className="flex min-h-screen items-center justify-center bg-gray-50 p-6">
      <div className="w-full max-w-md rounded-xl border border-border bg-white p-6 shadow-sm">
        <h1 className="text-xl font-semibold">Materia Login</h1>
        <p className="mt-1 text-sm text-gray-600">Temporary shell page (Supabase auth will be connected next).</p>
        <div className="mt-5 space-y-3">
          <Input placeholder="Email" value={email} onChange={(event) => setEmail(event.target.value)} />
          <Input
            placeholder="Password"
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />
          <Button className="w-full" type="button">
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
