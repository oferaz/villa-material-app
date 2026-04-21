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
  focusedRoomId?: string;
  focusedObjectId?: string;
  onFocusChange?: (selection: { houseId: string; roomId: string; objectId: string }) => void;
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

export function ClientViewBuilder({ project, materials, focusedRoomId, focusedObjectId, onFocusChange, onProjectDataChanged }: ClientViewBuilderProps) {
  const [clientView, setClientView] = useState<ClientViewDetail | null>(null);
  const [responses, setResponses] = useState<ClientViewResponse[]>([]);
  const [title, setTitle] = useState(`${project.name} Client Review`);
  const [recipientInput, setRecipientInput] = useState("");
  const [expiresAt, setExpiresAt] = useState("");
  const [showProjectOverview, setShowProjectOverview] = useState(true);
  const [showHouseOverviews, setShowHouseOverviews] = useState(true);
  const [configsByObjectId, setConfigsByObjectId] = useState<Record<string, BuilderItemConfig>>({});
  const [optionPickerByObjectId, setOptionPickerByObjectId] = useState<Record<string, string>>({});
  const [internalFocusedRoomId, setInternalFocusedRoomId] = useState("");
  const [internalFocusedObjectId, setInternalFocusedObjectId] = useState("");
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
  const allRooms = useMemo(
    () => project.houses.flatMap((house) => house.rooms.map((room) => ({ house, room }))),
    [project]
  );
  const responsesByItemId = useMemo(() => {
    const next = new Map<string, ClientViewResponse[]>();
    responses.forEach((response) => {
      const current = next.get(response.itemId) ?? [];
      current.push(response);
      next.set(response.itemId, current);
    });
    return next;
  }, [responses]);

  const focusedRoomEntry = useMemo(() => {
    return allRooms.find(({ room }) => room.id === internalFocusedRoomId) ?? allRooms[0] ?? null;
  }, [allRooms, internalFocusedRoomId]);

  const focusedObjectEntry = useMemo(() => {
    if (!focusedRoomEntry) {
      return null;
    }

    return (
      allObjects.find(
        ({ room, objectItem }) => room.id === focusedRoomEntry.room.id && objectItem.id === internalFocusedObjectId
      ) ??
      allObjects.find(({ room }) => room.id === focusedRoomEntry.room.id) ??
      null
    );
  }, [allObjects, focusedRoomEntry, internalFocusedObjectId]);

  useEffect(() => {
    if (!allRooms.length) {
      if (internalFocusedRoomId) {
        setInternalFocusedRoomId("");
      }
      return;
    }

    const nextFocusedRoomId = allRooms.some(({ room }) => room.id === internalFocusedRoomId)
      ? internalFocusedRoomId
      : allRooms[0].room.id;

    if (nextFocusedRoomId !== internalFocusedRoomId) {
      setInternalFocusedRoomId(nextFocusedRoomId);
    }
  }, [allRooms, internalFocusedRoomId]);

  useEffect(() => {
    const activeRoom = allRooms.find(({ room }) => room.id === internalFocusedRoomId)?.room;
    const nextFocusedObjectId = activeRoom?.objects.some((objectItem) => objectItem.id === internalFocusedObjectId)
      ? internalFocusedObjectId
      : activeRoom?.objects[0]?.id ?? "";

    if (nextFocusedObjectId !== internalFocusedObjectId) {
      setInternalFocusedObjectId(nextFocusedObjectId);
    }
  }, [allRooms, internalFocusedObjectId, internalFocusedRoomId]);

  useEffect(() => {
    if (focusedObjectId) {
      const matchingObject = allObjects.find(({ objectItem }) => objectItem.id === focusedObjectId);
      if (!matchingObject) {
        return;
      }
      if (matchingObject.room.id !== internalFocusedRoomId) {
        setInternalFocusedRoomId(matchingObject.room.id);
      }
      if (matchingObject.objectItem.id !== internalFocusedObjectId) {
        setInternalFocusedObjectId(matchingObject.objectItem.id);
      }
      return;
    }

    if (focusedRoomId) {
      const matchingRoom = allRooms.find(({ room }) => room.id === focusedRoomId)?.room;
      if (!matchingRoom) {
        return;
      }
      if (matchingRoom.id !== internalFocusedRoomId) {
        setInternalFocusedRoomId(matchingRoom.id);
      }
      const nextFocusedObjectId = matchingRoom.objects[0]?.id ?? "";
      if (nextFocusedObjectId !== internalFocusedObjectId) {
        setInternalFocusedObjectId(nextFocusedObjectId);
      }
    }
  }, [allObjects, allRooms, focusedObjectId, focusedRoomId, internalFocusedObjectId, internalFocusedRoomId]);

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

  function handleFocusRoom(houseId: string, roomId: string, objectId: string) {
    setInternalFocusedRoomId(roomId);
    setInternalFocusedObjectId(objectId);
    onFocusChange?.({ houseId, roomId, objectId });
  }

  function handleFocusObject(houseId: string, roomId: string, objectId: string) {
    setInternalFocusedRoomId(roomId);
    setInternalFocusedObjectId(objectId);
    onFocusChange?.({ houseId, roomId, objectId });
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
    <div className="min-w-0 space-y-6">
      {focusedObjectManagerPortal}

      {/* Step progress indicator */}
      <div className="flex items-center gap-0">
        {/* Step 1 */}
        <div className="flex flex-col items-center gap-1">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-600 text-sm font-bold text-white">1</div>
          <span className="text-xs font-medium text-blue-700">Curate objects</span>
        </div>
        <div className={cn("mb-5 h-px flex-1", selectedCount > 0 ? "bg-blue-400" : "bg-slate-200")} />
        {/* Step 2 */}
        <div className="flex flex-col items-center gap-1">
          <div className={cn("flex h-8 w-8 items-center justify-center rounded-full text-sm font-bold", selectedCount > 0 ? "bg-blue-600 text-white" : "bg-slate-200 text-slate-500")}>2</div>
          <span className={cn("text-xs font-medium", selectedCount > 0 ? "text-blue-700" : "text-slate-400")}>Publish</span>
        </div>
        <div className={cn("mb-5 h-px flex-1", clientView?.status === "published" ? "bg-blue-400" : "bg-slate-200")} />
        {/* Step 3 */}
        <div className="flex flex-col items-center gap-1">
          <div className={cn("flex h-8 w-8 items-center justify-center rounded-full text-sm font-bold", clientView?.status === "published" ? "bg-blue-600 text-white" : "bg-slate-200 text-slate-500")}>3</div>
          <span className={cn("text-xs font-medium", clientView?.status === "published" ? "text-blue-700" : "text-slate-400")}>Client responses</span>
        </div>
      </div>

      {/* Publish card */}
      <Card className="border-slate-200 shadow-sm">
        <CardHeader className="pb-4">
          {/* Top row: status badges + big publish button */}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant={clientView?.status === "published" ? "success" : "outline"}>
                {clientView?.status ?? "draft"}
              </Badge>
              <Badge variant="outline">{selectedCount} selected objects</Badge>
              {clientView?.publishedVersion ? <Badge variant="outline">Version {clientView.publishedVersion}</Badge> : null}
            </div>
            <Button
              type="button"
              size="lg"
              disabled={isPublishing || isLoading || selectedCount === 0}
              onClick={() => void handlePublish()}
              className="gap-2"
            >
              {isPublishing ? "Publishing..." : clientView ? "Republish view" : "Publish view \u2192"}
            </Button>
          </div>
          <CardTitle className="text-lg">Share with client</CardTitle>
          <CardDescription>Fill in the details below, then publish to generate a private share link.</CardDescription>
        </CardHeader>

        <CardContent>
          <div className="grid gap-6 lg:grid-cols-2">
            {/* LEFT: form fields */}
            <div className="space-y-4">
              <label className="block space-y-1.5">
                <span className="text-sm font-medium text-slate-700">Review title</span>
                <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Villa Uzi — Material Choices" />
              </label>

              <label className="block space-y-1.5">
                <span className="text-sm font-medium text-slate-700">Recipient emails</span>
                <p className="text-xs text-slate-400">Only these emails can submit responses. One per line or comma-separated.</p>
                <textarea
                  className="min-h-24 w-full rounded-md border border-slate-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-slate-300"
                  value={recipientInput}
                  onChange={(e) => setRecipientInput(e.target.value)}
                  placeholder={"client@example.com\npm@example.com"}
                />
              </label>

              <label className="block max-w-xs space-y-1.5">
                <span className="text-sm font-medium text-slate-700">Expiry date</span>
                <Input type="datetime-local" value={expiresAt} onChange={(e) => setExpiresAt(e.target.value)} />
              </label>

              {/* Snapshot toggles */}
              <div className="space-y-2 rounded-lg border border-slate-100 bg-slate-50 p-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Show client</p>
                <label className="flex cursor-pointer items-center gap-2.5 text-sm text-slate-700">
                  <input type="checkbox" checked={showProjectOverview} onChange={(e) => setShowProjectOverview(e.target.checked)} className="rounded" />
                  Project progress &amp; budget snapshot
                </label>
                <label className="flex cursor-pointer items-center gap-2.5 text-sm text-slate-700">
                  <input type="checkbox" checked={showHouseOverviews} onChange={(e) => setShowHouseOverviews(e.target.checked)} className="rounded" />
                  Per-house progress &amp; budget snapshots
                </label>
                <p className="text-xs text-slate-400">Frozen at publish time — clients always see the same numbers you sent.</p>
              </div>
            </div>

            {/* RIGHT: share link + privacy info + close/revoke */}
            <div className="flex flex-col gap-4 rounded-xl border border-slate-100 bg-slate-50 p-4">
              {publishedLink ? (
                <div className="space-y-2">
                  <p className="text-sm font-semibold text-slate-700">Share link ready ✓</p>
                  <Input readOnly value={publishedLink} className="bg-white text-xs" />
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => void navigator.clipboard.writeText(publishedLink)}
                    >
                      Copy link
                    </Button>
                    <Button type="button" variant="outline" size="sm" asChild>
                      <a href={publishedLink} target="_blank" rel="noreferrer">Preview ↗</a>
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="space-y-1.5">
                  <p className="text-sm font-semibold text-slate-700">How it works</p>
                  <ul className="space-y-1.5 text-sm text-slate-500">
                    <li className="flex items-start gap-2"><span className="mt-0.5 text-blue-400">→</span> Anyone with the link can view</li>
                    <li className="flex items-start gap-2"><span className="mt-0.5 text-blue-400">→</span> Only invited emails can submit responses</li>
                    <li className="flex items-start gap-2"><span className="mt-0.5 text-blue-400">→</span> Responses stay separate until you apply them</li>
                    <li className="flex items-start gap-2"><span className="mt-0.5 text-blue-400">→</span> Your materials library is never exposed</li>
                  </ul>
                </div>
              )}

              {clientView ? (
                <div className="mt-auto flex flex-wrap gap-2 border-t border-slate-200 pt-4">
                  <Button type="button" variant="outline" size="sm" disabled={isUpdatingStatus} onClick={() => void handleUpdateStatus("closed")}>
                    Close view
                  </Button>
                  <Button type="button" variant="outline" size="sm" disabled={isUpdatingStatus} onClick={() => void handleUpdateStatus("revoked")}>
                    Revoke access
                  </Button>
                </div>
              ) : null}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Error message */}
      {errorMessage ? (
        <div className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          <span className="mt-0.5 font-bold">!</span>
          <p>{errorMessage}</p>
        </div>
      ) : null}

      {/* Curate objects card */}
      <Card className="border-slate-200 shadow-sm">
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <CardTitle>Curate objects to share</CardTitle>
              <CardDescription>
                Check each object you want the client to review. Click any row to configure its card type and material options in the right panel.
              </CardDescription>
            </div>
            <Badge variant={selectedCount > 0 ? "success" : "outline"} className="text-sm">
              {selectedCount} / {allObjects.length} selected
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-5">
          {/* Focused object hint */}
          {focusedObjectEntry ? (
            <div className="flex items-start gap-3 rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm">
              <div className="mt-0.5 h-2 w-2 shrink-0 rounded-full bg-blue-500" />
              <div>
                <p className="font-semibold text-slate-800">{focusedObjectEntry.objectItem.name}</p>
                <p className="text-slate-500">{focusedObjectEntry.room.name} · {focusedObjectEntry.house.name}</p>
                <p className="mt-1 text-xs text-slate-500">
                  {portalHost?.isConnected
                    ? "Edit card type, prompt, and material options in the right panel →"
                    : "Use the editor below to configure this object."}
                </p>
              </div>
            </div>
          ) : (
            <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-500">
              Click any object row to configure what the client will see for it.
            </div>
          )}

          {/* House → Room → Object tree */}
          <div className="space-y-6">
            {project.houses.map((house) => {
              const houseSelectedCount = house.rooms.reduce(
                (total, room) =>
                  total + room.objects.filter((objectItem) => (configsByObjectId[objectItem.id] ?? defaultConfigForObject()).selected).length,
                0
              );

              return (
                <section key={house.id} className="space-y-3">
                  {/* House header */}
                  <div className="flex items-center justify-between rounded-lg bg-slate-800 px-4 py-2.5 text-white">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">House</p>
                      <h3 className="font-semibold">{house.name}{house.sizeSqm ? <span className="ml-2 text-xs font-normal text-slate-400">{house.sizeSqm} m²</span> : null}</h3>
                    </div>
                    <Badge variant="outline" className="border-slate-600 text-slate-300">{houseSelectedCount} selected</Badge>
                  </div>

                  {/* Rooms */}
                  {house.rooms.map((room) => {
                    const roomSelectedCount = room.objects.filter(
                      (objectItem) => (configsByObjectId[objectItem.id] ?? defaultConfigForObject()).selected
                    ).length;
                    const isRoomFocused = room.id === focusedRoomEntry?.room.id;

                    return (
                      <div
                        key={room.id}
                        className={cn(
                          "overflow-hidden rounded-xl border transition",
                          isRoomFocused ? "border-blue-200 shadow-sm" : "border-slate-200"
                        )}
                      >
                        {/* Room header row */}
                        <button
                          type="button"
                          onClick={() => handleFocusRoom(house.id, room.id, room.objects[0]?.id ?? "")}
                          className={cn(
                            "flex w-full items-center justify-between px-4 py-2.5 text-left transition",
                            isRoomFocused ? "bg-blue-50" : "bg-slate-50 hover:bg-slate-100"
                          )}
                        >
                          <div>
                            <p className={cn("text-sm font-semibold", isRoomFocused ? "text-blue-800" : "text-slate-800")}>{room.name}</p>
                            <p className="text-xs text-slate-400">{room.objects.length} object{room.objects.length === 1 ? "" : "s"}</p>
                          </div>
                          <Badge variant={roomSelectedCount > 0 ? "success" : "outline"} className="text-xs">
                            {roomSelectedCount} included
                          </Badge>
                        </button>

                        {/* Object rows */}
                        <div className="divide-y divide-slate-100">
                          {room.objects.map((objectItem) => {
                            const config =
                              configsByObjectId[objectItem.id] ??
                              defaultConfigForObject(
                                objectItem.selectedProductId && ownedMaterialIds.has(objectItem.selectedProductId)
                                  ? objectItem.selectedProductId
                                  : undefined
                              );
                            const isFocused = focusedObjectEntry?.objectItem.id === objectItem.id;
                            const selectedMaterial = materials.find((m) => m.id === objectItem.selectedProductId);

                            // Readiness check for material_choice
                            const isReady = !config.selected || config.cardMode !== "material_choice" || config.optionMaterialIds.length > 0;

                            return (
                              <button
                                key={objectItem.id}
                                type="button"
                                onClick={() => handleFocusObject(house.id, room.id, objectItem.id)}
                                className={cn(
                                  "group flex w-full items-start gap-3 px-4 py-3 text-left transition",
                                  isFocused ? "bg-blue-50" : "bg-white hover:bg-slate-50"
                                )}
                              >
                                {/* Checkbox */}
                                <div className="mt-0.5 shrink-0" onClick={(e) => e.stopPropagation()}>
                                  <input
                                    type="checkbox"
                                    checked={config.selected}
                                    onChange={(e) => updateConfig(objectItem.id, { selected: e.target.checked })}
                                    className="h-4 w-4 cursor-pointer rounded border-slate-300 accent-blue-600"
                                  />
                                </div>

                                {/* Object info */}
                                <div className="min-w-0 flex-1">
                                  <div className="flex flex-wrap items-center gap-2">
                                    <span className="truncate text-sm font-medium text-slate-900">
                                      {objectItem.name}
                                      {objectItem.quantity > 1 ? <span className="ml-1 text-slate-400">×{objectItem.quantity}</span> : null}
                                    </span>
                                    {config.selected ? (
                                      <Badge
                                        variant={isReady ? "success" : "outline"}
                                        className={isReady ? undefined : "border-amber-300 bg-amber-50 text-amber-700"}
                                      >
                                        {isReady ? "Ready" : "Needs options"}
                                      </Badge>
                                    ) : null}
                                  </div>
                                  <p className="mt-0.5 truncate text-xs text-slate-400">
                                    {objectItem.category}
                                    {selectedMaterial ? ` · ${selectedMaterial.name}` : " · No material selected"}
                                  </p>
                                  {config.selected ? (
                                    <p className="mt-1 text-xs text-slate-500">
                                      {formatCardModeLabel(config.cardMode)}
                                      {config.cardMode === "material_choice" && config.optionMaterialIds.length > 0
                                        ? ` · ${config.optionMaterialIds.length} option${config.optionMaterialIds.length === 1 ? "" : "s"}`
                                        : null}
                                      {config.promptText ? " · Has prompt" : null}
                                    </p>
                                  ) : null}
                                </div>

                                {/* Right: budget + focus indicator */}
                                <div className="flex shrink-0 flex-col items-end gap-1.5">
                                  {objectItem.budgetAllowance != null ? (
                                    <Badge variant="outline" className="text-xs">{formatCurrencyAmount(objectItem.budgetAllowance, project.currency)}</Badge>
                                  ) : null}
                                  {isFocused ? <span className="text-xs font-medium text-blue-500">Editing →</span> : null}
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

          {/* Inline manager fallback (when no right panel) */}
          {portalHost?.isConnected ? null : focusedObjectManager}
        </CardContent>
      </Card>

      {/* Responses card */}
      <Card className="border-slate-200 shadow-sm">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Client responses</CardTitle>
              <CardDescription>Review feedback and apply changes back to your project.</CardDescription>
            </div>
            {clientView ? (
              <Badge variant="outline">{responses.length} total</Badge>
            ) : null}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {!clientView ? (
            <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-4 py-8 text-center text-sm text-slate-400">
              <p className="font-medium">No responses yet</p>
              <p className="mt-1">Publish a client view to start collecting feedback.</p>
            </div>
          ) : clientView.items.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-4 py-8 text-center text-sm text-slate-400">
              <p className="font-medium">View published without review cards</p>
              <p className="mt-1">Clients can see the project overview but there are no items to respond to.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {clientView.items.map((item) => {
                const itemResponses = responsesByItemId.get(item.id) ?? [];
                const appliedCount = itemResponses.filter((r) => Boolean(r.appliedAt)).length;

                return (
                  <div key={item.id} className="overflow-hidden rounded-xl border border-slate-200">
                    {/* Item header */}
                    <div className="flex flex-wrap items-start justify-between gap-3 bg-slate-50 px-4 py-3">
                      <div className="space-y-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="font-semibold text-slate-900">{item.objectName}</p>
                          <Badge variant="outline" className="text-xs">{item.roomName}</Badge>
                          <Badge variant="outline" className="text-xs">{item.houseName}</Badge>
                          <Badge variant="outline" className="text-xs">{formatCardModeLabel(item.cardMode)}</Badge>
                        </div>
                        <p className="text-xs text-slate-500">
                          {item.objectCategory} · Qty {item.quantity}
                          {item.currentSelectedMaterialName ? ` · Current: ${item.currentSelectedMaterialName}` : ""}
                        </p>
                        {item.promptText ? <p className="text-xs italic text-slate-500">&ldquo;{item.promptText}&rdquo;</p> : null}
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge variant={itemResponses.length > 0 ? "success" : "outline"}>
                          {itemResponses.length} response{itemResponses.length === 1 ? "" : "s"}
                        </Badge>
                        {appliedCount > 0 ? <Badge variant="success">{appliedCount} applied</Badge> : null}
                        {item.budgetAllowance != null ? (
                          <Badge variant="outline">Target {formatCurrencyAmount(item.budgetAllowance, project.currency)}</Badge>
                        ) : null}
                      </div>
                    </div>

                    {/* Material options (if any) */}
                    {item.cardMode === "material_choice" && item.options.length > 0 ? (
                      <div className="grid gap-2 border-t border-slate-100 px-4 py-3 md:grid-cols-2 xl:grid-cols-3">
                        {item.options.map((option) => (
                          <div key={option.id} className="rounded-lg border border-slate-200 bg-white p-3 text-sm">
                            <p className="font-medium text-slate-900">{option.name}</p>
                            {option.supplierName ? <p className="text-xs text-slate-400">{option.supplierName}</p> : null}
                            {option.price != null ? <p className="mt-1 font-medium text-slate-700">{formatCurrencyAmount(option.price, project.currency)}</p> : null}
                          </div>
                        ))}
                      </div>
                    ) : null}

                    {/* Responses */}
                    <div className="divide-y divide-slate-100">
                      {itemResponses.length === 0 ? (
                        <p className="px-4 py-4 text-center text-sm text-slate-400">No responses yet.</p>
                      ) : (
                        itemResponses.map((response) => (
                          <div key={response.id} className="px-4 py-3">
                            <div className="flex flex-wrap items-start justify-between gap-2">
                              <div>
                                <p className="text-sm font-semibold text-slate-800">{response.recipientEmail}</p>
                                <p className="text-xs text-slate-400">{new Date(response.updatedAt).toLocaleString()}</p>
                              </div>
                              <div className="flex flex-wrap items-center gap-2">
                                {response.selectedOptionName ? <Badge variant="outline">{response.selectedOptionName}</Badge> : null}
                                {response.scopeDecision ? <Badge variant="outline">{response.scopeDecision.replace("_", " ")}</Badge> : null}
                                {response.preferredBudget != null ? <Badge variant="outline">{formatCurrencyAmount(response.preferredBudget, project.currency)}</Badge> : null}
                                {response.appliedAt ? <Badge variant="success">Applied ✓</Badge> : null}
                              </div>
                            </div>
                            {response.comment ? (
                              <p className="mt-2 rounded-lg border border-slate-100 bg-slate-50 px-3 py-2 text-sm italic text-slate-600">
                                &ldquo;{response.comment}&rdquo;
                              </p>
                            ) : null}
                            <div className="mt-2 flex justify-end">
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                disabled={Boolean(response.appliedAt) || applyingResponseId === response.id}
                                onClick={() => void handleApplyResponse(response)}
                              >
                                {applyingResponseId === response.id ? "Applying\u2026" : response.appliedAt ? "Applied" : "Apply to project"}
                              </Button>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}