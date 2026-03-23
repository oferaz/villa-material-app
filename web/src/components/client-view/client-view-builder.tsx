"use client";

import { useEffect, useMemo, useState } from "react";
import { formatCurrencyAmount } from "@/lib/currency";
import { UserMaterial } from "@/lib/supabase/materials-repository";
import {
  applyClientViewResponseById,
  listClientViewResponses,
  loadLatestClientViewByProjectId,
  publishClientView,
  updateClientViewStatusById,
} from "@/lib/supabase/projects-repository";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  ClientViewCardMode,
  ClientViewDetail,
  ClientViewPublishInput,
  ClientViewResponse,
  Project,
} from "@/types";

interface BuilderItemConfig {
  selected: boolean;
  cardMode: ClientViewCardMode;
  promptText: string;
  showSourceLink: boolean;
  optionMaterialIds: string[];
}

interface ClientViewBuilderProps {
  project: Project;
  materials: UserMaterial[];
  onProjectDataChanged?: () => Promise<void> | void;
}

function defaultConfigForObject(selectedMaterialId?: string): BuilderItemConfig {
  return {
    selected: false,
    cardMode: "material_choice",
    promptText: "",
    showSourceLink: false,
    optionMaterialIds: selectedMaterialId ? [selectedMaterialId] : [],
  };
}

function sanitizeOptionMaterialIds(optionMaterialIds: string[], allowedMaterialIds: Set<string>): string[] {
  return Array.from(
    new Set(
      optionMaterialIds
        .map((materialId) => materialId.trim())
        .filter((materialId) => materialId && allowedMaterialIds.has(materialId))
    )
  ).slice(0, 3);
}

function parseRecipientInput(value: string): string[] {
  return Array.from(
    new Set(
      value
        .split(/[\n,;]/)
        .map((email) => email.trim().toLowerCase())
        .filter(Boolean)
    )
  );
}

function toDatetimeLocalValue(value?: string | null): string {
  if (!value) {
    return "";
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "";
  }
  const offsetMs = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offsetMs).toISOString().slice(0, 16);
}

function formatCardModeLabel(cardMode: ClientViewCardMode): string {
  if (cardMode === "budget_input") {
    return "Budget input";
  }
  if (cardMode === "scope_confirmation") {
    return "Scope confirmation";
  }
  return "Material choice";
}

export function ClientViewBuilder({ project, materials, onProjectDataChanged }: ClientViewBuilderProps) {
  const [clientView, setClientView] = useState<ClientViewDetail | null>(null);
  const [responses, setResponses] = useState<ClientViewResponse[]>([]);
  const [title, setTitle] = useState(`${project.name} Client Review`);
  const [recipientInput, setRecipientInput] = useState("");
  const [expiresAt, setExpiresAt] = useState("");
  const [configsByObjectId, setConfigsByObjectId] = useState<Record<string, BuilderItemConfig>>({});
  const [optionPickerByObjectId, setOptionPickerByObjectId] = useState<Record<string, string>>({});
  const [publishedLink, setPublishedLink] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isPublishing, setIsPublishing] = useState(false);
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);
  const [applyingResponseId, setApplyingResponseId] = useState("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const allObjects = useMemo(
    () =>
      project.houses.flatMap((house) =>
        house.rooms.flatMap((room) =>
          room.objects.map((objectItem) => ({
            house,
            room,
            objectItem,
          }))
        )
      ),
    [project]
  );

  const ownedMaterialIds = useMemo(() => new Set(materials.map((material) => material.id)), [materials]);
  const responsesByItemId = useMemo(() => {
    const next = new Map<string, ClientViewResponse[]>();
    responses.forEach((response) => {
      const current = next.get(response.itemId) ?? [];
      current.push(response);
      next.set(response.itemId, current);
    });
    return next;
  }, [responses]);

  async function loadClientViewState() {
    setIsLoading(true);
    setErrorMessage(null);
    try {
      const detail = await loadLatestClientViewByProjectId(project.id);
      setClientView(detail);
      setTitle(detail?.title ?? `${project.name} Client Review`);
      setRecipientInput((detail?.recipients ?? []).map((recipient) => recipient.email).join("\n"));
      setExpiresAt(toDatetimeLocalValue(detail?.expiresAt));
      setResponses(detail ? await listClientViewResponses(detail.id) : []);
      setConfigsByObjectId(() => {
        const next: Record<string, BuilderItemConfig> = {};
        allObjects.forEach(({ objectItem }) => {
          next[objectItem.id] = defaultConfigForObject(
            objectItem.selectedProductId && ownedMaterialIds.has(objectItem.selectedProductId)
              ? objectItem.selectedProductId
              : undefined
          );
        });
        detail?.items.forEach((item) => {
          if (!item.roomObjectId) {
            return;
          }
          next[item.roomObjectId] = {
            selected: true,
            cardMode: item.cardMode,
            promptText: item.promptText ?? "",
            showSourceLink: item.showSourceLink,
            optionMaterialIds: sanitizeOptionMaterialIds(
              item.options
                .map((option) => option.sourceMaterialId)
                .filter((value): value is string => Boolean(value)),
              ownedMaterialIds
            ),
          };
        });
        return next;
      });
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Failed to load client view state.");
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    void loadClientViewState();
  }, [allObjects, ownedMaterialIds, project.id, project.name]);

  function updateConfig(objectId: string, patch: Partial<BuilderItemConfig>) {
    setConfigsByObjectId((current) => ({
      ...current,
      [objectId]: {
        ...(current[objectId] ?? defaultConfigForObject()),
        ...patch,
      },
    }));
  }

  const selectedCount = Object.values(configsByObjectId).filter((config) => config.selected).length;

  async function handlePublish() {
    const items = Object.entries(configsByObjectId)
      .filter(([, config]) => config.selected)
      .map(([roomObjectId, config]) => ({
        roomObjectId,
        cardMode: config.cardMode,
        promptText: config.promptText,
        showSourceLink: config.showSourceLink,
        optionMaterialIds:
          config.cardMode === "material_choice"
            ? sanitizeOptionMaterialIds(config.optionMaterialIds, ownedMaterialIds)
            : [],
      }));

    if (items.length === 0) {
      setErrorMessage("Select at least one object to publish.");
      return;
    }

    if (items.some((item) => item.cardMode === "material_choice" && item.optionMaterialIds.length === 0)) {
      setErrorMessage("Each material choice item needs at least one published option.");
      return;
    }

    const input: ClientViewPublishInput = {
      title,
      expiresAt: expiresAt ? new Date(expiresAt).toISOString() : null,
      recipientEmails: parseRecipientInput(recipientInput),
      items,
    };

    if (input.recipientEmails.length === 0) {
      setErrorMessage("Add at least one invited recipient email before publishing.");
      return;
    }

    setIsPublishing(true);
    setErrorMessage(null);
    try {
      const result = await publishClientView(project.id, input);
      setClientView(result.detail);
      setResponses(await listClientViewResponses(result.detail.id));
      if (typeof window !== "undefined" && result.token) {
        setPublishedLink(`${window.location.origin}/client/${result.token}`);
      }
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Failed to publish client view.");
    } finally {
      setIsPublishing(false);
    }
  }

  async function handleUpdateStatus(nextStatus: "closed" | "revoked") {
    if (!clientView) {
      return;
    }
    setIsUpdatingStatus(true);
    setErrorMessage(null);
    try {
      await updateClientViewStatusById(clientView.id, nextStatus);
      await loadClientViewState();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Failed to update client view status.");
    } finally {
      setIsUpdatingStatus(false);
    }
  }

  async function handleApplyResponse(response: ClientViewResponse) {
    setApplyingResponseId(response.id);
    setErrorMessage(null);
    try {
      await applyClientViewResponseById(project.id, response.id);
      await Promise.resolve(onProjectDataChanged?.());
      await loadClientViewState();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Failed to apply client response.");
    } finally {
      setApplyingResponseId("");
    }
  }

  return (
    <div className="space-y-4">
      <Card className="border-slate-200 shadow-sm">
        <CardHeader>
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant={clientView?.status === "published" ? "success" : "outline"}>{clientView?.status ?? "draft"}</Badge>
            <Badge variant="outline">{selectedCount} selected objects</Badge>
            {clientView?.publishedVersion ? <Badge variant="outline">Version {clientView.publishedVersion}</Badge> : null}
          </div>
          <CardTitle>Client view builder</CardTitle>
          <CardDescription>
            Publish a curated, frozen client-facing review page without exposing the full project workspace or materials database.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
          <div className="space-y-4">
            <label className="block space-y-1.5">
              <span className="text-sm font-medium text-slate-700">Client-facing title</span>
              <Input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Client review title" />
            </label>
            <label className="block space-y-1.5">
              <span className="text-sm font-medium text-slate-700">Invited recipient emails</span>
              <textarea
                className="min-h-28 w-full rounded-md border border-slate-200 px-3 py-2 text-sm outline-none ring-offset-white focus:ring-2 focus:ring-slate-300"
                value={recipientInput}
                onChange={(event) => setRecipientInput(event.target.value)}
                placeholder="client@example.com&#10;pm@example.com"
              />
            </label>
            <label className="block max-w-sm space-y-1.5">
              <span className="text-sm font-medium text-slate-700">Expiry</span>
              <Input type="datetime-local" value={expiresAt} onChange={(event) => setExpiresAt(event.target.value)} />
            </label>
          </div>
          <div className="space-y-3 rounded-xl border border-slate-200 bg-slate-50 p-4">
            <div className="space-y-1 text-sm text-slate-600">
              <p>Guests can open the share link.</p>
              <p>Only invited, signed-in emails can submit responses.</p>
              <p>Responses stay separate until you explicitly apply them.</p>
            </div>
            {publishedLink ? (
              <div className="space-y-2">
                <p className="text-sm font-medium text-slate-700">Latest share link</p>
                <Input readOnly value={publishedLink} />
                <div className="flex gap-2">
                  <Button type="button" variant="outline" onClick={() => void navigator.clipboard.writeText(publishedLink)}>
                    Copy link
                  </Button>
                  <Button type="button" variant="outline" asChild>
                    <a href={publishedLink} target="_blank" rel="noreferrer">
                      Open
                    </a>
                  </Button>
                </div>
              </div>
            ) : (
              <p className="text-sm text-slate-500">Publish to generate a new share link.</p>
            )}
            <div className="flex flex-wrap gap-2">
              <Button type="button" onClick={() => void handlePublish()} disabled={isPublishing || isLoading}>
                {isPublishing ? "Publishing..." : clientView ? "Republish view" : "Publish view"}
              </Button>
              {clientView ? (
                <>
                  <Button type="button" variant="outline" disabled={isUpdatingStatus} onClick={() => void handleUpdateStatus("closed")}>
                    Close
                  </Button>
                  <Button type="button" variant="outline" disabled={isUpdatingStatus} onClick={() => void handleUpdateStatus("revoked")}>
                    Revoke
                  </Button>
                </>
              ) : null}
            </div>
          </div>
        </CardContent>
      </Card>

      {errorMessage ? (
        <Card className="border-red-200 bg-red-50">
          <CardContent className="pt-5 text-sm text-red-700">{errorMessage}</CardContent>
        </Card>
      ) : null}

      <Card className="border-slate-200 shadow-sm">
        <CardHeader>
          <CardTitle>Published objects</CardTitle>
          <CardDescription>Select which room objects the client should see, and choose the review mode for each.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {allObjects.map(({ house, room, objectItem }) => {
            const config = configsByObjectId[objectItem.id] ?? defaultConfigForObject(objectItem.selectedProductId && ownedMaterialIds.has(objectItem.selectedProductId) ? objectItem.selectedProductId : undefined);
            const selectedMaterial = materials.find((material) => material.id === objectItem.selectedProductId);
            const availableMaterials = materials.filter((material) => !config.optionMaterialIds.includes(material.id));
            return (
              <div key={objectItem.id} className="rounded-xl border border-slate-200 p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <label className="inline-flex items-center gap-2 text-sm font-medium text-slate-800">
                        <input
                          type="checkbox"
                          checked={config.selected}
                          onChange={(event) => updateConfig(objectItem.id, { selected: event.target.checked })}
                        />
                        {objectItem.name}
                      </label>
                      <Badge variant="outline">{room.name}</Badge>
                      <Badge variant="outline">{house.name}</Badge>
                    </div>
                    <p className="mt-1 text-sm text-slate-500">
                      {objectItem.category} - Qty {objectItem.quantity}
                      {selectedMaterial ? ` - Current: ${selectedMaterial.name}` : " - No current selection"}
                    </p>
                  </div>
                  {objectItem.budgetAllowance != null ? (
                    <Badge variant="outline">Budget {formatCurrencyAmount(objectItem.budgetAllowance, project.currency)}</Badge>
                  ) : null}
                </div>

                {config.selected ? (
                  <div className="mt-4 grid gap-4 lg:grid-cols-[0.8fr_1.2fr]">
                    <div className="space-y-3">
                      <label className="block space-y-1.5">
                        <span className="text-sm font-medium text-slate-700">Card mode</span>
                        <select
                          className="h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none ring-offset-white focus:ring-2 focus:ring-slate-300"
                          value={config.cardMode}
                          onChange={(event) =>
                            updateConfig(objectItem.id, {
                              cardMode: event.target.value as ClientViewCardMode,
                              optionMaterialIds:
                                event.target.value === "material_choice" ? config.optionMaterialIds : [],
                            })
                          }
                        >
                          <option value="material_choice">Material choice</option>
                          <option value="budget_input">Budget input</option>
                          <option value="scope_confirmation">Scope confirmation</option>
                        </select>
                      </label>
                      <label className="block space-y-1.5">
                        <span className="text-sm font-medium text-slate-700">Prompt</span>
                        <textarea
                          className="min-h-24 w-full rounded-md border border-slate-200 px-3 py-2 text-sm outline-none ring-offset-white focus:ring-2 focus:ring-slate-300"
                          value={config.promptText}
                          onChange={(event) => updateConfig(objectItem.id, { promptText: event.target.value })}
                          placeholder="Optional prompt shown to the client"
                        />
                      </label>
                      <label className="inline-flex items-center gap-2 text-sm text-slate-700">
                        <input
                          type="checkbox"
                          checked={config.showSourceLink}
                          onChange={(event) => updateConfig(objectItem.id, { showSourceLink: event.target.checked })}
                        />
                        Show source/vendor links when available
                      </label>
                    </div>

                    {config.cardMode === "material_choice" ? (
                      <div className="space-y-3 rounded-xl border border-slate-200 bg-slate-50 p-4">
                        <div className="flex items-center justify-between gap-2">
                          <div>
                            <p className="text-sm font-medium text-slate-800">Published options</p>
                            <p className="text-xs text-slate-500">Choose up to 3 explicit materials from your private library.</p>
                          </div>
                          <Badge variant="outline">{config.optionMaterialIds.length}/3</Badge>
                        </div>
                        <div className="flex gap-2">
                          <select
                            className="h-10 flex-1 rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none ring-offset-white focus:ring-2 focus:ring-slate-300"
                            value={optionPickerByObjectId[objectItem.id] ?? ""}
                            onChange={(event) => setOptionPickerByObjectId((current) => ({ ...current, [objectItem.id]: event.target.value }))}
                          >
                            <option value="">Choose material</option>
                            {availableMaterials.map((material) => (
                              <option key={material.id} value={material.id}>
                                {material.name} - {material.supplier}
                              </option>
                            ))}
                          </select>
                          <Button
                            type="button"
                            variant="outline"
                            disabled={!optionPickerByObjectId[objectItem.id] || config.optionMaterialIds.length >= 3}
                            onClick={() => {
                              const materialId = optionPickerByObjectId[objectItem.id];
                              if (!materialId) {
                                return;
                              }
                              updateConfig(objectItem.id, {
                                optionMaterialIds: [...config.optionMaterialIds, materialId].slice(0, 3),
                              });
                              setOptionPickerByObjectId((current) => ({ ...current, [objectItem.id]: "" }));
                            }}
                          >
                            Add
                          </Button>
                        </div>
                        <div className="grid gap-2 md:grid-cols-2">
                          {config.optionMaterialIds.map((materialId) => {
                            const material = materials.find((entry) => entry.id === materialId);
                            if (!material) {
                              return null;
                            }
                            return (
                              <div key={material.id} className="rounded-lg border border-slate-200 bg-white p-3 text-sm">
                                <div className="flex items-start justify-between gap-2">
                                  <div>
                                    <p className="font-medium text-slate-900">{material.name}</p>
                                    <p className="text-slate-500">{material.supplier}</p>
                                    <p className="mt-1 text-slate-700">{formatCurrencyAmount(material.price, project.currency)}</p>
                                  </div>
                                  <Button
                                    type="button"
                                    size="sm"
                                    variant="ghost"
                                    onClick={() =>
                                      updateConfig(objectItem.id, {
                                        optionMaterialIds: config.optionMaterialIds.filter((entry) => entry !== material.id),
                                      })
                                    }
                                  >
                                    Remove
                                  </Button>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    ) : (
                      <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 p-4 text-sm text-slate-500">
                        {config.cardMode === "budget_input"
                          ? "Clients will see the object context and submit a preferred budget."
                          : "Clients will confirm whether this object is approved, not needed, or needs revision."}
                      </div>
                    )}
                  </div>
                ) : null}
              </div>
            );
          })}
        </CardContent>
      </Card>

      <Card className="border-slate-200 shadow-sm">
        <CardHeader>
          <CardTitle>Review by object</CardTitle>
          <CardDescription>Review saved client feedback for each published object and apply supported changes back into the project.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {!clientView ? (
            <p className="rounded-lg border border-dashed border-slate-200 bg-slate-50 px-4 py-6 text-sm text-slate-500">
              Publish a client view to start collecting responses.
            </p>
          ) : (
            clientView.items.map((item) => {
              const itemResponses = responsesByItemId.get(item.id) ?? [];
              const appliedCount = itemResponses.filter((response) => Boolean(response.appliedAt)).length;

              return (
                <div key={item.id} className="rounded-xl border border-slate-200 p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="space-y-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-medium text-slate-900">{item.objectName}</p>
                        <Badge variant="outline">{item.roomName}</Badge>
                        <Badge variant="outline">{item.houseName}</Badge>
                        <Badge variant="outline">{formatCardModeLabel(item.cardMode)}</Badge>
                      </div>
                      <p className="text-sm text-slate-500">
                        {item.objectCategory} - Qty {item.quantity}
                        {item.currentSelectedMaterialName ? ` - Current: ${item.currentSelectedMaterialName}` : ""}
                      </p>
                      {item.promptText ? <p className="text-sm text-slate-600">{item.promptText}</p> : null}
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant="outline">{itemResponses.length} response{itemResponses.length === 1 ? "" : "s"}</Badge>
                      {appliedCount > 0 ? <Badge variant="success">{appliedCount} applied</Badge> : null}
                      {item.budgetAllowance != null ? (
                        <Badge variant="outline">Target {formatCurrencyAmount(item.budgetAllowance, project.currency)}</Badge>
                      ) : null}
                    </div>
                  </div>

                  {item.cardMode === "material_choice" && item.options.length > 0 ? (
                    <div className="mt-4 grid gap-2 md:grid-cols-2 xl:grid-cols-3">
                      {item.options.map((option) => (
                        <div key={option.id} className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm">
                          <p className="font-medium text-slate-900">{option.name}</p>
                          {option.supplierName ? <p className="text-slate-500">{option.supplierName}</p> : null}
                          {option.price != null ? (
                            <p className="mt-1 text-slate-700">{formatCurrencyAmount(option.price, project.currency)}</p>
                          ) : null}
                        </div>
                      ))}
                    </div>
                  ) : null}

                  <div className="mt-4 space-y-3">
                    {itemResponses.length === 0 ? (
                      <p className="rounded-lg border border-dashed border-slate-200 bg-slate-50 px-4 py-5 text-sm text-slate-500">
                        No client responses yet for this object.
                      </p>
                    ) : (
                      itemResponses.map((response) => (
                        <div key={response.id} className="rounded-lg border border-slate-200 bg-white p-4">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <div>
                              <p className="font-medium text-slate-900">{response.recipientEmail}</p>
                              <p className="text-xs text-slate-500">Updated {new Date(response.updatedAt).toLocaleString()}</p>
                            </div>
                            <div className="flex flex-wrap items-center gap-2">
                              {response.selectedOptionName ? <Badge variant="outline">{response.selectedOptionName}</Badge> : null}
                              {response.scopeDecision ? <Badge variant="outline">{response.scopeDecision.replace("_", " ")}</Badge> : null}
                              {response.preferredBudget != null ? (
                                <Badge variant="outline">{formatCurrencyAmount(response.preferredBudget, project.currency)}</Badge>
                              ) : null}
                              {response.appliedAt ? <Badge variant="success">Applied</Badge> : null}
                            </div>
                          </div>
                          {response.comment ? <p className="mt-3 text-sm text-slate-600">{response.comment}</p> : null}
                          <div className="mt-3 flex items-center justify-end">
                            <Button
                              type="button"
                              variant="outline"
                              disabled={Boolean(response.appliedAt) || applyingResponseId === response.id}
                              onClick={() => void handleApplyResponse(response)}
                            >
                              {applyingResponseId === response.id ? "Applying..." : response.appliedAt ? "Applied" : "Apply to project"}
                            </Button>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              );
            })
          )}
        </CardContent>
      </Card>
    </div>
  );
}

