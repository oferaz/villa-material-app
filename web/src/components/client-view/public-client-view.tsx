"use client";

import { useEffect, useMemo, useState } from "react";
import { formatCurrencyAmount } from "@/lib/currency";
import { isSupabaseConfigured, supabase } from "@/lib/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import type { ClientViewItem, ClientViewScopeDecision, ClientViewStatus, ClientViewSubmissionContext } from "@/types";

interface PublicClientViewData {
  id: string;
  title: string;
  status: ClientViewStatus;
  publishedVersion: number;
  publishedAt?: string | null;
  expiresAt?: string | null;
  items: ClientViewItem[];
}

interface PublicClientViewProps {
  token: string;
}

interface ItemDraft {
  selectedOptionId?: string | null;
  preferredBudget: string;
  scopeDecision?: ClientViewScopeDecision | null;
  comment: string;
}

function buildLoginUrl(token: string) {
  const next = `/client/${token}`;
  return `/login?next=${encodeURIComponent(next)}`;
}

function buildDraftFromItem(item: ClientViewItem, context?: ClientViewSubmissionContext): ItemDraft {
  const existing = context?.responses.find((response) => response.itemId === item.id);
  return {
    selectedOptionId: existing?.selectedOptionId ?? null,
    preferredBudget: existing?.preferredBudget == null ? "" : String(Math.round(existing.preferredBudget)),
    scopeDecision: existing?.scopeDecision ?? null,
    comment: existing?.comment ?? "",
  };
}

function statusVariant(status: ClientViewStatus): "default" | "outline" | "danger" | "success" {
  if (status === "published") {
    return "success";
  }
  if (status === "revoked" || status === "expired") {
    return "danger";
  }
  return "outline";
}

export function PublicClientView({ token }: PublicClientViewProps) {
  const [clientView, setClientView] = useState<PublicClientViewData | null>(null);
  const [context, setContext] = useState<ClientViewSubmissionContext | null>(null);
  const [drafts, setDrafts] = useState<Record<string, ItemDraft>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [isContextLoading, setIsContextLoading] = useState(false);
  const [isSignedIn, setIsSignedIn] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [savingItemId, setSavingItemId] = useState<string>("");

  async function loadClientView() {
    setIsLoading(true);
    setErrorMessage(null);
    try {
      const response = await fetch(`/api/client-view/${token}`, { cache: "no-store" });
      const payload = (await response.json()) as { ok: boolean; error?: string; clientView?: PublicClientViewData };
      if (!response.ok || !payload.ok || !payload.clientView) {
        throw new Error(payload.error || "Client view could not be loaded.");
      }
      setClientView(payload.clientView);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Client view could not be loaded.");
      setClientView(null);
    } finally {
      setIsLoading(false);
    }
  }

  async function loadSubmissionContext() {
    if (!isSupabaseConfigured) {
      setIsSignedIn(false);
      setContext(null);
      return;
    }

    const {
      data: { session },
    } = await supabase.auth.getSession();
    setIsSignedIn(Boolean(session));

    if (!session?.access_token) {
      setContext(null);
      return;
    }

    setIsContextLoading(true);
    try {
      const response = await fetch(`/api/client-view/${token}/context`, {
        cache: "no-store",
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });
      const payload = (await response.json()) as { ok: boolean; error?: string; context?: ClientViewSubmissionContext };
      if (!response.ok || !payload.ok || !payload.context) {
        throw new Error(payload.error || "Could not load approval context.");
      }
      setContext(payload.context);
    } catch {
      setContext(null);
    } finally {
      setIsContextLoading(false);
    }
  }

  useEffect(() => {
    void loadClientView();
    void loadSubmissionContext();

    if (!isSupabaseConfigured) {
      return;
    }

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(() => {
      void loadSubmissionContext();
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [token]);

  useEffect(() => {
    if (!clientView) {
      return;
    }

    setDrafts((current) => {
      const next: Record<string, ItemDraft> = {};
      clientView.items.forEach((item) => {
        next[item.id] = current[item.id] ?? buildDraftFromItem(item, context ?? undefined);
      });
      return next;
    });
  }, [clientView, context]);

  const canSubmit = Boolean(context?.canSubmit);
  const itemResponsesById = useMemo(() => {
    return new Map((context?.responses ?? []).map((response) => [response.itemId, response]));
  }, [context]);

  async function handleSubmit(item: ClientViewItem) {
    if (!isSupabaseConfigured) {
      return;
    }

    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session?.access_token) {
      window.location.href = buildLoginUrl(token);
      return;
    }

    const draft = drafts[item.id] ?? buildDraftFromItem(item, context ?? undefined);
    setSavingItemId(item.id);
    setErrorMessage(null);
    try {
      const response = await fetch(`/api/client-view/${token}/responses`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          itemId: item.id,
          selectedOptionId: item.cardMode === "material_choice" ? draft.selectedOptionId ?? null : null,
          preferredBudget: item.cardMode === "budget_input" && draft.preferredBudget.trim() ? Number(draft.preferredBudget) : null,
          scopeDecision: item.cardMode === "scope_confirmation" ? draft.scopeDecision ?? null : null,
          comment: draft.comment.trim() || null,
        }),
      });
      const payload = (await response.json()) as { ok: boolean; error?: string };
      if (!response.ok || !payload.ok) {
        throw new Error(payload.error || "Failed to submit response.");
      }
      await loadSubmissionContext();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Failed to submit response.");
    } finally {
      setSavingItemId("");
    }
  }

  function updateDraft(itemId: string, patch: Partial<ItemDraft>) {
    setDrafts((current) => ({
      ...current,
      [itemId]: {
        ...(current[itemId] ?? { preferredBudget: "", comment: "" }),
        ...patch,
      },
    }));
  }

  if (isLoading) {
    return <main className="p-6">Loading client view...</main>;
  }

  if (!clientView) {
    return (
      <main className="mx-auto max-w-3xl p-6">
        <Card className="border-red-200">
          <CardHeader>
            <CardTitle>Client view unavailable</CardTitle>
            <CardDescription>{errorMessage || "This shared page is not available."}</CardDescription>
          </CardHeader>
        </Card>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,#eff6ff_0%,#f8fafc_45%,#f8fafc_100%)] px-4 py-8 md:px-8">
      <div className="mx-auto max-w-5xl space-y-6">
        <Card className="border-slate-200 bg-white/95 shadow-sm backdrop-blur">
          <CardHeader>
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant={statusVariant(clientView.status)}>{clientView.status}</Badge>
              <Badge variant="outline">{clientView.items.length} review items</Badge>
              {clientView.publishedAt ? <Badge variant="outline">Published {new Date(clientView.publishedAt).toLocaleDateString()}</Badge> : null}
            </div>
            <CardTitle className="text-2xl">{clientView.title}</CardTitle>
            <CardDescription>
              Review the published design choices below. Viewing is open from the shared link, while decisions are saved only for invited, signed-in recipients.
            </CardDescription>
          </CardHeader>
        </Card>

        <Card className="border-slate-200">
          <CardContent className="flex flex-wrap items-center justify-between gap-3 pt-5">
            <div className="space-y-1 text-sm text-slate-600">
              <p>{isSignedIn ? `Signed in as ${context?.userEmail ?? "an invited account"}` : "You are viewing as a guest."}</p>
              <p>
                {canSubmit
                  ? "Your responses will be saved against this published version."
                  : "Sign in with an invited email to submit approvals or preferences."}
              </p>
            </div>
            {!canSubmit ? (
              <Button type="button" onClick={() => (window.location.href = buildLoginUrl(token))}>
                {isSignedIn ? "Switch account" : "Sign in to respond"}
              </Button>
            ) : null}
          </CardContent>
        </Card>

        {errorMessage ? (
          <Card className="border-red-200 bg-red-50">
            <CardContent className="pt-5 text-sm text-red-700">{errorMessage}</CardContent>
          </Card>
        ) : null}

        <section className="grid gap-4">
          {clientView.items.map((item) => {
            const draft = drafts[item.id] ?? buildDraftFromItem(item, context ?? undefined);
            const response = itemResponsesById.get(item.id);
            return (
              <Card key={item.id} className="border-slate-200 shadow-sm">
                <CardHeader>
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="outline">{item.cardMode.replace("_", " ")}</Badge>
                    <Badge variant="outline">{item.roomName}</Badge>
                    <Badge variant="outline">{item.houseName}</Badge>
                    {response ? <Badge variant={response.appliedAt ? "success" : "secondary"}>{response.appliedAt ? "Applied" : "Saved"}</Badge> : null}
                  </div>
                  <CardTitle>{item.objectName}</CardTitle>
                  <CardDescription>
                    {item.promptText || `Category: ${item.objectCategory}. Quantity: ${item.quantity}.`}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {(item.currentSelectedMaterialName || item.budgetAllowance != null) ? (
                    <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm text-slate-600">
                      {item.currentSelectedMaterialName ? (
                        <p>Current selection: <span className="font-medium text-slate-900">{item.currentSelectedMaterialName}</span>{item.currentSelectedPrice != null ? ` (${formatCurrencyAmount(item.currentSelectedPrice, "USD")})` : ""}</p>
                      ) : null}
                      {item.budgetAllowance != null ? <p>Object budget target: <span className="font-medium text-slate-900">{formatCurrencyAmount(item.budgetAllowance, "USD")}</span></p> : null}
                    </div>
                  ) : null}

                  {item.cardMode === "material_choice" ? (
                    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                      {item.options.map((option) => {
                        const isSelected = draft.selectedOptionId === option.id;
                        return (
                          <button
                            key={option.id}
                            type="button"
                            className={`rounded-xl border p-3 text-left transition ${
                              isSelected ? "border-blue-300 bg-blue-50" : "border-slate-200 bg-white hover:bg-slate-50"
                            }`}
                            onClick={() => updateDraft(item.id, { selectedOptionId: option.id })}
                            disabled={!canSubmit}
                          >
                            {option.imageUrl ? <img src={option.imageUrl} alt={option.name} className="mb-3 h-40 w-full rounded-lg object-cover" /> : null}
                            <p className="font-medium text-slate-900">{option.name}</p>
                            {option.supplierName ? <p className="text-sm text-slate-500">{option.supplierName}</p> : null}
                            {option.price != null ? <p className="mt-2 text-sm text-slate-700">{formatCurrencyAmount(option.price, "USD")}</p> : null}
                            {option.description ? <p className="mt-2 line-clamp-3 text-sm text-slate-600">{option.description}</p> : null}
                            {option.sourceUrl ? <p className="mt-2 text-xs text-blue-700">Source link included</p> : null}
                          </button>
                        );
                      })}
                    </div>
                  ) : null}

                  {item.cardMode === "budget_input" ? (
                    <div className="max-w-sm space-y-2">
                      <label className="block text-sm font-medium text-slate-700">Preferred budget</label>
                      <Input
                        inputMode="numeric"
                        value={draft.preferredBudget}
                        onChange={(event) => updateDraft(item.id, { preferredBudget: event.target.value })}
                        disabled={!canSubmit}
                        placeholder="Enter preferred budget"
                      />
                    </div>
                  ) : null}

                  {item.cardMode === "scope_confirmation" ? (
                    <div className="space-y-2">
                      <label className="block text-sm font-medium text-slate-700">Scope decision</label>
                      <div className="flex flex-wrap gap-2">
                        {([
                          ["approved", "Approve"],
                          ["not_needed", "Not needed"],
                          ["needs_revision", "Needs revision"],
                        ] as Array<[ClientViewScopeDecision, string]>).map(([value, label]) => (
                          <Button
                            key={value}
                            type="button"
                            variant={draft.scopeDecision === value ? "default" : "outline"}
                            onClick={() => updateDraft(item.id, { scopeDecision: value })}
                            disabled={!canSubmit}
                          >
                            {label}
                          </Button>
                        ))}
                      </div>
                    </div>
                  ) : null}

                  <div className="space-y-2">
                    <label className="block text-sm font-medium text-slate-700">Comment</label>
                    <textarea
                      className="min-h-24 w-full rounded-md border border-slate-200 px-3 py-2 text-sm outline-none ring-offset-white focus:ring-2 focus:ring-slate-300"
                      value={draft.comment}
                      onChange={(event) => updateDraft(item.id, { comment: event.target.value })}
                      disabled={!canSubmit}
                      placeholder="Optional note for the designer"
                    />
                  </div>

                  <div className="flex items-center justify-between gap-3">
                    <p className="text-xs text-slate-500">
                      {response ? `Last saved ${new Date(response.updatedAt).toLocaleString()}` : isContextLoading ? "Checking response access..." : "No saved response yet."}
                    </p>
                    <Button type="button" onClick={() => void handleSubmit(item)} disabled={!canSubmit || savingItemId === item.id}>
                      {savingItemId === item.id ? "Saving..." : response ? "Update response" : "Save response"}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </section>
      </div>
    </main>
  );
}

