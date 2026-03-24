"use client";

import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
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
import { cn } from "@/lib/utils";
import { CLIENT_VIEW_FOCUS_PANEL_SLOT_ID, ClientViewFocusedObjectManager } from "@/components/client-view/client-view-focus-panel";
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

interface ProjectObjectEntry {
  house: Project["houses"][number];
  room: Project["houses"][number]["rooms"][number];
  objectItem: Project["houses"][number]["rooms"][number]["objects"][number];
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

function summarizeConfig(config: BuilderItemConfig): string {
  if (!config.selected) {
    return "Not included in the shared view yet.";
  }
  if (config.cardMode === "material_choice") {
    return `${config.optionMaterialIds.length} material option${config.optionMaterialIds.length === 1 ? "" : "s"} prepared.`;
  }
  if (config.cardMode === "budget_input") {
    return "Client will submit a preferred budget for this object.";
  }
  return "Client will confirm scope for this object.";
}

export function ClientViewBuilder({ project, materials, onProjectDataChanged }: ClientViewBuilderProps) {
  const [clientView, setClientView] = useState<ClientViewDetail | null>(null);
  const [responses, setResponses] = useState<ClientViewResponse[]>([]);
  const [title, setTitle] = useState(`${project.name} Client Review`);
  const [recipientInput, setRecipientInput] = useState("");
  const [expiresAt, setExpiresAt] = useState("");
  const [showProjectOverview, setShowProjectOverview] = useState(true);
  const [showHouseOverviews, setShowHouseOverviews] = useState(true);
  const [configsByObjectId, setConfigsByObjectId] = useState<Record<string, BuilderItemConfig>>({});
  const [optionPickerByObjectId, setOptionPickerByObjectId] = useState<Record<string, string>>({});
  const [focusedObjectId, setFocusedObjectId] = useState("");
  const [publishedLink, setPublishedLink] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isPublishing, setIsPublishing] = useState(false);
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);
  const [applyingResponseId, setApplyingResponseId] = useState("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const allObjects = useMemo<ProjectObjectEntry[]>(
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

  const focusedObjectEntry = useMemo(() => {
    return allObjects.find(({ objectItem }) => objectItem.id === focusedObjectId) ?? allObjects[0] ?? null;
  }, [allObjects, focusedObjectId]);

  useEffect(() => {
    if (!allObjects.length) {
      if (focusedObjectId) {
        setFocusedObjectId("");
      }
      return;
    }

    const nextFocusedId = allObjects.some(({ objectItem }) => objectItem.id === focusedObjectId)
      ? focusedObjectId
      : allObjects[0].objectItem.id;

    if (nextFocusedId !== focusedObjectId) {
      setFocusedObjectId(nextFocusedId);
    }
  }, [allObjects, focusedObjectId]);

  const [portalHost, setPortalHost] = useState<HTMLElement | null>(null);

  useEffect(() => {
    if (typeof document === "undefined") {
      return;
    }

    const syncPortalHost = () => setPortalHost(document.getElementById(CLIENT_VIEW_FOCUS_PANEL_SLOT_ID));
    syncPortalHost();
    const observer = new MutationObserver(syncPortalHost);
    observer.observe(document.body, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, []);

  async function loadClientViewState() {
    setIsLoading(true);
    setErrorMessage(null);
    try {
      const detail = await loadLatestClientViewByProjectId(project.id);
      setClientView(detail);
      setTitle(detail?.title ?? `${project.name} Client Review`);
      setRecipientInput((detail?.recipients ?? []).map((recipient) => recipient.email).join("\n"));
      setExpiresAt(toDatetimeLocalValue(detail?.expiresAt));
      setShowProjectOverview(detail?.showProjectOverview ?? true);
      setShowHouseOverviews(detail?.showHouseOverviews ?? true);
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


    if (items.some((item) => item.cardMode === "material_choice" && item.optionMaterialIds.length === 0)) {
      setErrorMessage("Each material choice item needs at least one published option.");
      return;
    }

    const input: ClientViewPublishInput = {
      title,
      expiresAt: expiresAt ? new Date(expiresAt).toISOString() : null,
      recipientEmails: parseRecipientInput(recipientInput),
      showProjectOverview,
      showHouseOverviews,
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

  const focusedConfig =
    focusedObjectEntry == null
      ? null
      : configsByObjectId[focusedObjectEntry.objectItem.id] ??
        defaultConfigForObject(
          focusedObjectEntry.objectItem.selectedProductId && ownedMaterialIds.has(focusedObjectEntry.objectItem.selectedProductId)
            ? focusedObjectEntry.objectItem.selectedProductId
            : undefined
        );

  const focusedSelectedMaterial =
    focusedObjectEntry == null
      ? null
      : materials.find((material) => material.id === focusedObjectEntry.objectItem.selectedProductId) ?? null;

  const focusedAvailableMaterials =
    focusedObjectEntry == null || focusedConfig == null
      ? []
      : materials.filter((material) => !focusedConfig.optionMaterialIds.includes(material.id));

  const focusedObjectManager = !focusedObjectEntry || !focusedConfig ? (
    <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 p-6 text-sm text-slate-500">
      Choose an object from the map to manage card mode, prompt, and published materials.
    </div>
  ) : (
    <ClientViewFocusedObjectManager
      houseName={focusedObjectEntry.house.name}
      roomName={focusedObjectEntry.room.name}
      objectName={focusedObjectEntry.objectItem.name}
      objectCategory={focusedObjectEntry.objectItem.category}
      quantity={focusedObjectEntry.objectItem.quantity}
      budgetAllowance={focusedObjectEntry.objectItem.budgetAllowance}
      currentSelectedMaterialName={focusedSelectedMaterial?.name ?? null}
      selected={focusedConfig.selected}
      cardMode={focusedConfig.cardMode}
      promptText={focusedConfig.promptText}
      showSourceLink={focusedConfig.showSourceLink}
      optionMaterialIds={focusedConfig.optionMaterialIds}
      materials={materials}
      availableMaterials={focusedAvailableMaterials}
      optionPickerValue={optionPickerByObjectId[focusedObjectEntry.objectItem.id] ?? ""}
      projectCurrency={project.currency}
      onToggleSelected={(selected) => updateConfig(focusedObjectEntry.objectItem.id, { selected })}
      onCardModeChange={(cardMode) => updateConfig(focusedObjectEntry.objectItem.id, { cardMode, optionMaterialIds: cardMode === "material_choice" ? focusedConfig.optionMaterialIds : [] })}
      onPromptChange={(promptText) => updateConfig(focusedObjectEntry.objectItem.id, { promptText })}
      onToggleShowSourceLink={(showSourceLink) => updateConfig(focusedObjectEntry.objectItem.id, { showSourceLink })}
      onOptionPickerChange={(value) => setOptionPickerByObjectId((current) => ({ ...current, [focusedObjectEntry.objectItem.id]: value }))}
      onAddOption={() => {
        const materialId = optionPickerByObjectId[focusedObjectEntry.objectItem.id];
        if (!materialId) {
          return;
        }
        updateConfig(focusedObjectEntry.objectItem.id, { optionMaterialIds: [...focusedConfig.optionMaterialIds, materialId].slice(0, 3) });
        setOptionPickerByObjectId((current) => ({ ...current, [focusedObjectEntry.objectItem.id]: "" }));
      }}
      onRemoveOption={(materialId) => updateConfig(focusedObjectEntry.objectItem.id, { optionMaterialIds: focusedConfig.optionMaterialIds.filter((entry) => entry !== materialId) })}
    />
  );

  const focusedObjectManagerPortal = portalHost && portalHost.isConnected ? createPortal(focusedObjectManager, portalHost) : null;

  return (
    <div className="min-w-0 space-y-4">
      {focusedObjectManagerPortal}
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
            <div className="min-w-0 space-y-3 rounded-xl border border-slate-200 bg-slate-50 p-4">
              <div>
                <p className="text-sm font-medium text-slate-700">Client summary snapshots</p>
                <p className="text-xs text-slate-500">Show a frozen progress and budget snapshot alongside the published review cards.</p>
              </div>
              <label className="inline-flex items-center gap-2 text-sm text-slate-700">
                <input
                  type="checkbox"
                  checked={showProjectOverview}
                  onChange={(event) => setShowProjectOverview(event.target.checked)}
                />
                Show project progress and budget
              </label>
              <label className="inline-flex items-center gap-2 text-sm text-slate-700">
                <input
                  type="checkbox"
                  checked={showHouseOverviews}
                  onChange={(event) => setShowHouseOverviews(event.target.checked)}
                />
                Show house progress and budget
              </label>
              <p className="text-xs text-slate-500">These summaries are frozen at publish time so clients see the same snapshot you shared.</p>
            </div>
          </div>
          <div className="min-w-0 space-y-3 rounded-xl border border-slate-200 bg-slate-50 p-4">
            <div className="space-y-1 text-sm text-slate-600">
              <p>Guests can open the share link.</p>
              <p>Only invited, signed-in emails can submit responses.</p>
              <p>Responses stay separate until you explicitly apply them.</p>
            </div>
            {publishedLink ? (
              <div className="min-w-0 space-y-2">
                <p className="text-sm font-medium text-slate-700">Latest share link</p>
                <Input readOnly value={publishedLink} />
                <div className="flex min-w-0 gap-2">
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
          <CardTitle>Objects to share</CardTitle>
          <CardDescription>Use the project map here, then manage card mode, prompt, and material options from the right panel in Client View.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="rounded-xl border border-blue-200 bg-blue-50/70 p-4 text-sm text-slate-700">
            <p className="text-xs font-semibold uppercase tracking-wide text-blue-700">Focused object</p>
            {focusedObjectEntry ? (
              <>
                <p className="mt-1 font-semibold text-slate-900">{focusedObjectEntry.objectItem.name}</p>
                <p className="mt-1 text-slate-600">{focusedObjectEntry.room.name} - {focusedObjectEntry.house.name}</p>
                <p className="mt-2 text-slate-600">
                  {portalHost && portalHost.isConnected
                    ? "Use the right panel to edit card mode, prompt, source links, and material options for this object."
                    : "Use the editor below to edit card mode, prompt, source links, and material options for this object."}
                </p>
              </>
            ) : (
              <p className="mt-1 text-slate-600">Choose an object from the map to start configuring what the client will see.</p>
            )}
          </div>

          <div className="space-y-4">
            {project.houses.map((house) => {
              const houseSelectedCount = house.rooms.reduce(
                (total, room) =>
                  total + room.objects.filter((objectItem) => (configsByObjectId[objectItem.id] ?? defaultConfigForObject()).selected).length,
                0
              );

              return (
                <section key={house.id} className="space-y-3">
                  <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">House</p>
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <h3 className="text-base font-semibold text-slate-900">{house.name}</h3>
                      <Badge variant="outline">{houseSelectedCount} selected</Badge>
                    </div>
                    {house.sizeSqm ? <p className="text-xs text-slate-500">{house.sizeSqm} m2</p> : null}
                  </div>

                  {house.rooms.map((room) => {
                    const roomSelectedCount = room.objects.filter((objectItem) => (configsByObjectId[objectItem.id] ?? defaultConfigForObject()).selected).length;
                    const isRoomFocused = room.objects.some((objectItem) => objectItem.id === focusedObjectEntry?.objectItem.id);

                    return (
                      <div
                        key={room.id}
                        className={cn(
                          "space-y-2.5 rounded-xl border p-3 transition",
                          isRoomFocused ? "border-blue-200 bg-blue-50/60 shadow-sm" : "border-slate-200 bg-white"
                        )}
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div>
                            <p className="font-medium text-slate-900">{room.name}</p>
                            <p className="text-xs text-slate-500">{room.objects.length} object{room.objects.length === 1 ? "" : "s"}</p>
                          </div>
                          <Badge variant="outline">{roomSelectedCount} selected</Badge>
                        </div>

                        <div className="space-y-2">
                          {room.objects.map((objectItem) => {
                            const config =
                              configsByObjectId[objectItem.id] ??
                              defaultConfigForObject(
                                objectItem.selectedProductId && ownedMaterialIds.has(objectItem.selectedProductId)
                                  ? objectItem.selectedProductId
                                  : undefined
                              );
                            const isFocused = focusedObjectEntry?.objectItem.id === objectItem.id;
                            const selectedMaterial = materials.find((material) => material.id === objectItem.selectedProductId);

                            return (
                              <button
                                key={objectItem.id}
                                type="button"
                                onClick={() => setFocusedObjectId(objectItem.id)}
                                className={cn(
                                  "w-full rounded-lg border px-3 py-2 text-left transition",
                                  isFocused ? "border-blue-300 bg-blue-50 shadow-sm" : "border-slate-200 bg-white hover:bg-slate-50",
                                  config.selected ? "ring-1 ring-emerald-200" : ""
                                )}
                              >
                                <div className="flex items-start gap-3">
                                  <input
                                    type="checkbox"
                                    checked={config.selected}
                                    onClick={(event) => event.stopPropagation()}
                                    onChange={(event) => updateConfig(objectItem.id, { selected: event.target.checked })}
                                    className="mt-1"
                                  />
                                  <div className="min-w-0 flex-1">
                                    <div className="flex flex-wrap items-center gap-2">
                                      <p className="truncate text-sm font-medium text-slate-900">
                                        {objectItem.name}
                                        {objectItem.quantity > 1 ? ` x${objectItem.quantity}` : ""}
                                      </p>
                                      {config.selected ? <Badge variant="success">Included</Badge> : null}
                                      <Badge variant="outline">{formatCardModeLabel(config.cardMode)}</Badge>
                                    </div>
                                    <p className="mt-1 text-xs text-slate-500">
                                      {objectItem.category}
                                      {selectedMaterial ? ` - Current: ${selectedMaterial.name}` : " - No current selection"}
                                    </p>
                                    <p className="mt-1 text-xs text-slate-500">{summarizeConfig(config)}</p>
                                  </div>
                                  {objectItem.budgetAllowance != null ? (
                                    <Badge variant="outline">{formatCurrencyAmount(objectItem.budgetAllowance, project.currency)}</Badge>
                                  ) : null}
                                </div>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </section>
              );
            })}
          </div>


          {portalHost && portalHost.isConnected ? null : focusedObjectManager}
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
          ) : clientView.items.length === 0 ? (
            <p className="rounded-lg border border-dashed border-slate-200 bg-slate-50 px-4 py-6 text-sm text-slate-500">
              This version was shared without any object review cards. Clients can still open the link and see the published project or house summary snapshots.
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