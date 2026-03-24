"use client";

import { useEffect, useMemo, useState } from "react";
import { formatCurrencyAmount } from "@/lib/currency";
import { isSupabaseConfigured, supabase } from "@/lib/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import type {
  ClientViewBudgetOverview,
  ClientViewHouseOverview,
  ClientViewItem,
  ClientViewProgressOverview,
  ClientViewProjectOverview,
  ClientViewScopeDecision,
  ClientViewStatus,
  ClientViewSubmissionContext,
} from "@/types";

interface PublicClientViewData {
  id: string;
  title: string;
  status: ClientViewStatus;
  publishedVersion: number;
  publishedAt?: string | null;
  expiresAt?: string | null;
  showProjectOverview: boolean;
  showHouseOverviews: boolean;
  projectOverview?: ClientViewProjectOverview | null;
  houseOverviews: ClientViewHouseOverview[];
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

interface OverviewSnapshotCardProps {
  title: string;
  subtitle: string;
  progress: ClientViewProgressOverview;
  budget: ClientViewBudgetOverview;
  currency: string;
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

function resolveClientViewCurrency(clientView: PublicClientViewData | null): string {
  if (!clientView) {
    return "USD";
  }

  const projectCurrency = clientView.projectOverview?.budget.currency?.trim();
  if (projectCurrency) {
    return projectCurrency;
  }

  const houseCurrency = clientView.houseOverviews.find((overview) => overview.budget.currency?.trim())?.budget.currency?.trim();
  if (houseCurrency) {
    return houseCurrency;
  }

  return "USD";
}

function validateDraftBeforeSubmit(item: ClientViewItem, draft: ItemDraft): string | null {
  if (item.cardMode === "material_choice" && !draft.selectedOptionId) {
    return `Please choose one of the material options for ${item.objectName} before saving your response.`;
  }

  if (item.cardMode === "budget_input" && !draft.preferredBudget.trim()) {
    return `Please enter a preferred budget for ${item.objectName} before saving your response.`;
  }

  if (item.cardMode === "scope_confirmation" && !draft.scopeDecision) {
    return `Please choose a scope decision for ${item.objectName} before saving your response.`;
  }

  return null;
}

function formatOverviewCurrencyValue(
  value: number | null | undefined,
  currency: string,
): { code: string; amount: string; amountGroups: string[]; label: string } | null {
  if (value === null || value === undefined) {
    return null;
  }

  const normalizedCurrency = currency.trim().toUpperCase() || "USD";
  const formatter = new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: normalizedCurrency,
    maximumFractionDigits: 0,
  });
  const parts = formatter.formatToParts(Math.round(value));
  const amount = parts
    .filter((part) => part.type !== "currency" && part.type !== "literal")
    .map((part) => part.value)
    .join("")
    .trim();
  const displayAmount = amount || formatter.format(Math.round(value));

  return {
    code: normalizedCurrency,
    amount: displayAmount,
    amountGroups: displayAmount.split(",").filter(Boolean),
    label: formatter.format(Math.round(value)),
  };
}

function OverviewSnapshotCard({ title, subtitle, progress, budget, currency }: OverviewSnapshotCardProps) {
  const totalBudgetDisplay = formatOverviewCurrencyValue(budget.totalBudget, currency);
  const remainingBudgetDisplay = formatOverviewCurrencyValue(budget.remainingAmount, currency);

  return (
    <Card className="border-slate-200 bg-white/95 shadow-sm backdrop-blur">
      <CardHeader>
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="outline">{progress.completionPercent}% complete</Badge>
          <Badge variant="outline">{progress.totalItems} tracked items</Badge>
        </div>
        <CardTitle className="text-xl">{title}</CardTitle>
        <CardDescription>{subtitle}</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
        <div className="min-w-0 grid gap-3 sm:grid-cols-2">
          <div className="min-w-0 rounded-xl border border-slate-200 bg-slate-50 p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Progress</p>
            <p className="mt-2 text-3xl font-semibold text-slate-900">{progress.completionPercent}%</p>
            <p className="mt-1 text-sm text-slate-600">{progress.actionsCompleted} of {progress.actionsTotal} workflow steps completed</p>
          </div>
          <div className="min-w-0 rounded-xl border border-slate-200 bg-slate-50 p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Budget</p>
            {totalBudgetDisplay ? (
              <div className="mt-2 min-w-0">
                <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-500">{totalBudgetDisplay.code}</p>
                <p
                  aria-label={totalBudgetDisplay.label}
                  className="mt-1 flex min-w-0 flex-wrap items-baseline gap-x-1.5 gap-y-1 text-[clamp(1.15rem,1.9vw,1.55rem)] font-semibold leading-tight tabular-nums tracking-[-0.02em] text-slate-900"
                >
                  {totalBudgetDisplay.amountGroups.map((group, index) => (
                    <span key={`${group}-${index}`}>{index === 0 ? group : `,${group}`}</span>
                  ))}
                </p>
              </div>
            ) : (
              <p className="mt-2 min-w-0 break-words text-[clamp(1.15rem,1.9vw,1.55rem)] font-semibold leading-tight text-slate-900">Not set</p>
            )}
            <p className="mt-1 break-words text-sm text-slate-600">Allocated {formatCurrencyAmount(budget.allocatedAmount, currency)}</p>
          </div>
          <div className="min-w-0 rounded-xl border border-slate-200 bg-white p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Remaining steps</p>
            <p className="mt-2 min-w-0 break-words text-[clamp(1.6rem,2.8vw,2rem)] font-semibold leading-tight text-slate-900">{progress.actionsRemaining}</p>
            <p className="mt-1 text-sm text-slate-600">Still to complete across material, PO, order, and install</p>
          </div>
          <div className="min-w-0 rounded-xl border border-slate-200 bg-white p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Remaining budget</p>
            {remainingBudgetDisplay ? (
              <div className="mt-2 min-w-0">
                <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-500">{remainingBudgetDisplay.code}</p>
                <p
                  aria-label={remainingBudgetDisplay.label}
                  className="mt-1 flex min-w-0 flex-wrap items-baseline gap-x-1.5 gap-y-1 text-[clamp(1.15rem,1.9vw,1.55rem)] font-semibold leading-tight tabular-nums tracking-[-0.02em] text-slate-900"
                >
                  {remainingBudgetDisplay.amountGroups.map((group, index) => (
                    <span key={`${group}-${index}`}>{index === 0 ? group : `,${group}`}</span>
                  ))}
                </p>
              </div>
            ) : (
              <p className="mt-2 min-w-0 break-words text-[clamp(1.15rem,1.9vw,1.55rem)] font-semibold leading-tight text-slate-900">Not set</p>
            )}
            <p className="mt-1 break-words text-sm text-slate-600">Compared with the current published selections</p>
          </div>
        </div>

        <div className="min-w-0 space-y-3 rounded-xl border border-slate-200 bg-slate-50 p-4">
          <div>
            <p className="text-sm font-medium text-slate-900">Workflow stage snapshot</p>
            <p className="text-xs text-slate-500">This is a frozen summary captured when the designer published this client view.</p>
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            <div className="rounded-lg border border-slate-200 bg-white p-3 text-sm text-slate-700">
              <p className="font-medium text-slate-900">Awaiting material</p>
              <p className="mt-1">{progress.stages.materialMissing}</p>
            </div>
            <div className="rounded-lg border border-slate-200 bg-white p-3 text-sm text-slate-700">
              <p className="font-medium text-slate-900">Material assigned</p>
              <p className="mt-1">{progress.stages.materialAssigned}</p>
            </div>
            <div className="rounded-lg border border-slate-200 bg-white p-3 text-sm text-slate-700">
              <p className="font-medium text-slate-900">PO approved</p>
              <p className="mt-1">{progress.stages.poApproved}</p>
            </div>
            <div className="rounded-lg border border-slate-200 bg-white p-3 text-sm text-slate-700">
              <p className="font-medium text-slate-900">Ordered</p>
              <p className="mt-1">{progress.stages.ordered}</p>
            </div>
            <div className="rounded-lg border border-slate-200 bg-white p-3 text-sm text-slate-700 sm:col-span-2">
              <p className="font-medium text-slate-900">Installed</p>
              <p className="mt-1">{progress.stages.installed}</p>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
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
      setClientView({
        ...payload.clientView,
        showProjectOverview: Boolean(payload.clientView.showProjectOverview),
        showHouseOverviews: Boolean(payload.clientView.showHouseOverviews),
        projectOverview: payload.clientView.projectOverview ?? null,
        houseOverviews: payload.clientView.houseOverviews ?? [],
      });
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
  const overviewCurrency = useMemo(() => resolveClientViewCurrency(clientView), [clientView]);

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
    const validationMessage = validateDraftBeforeSubmit(item, draft);
    if (validationMessage) {
      setErrorMessage(validationMessage);
      return;
    }

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

        {clientView.showProjectOverview || clientView.showHouseOverviews ? (
          <section className="space-y-4">
            <div className="space-y-1 px-1">
              <h2 className="text-lg font-semibold text-slate-900">Project status and budget</h2>
              <p className="text-sm text-slate-600">The designer chose to share this frozen snapshot alongside the review items.</p>
            </div>
            {clientView.showProjectOverview && clientView.projectOverview ? (
              <OverviewSnapshotCard
                title={clientView.projectOverview.projectName}
                subtitle={`${clientView.projectOverview.housesCount} houses, ${clientView.projectOverview.roomsCount} rooms, ${clientView.projectOverview.itemsCount} tracked items`}
                progress={clientView.projectOverview.progress}
                budget={clientView.projectOverview.budget}
                currency={clientView.projectOverview.budget.currency?.trim() || overviewCurrency}
              />
            ) : null}
            {clientView.showHouseOverviews && clientView.houseOverviews.length > 0 ? (
              <div className="grid gap-4 xl:grid-cols-2">
                {clientView.houseOverviews.map((houseOverview) => (
                  <OverviewSnapshotCard
                    key={houseOverview.houseId ?? houseOverview.houseName}
                    title={houseOverview.houseName}
                    subtitle={`${houseOverview.roomsCount} rooms, ${houseOverview.itemsCount} tracked items`}
                    progress={houseOverview.progress}
                    budget={houseOverview.budget}
                    currency={houseOverview.budget.currency?.trim() || overviewCurrency}
                  />
                ))}
              </div>
            ) : null}
          </section>
        ) : null}

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
          {clientView.items.length === 0 ? (
            <Card className="border-slate-200 shadow-sm">
              <CardContent className="pt-5 text-sm text-slate-600">
                This client view does not include object review cards. The shared page is currently being used just for project and budget visibility.
              </CardContent>
            </Card>
          ) : clientView.items.map((item) => {
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
                  {item.currentSelectedMaterialName || item.budgetAllowance != null ? (
                    <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm text-slate-600">
                      {item.currentSelectedMaterialName ? (
                        <p>
                          Current selection: <span className="font-medium text-slate-900">{item.currentSelectedMaterialName}</span>
                          {item.currentSelectedPrice != null ? ` (${formatCurrencyAmount(item.currentSelectedPrice, overviewCurrency)})` : ""}
                        </p>
                      ) : null}
                      {item.budgetAllowance != null ? (
                        <p>
                          Object budget target: <span className="font-medium text-slate-900">{formatCurrencyAmount(item.budgetAllowance, overviewCurrency)}</span>
                        </p>
                      ) : null}
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
                            {option.price != null ? <p className="mt-2 text-sm text-slate-700">{formatCurrencyAmount(option.price, overviewCurrency)}</p> : null}
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
