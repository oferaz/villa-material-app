import { FormEvent, useEffect, useState } from "react";
import { Trash2 } from "lucide-react";
import { Room, RoomBudget, getObjectWorkflowStage, getWorkflowStageLabel } from "@/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { formatCurrencyAmount } from "@/lib/currency";
import {
  getBudgetHealthLabel,
  getBudgetHealthStatus,
  getBudgetHealthVariant,
  getObjectBudgetFitLabel,
  getObjectBudgetFitStatus,
  getObjectBudgetFitVariant,
  getRoomObjectSelectedLineCost,
} from "@/lib/mock/budget";
import { cn } from "@/lib/utils";

interface RoomObjectsListProps {
  room?: Room;
  selectedObjectId: string;
  showWorkflowHints: boolean;
  overBudgetObjectIds?: string[];
  roomBudget?: RoomBudget;
  projectCurrency: string;
  onSelectObject: (objectId: string) => void;
  onDeleteObject: (objectId: string) => void;
  onUpdateBudgetAllowance: (objectId: string, budgetAllowance: number | null) => void;
  onUpdateWorkflow: (
    objectId: string,
    patch: { poApproved?: boolean; ordered?: boolean; installed?: boolean }
  ) => void;
}

function normalizeObjectBudget(value: number | null | undefined): number | null {
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) {
    return null;
  }

  return Math.round(value);
}

function parseBudgetInput(value: string): number | null | "invalid" {
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  const parsed = Number(trimmed.replace(/,/g, ""));
  if (!Number.isFinite(parsed) || parsed < 0) {
    return "invalid";
  }

  const normalized = Math.round(parsed);
  return normalized > 0 ? normalized : null;
}

function formatBudgetDelta(value: number | null, currency: string): string {
  if (value === null) {
    return "Set object budget to compare";
  }

  const rounded = Math.round(value);
  if (rounded === 0) {
    return "On object budget";
  }
  if (rounded > 0) {
    return `${formatCurrencyAmount(rounded, currency)} over object budget`;
  }
  return `${formatCurrencyAmount(Math.abs(rounded), currency)} under object budget`;
}

function resolveBudgetBadge(
  objectItem: Room["objects"][number],
  roomBudget: RoomBudget | undefined
): { label: string; variant: "success" | "secondary" | "danger" | "outline" } {
  const roomHealth = getBudgetHealthStatus(roomBudget?.totalBudget, roomBudget?.remainingAmount);
  const hasObjectBudget = normalizeObjectBudget(objectItem.budgetAllowance) !== null;
  const hasMaterial = Boolean(objectItem.selectedProductId);

  if (hasMaterial && hasObjectBudget) {
    const objectBudgetStatus = getObjectBudgetFitStatus(getRoomObjectSelectedLineCost(objectItem), objectItem.budgetAllowance ?? null);
    return {
      label: `Budget: ${getObjectBudgetFitLabel(objectBudgetStatus)}`,
      variant: getObjectBudgetFitVariant(objectBudgetStatus),
    };
  }

  if (roomHealth !== "not_planned") {
    return {
      label: `Budget: ${getBudgetHealthLabel(roomHealth)}`,
      variant: getBudgetHealthVariant(roomHealth),
    };
  }

  if (hasObjectBudget) {
    return {
      label: "Budget: Object budget set",
      variant: "outline",
    };
  }

  return {
    label: "Budget: No object budget",
    variant: "outline",
  };
}

export function RoomObjectsList({
  room,
  selectedObjectId,
  showWorkflowHints,
  overBudgetObjectIds = [],
  roomBudget,
  projectCurrency,
  onSelectObject,
  onDeleteObject,
  onUpdateBudgetAllowance,
  onUpdateWorkflow,
}: RoomObjectsListProps) {
  const [budgetInputs, setBudgetInputs] = useState<Record<string, string>>({});
  const [budgetErrors, setBudgetErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!room) {
      setBudgetInputs({});
      setBudgetErrors({});
      return;
    }

    setBudgetInputs(
      room.objects.reduce<Record<string, string>>((acc, objectItem) => {
        const objectBudget = normalizeObjectBudget(objectItem.budgetAllowance);
        acc[objectItem.id] = objectBudget === null ? "" : String(objectBudget);
        return acc;
      }, {})
    );
    setBudgetErrors({});
  }, [room]);

  if (!room) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Room objects</CardTitle>
          <CardDescription>Select a room to view objects.</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  const overBudgetObjectIdSet = new Set(overBudgetObjectIds);

  function handleBudgetInputChange(objectId: string, value: string) {
    setBudgetInputs((prev) => ({
      ...prev,
      [objectId]: value,
    }));
    setBudgetErrors((prev) => ({
      ...prev,
      [objectId]: "",
    }));
  }

  function handleBudgetSave(event: FormEvent, objectId: string) {
    event.preventDefault();
    const parsedBudget = parseBudgetInput(budgetInputs[objectId] ?? "");
    if (parsedBudget === "invalid") {
      setBudgetErrors((prev) => ({
        ...prev,
        [objectId]: "Enter a valid non-negative number.",
      }));
      return;
    }

    setBudgetErrors((prev) => ({
      ...prev,
      [objectId]: "",
    }));
    onUpdateBudgetAllowance(objectId, parsedBudget);
  }

  function handleBudgetClear(objectId: string) {
    setBudgetInputs((prev) => ({
      ...prev,
      [objectId]: "",
    }));
    setBudgetErrors((prev) => ({
      ...prev,
      [objectId]: "",
    }));
    onUpdateBudgetAllowance(objectId, null);
  }

  return (
    <Card className="border-slate-200 shadow-sm">
      <CardHeader className="pb-3">
        <div>
          <CardTitle className="text-base">Room objects</CardTitle>
          <CardDescription>
            {room.objects.reduce((acc, objectItem) => acc + Math.max(1, objectItem.quantity), 0)} total items
          </CardDescription>
        </div>
      </CardHeader>
      <CardContent>
        <ul className="space-y-2">
          {room.objects.map((objectItem) => {
            const workflowStage = getObjectWorkflowStage(objectItem);
            const isSelected = selectedObjectId === objectItem.id;
            const hasMaterial = Boolean(objectItem.selectedProductId);
            const isPushingRoomOverBudget = overBudgetObjectIdSet.has(objectItem.id);
            const selectedMaterialName =
              objectItem.productOptions.find((option) => option.id === objectItem.selectedProductId)?.name ?? "";
            const showWorkflowActions = showWorkflowHints || isSelected;
            const budgetBadge = resolveBudgetBadge(objectItem, roomBudget);
            const objectBudget = normalizeObjectBudget(objectItem.budgetAllowance);
            const selectedLineCost = hasMaterial ? Math.round(getRoomObjectSelectedLineCost(objectItem)) : null;
            const objectBudgetStatus =
              hasMaterial && objectBudget !== null ? getObjectBudgetFitStatus(selectedLineCost ?? 0, objectBudget) : "no_object_budget";
            const budgetDelta =
              hasMaterial && selectedLineCost !== null && objectBudget !== null ? selectedLineCost - objectBudget : null;
            const budgetInput = budgetInputs[objectItem.id] ?? (objectBudget === null ? "" : String(objectBudget));
            const parsedBudgetInput = parseBudgetInput(budgetInput);
            const isBudgetDirty = parsedBudgetInput !== "invalid" && parsedBudgetInput !== objectBudget;

            return (
              <li key={objectItem.id} data-room-object-id={objectItem.id}>
                <div
                  className={cn(
                    "flex items-start gap-2 rounded-lg border px-3 py-2 transition",
                    isPushingRoomOverBudget
                      ? "border-red-300 bg-red-50/70"
                      : hasMaterial
                        ? "border-emerald-200 bg-emerald-50/40"
                        : "border-amber-200 bg-amber-50/40",
                    isSelected &&
                      (isPushingRoomOverBudget
                        ? "border-red-400 bg-red-50 ring-2 ring-red-200 shadow-sm"
                        : "border-primary bg-blue-50 ring-2 ring-blue-200 shadow-sm")
                  )}
                >
                  <div className="min-w-0 flex-1">
                    <button type="button" className="min-w-0 w-full text-left" onClick={() => onSelectObject(objectItem.id)}>
                      <p className="truncate text-sm font-medium text-slate-800">
                        {objectItem.name}
                        {objectItem.quantity > 1 ? ` x${objectItem.quantity}` : ""}
                      </p>
                      <p className="text-xs text-slate-500">{objectItem.category}</p>
                    </button>

                    <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                      <Badge variant="outline">{`Workflow: ${getWorkflowStageLabel(workflowStage)}`}</Badge>
                      <Badge variant={budgetBadge.variant}>{budgetBadge.label}</Badge>
                    </div>

                    <p
                      className={cn(
                        "mt-1 text-xs",
                        isPushingRoomOverBudget ? "text-red-700" : hasMaterial ? "text-emerald-700" : "text-amber-700"
                      )}
                    >
                      {hasMaterial
                        ? `Selected material: ${selectedMaterialName || "Assigned material"}`
                        : "No material selected yet. Tap to assign."}
                    </p>

                    {isSelected ? (
                      <div className="mt-2 rounded-lg border border-slate-200 bg-white/90 p-2.5">
                        <div className="flex flex-wrap items-start justify-between gap-2">
                          <div>
                            <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Selected cost vs budget</p>
                            <p className="text-xs text-slate-500">Review the selected material total against this object budget directly in the room list.</p>
                          </div>
                          <Badge variant={hasMaterial && objectBudget !== null ? getObjectBudgetFitVariant(objectBudgetStatus) : "outline"}>
                            {hasMaterial && objectBudget !== null ? getObjectBudgetFitLabel(objectBudgetStatus) : "Budget comparison pending"}
                          </Badge>
                        </div>
                        <div className="mt-3 grid gap-2 text-xs text-slate-600 sm:grid-cols-3">
                          <div className="rounded-md border border-slate-200 bg-slate-50 px-2.5 py-2">
                            <p className="font-semibold uppercase tracking-wide text-slate-500">Selected cost</p>
                            <p className="mt-1 text-sm font-semibold text-slate-900">
                              {hasMaterial ? formatCurrencyAmount(selectedLineCost, projectCurrency) : "No material selected"}
                            </p>
                          </div>
                          <div className="rounded-md border border-slate-200 bg-slate-50 px-2.5 py-2">
                            <p className="font-semibold uppercase tracking-wide text-slate-500">Object budget</p>
                            <p className="mt-1 text-sm font-semibold text-slate-900">
                              {objectBudget === null ? "Not set" : formatCurrencyAmount(objectBudget, projectCurrency)}
                            </p>
                          </div>
                          <div className="rounded-md border border-slate-200 bg-slate-50 px-2.5 py-2">
                            <p className="font-semibold uppercase tracking-wide text-slate-500">Difference</p>
                            <p
                              className={cn(
                                "mt-1 text-sm font-semibold",
                                budgetDelta !== null && budgetDelta > 0 ? "text-red-700" : budgetDelta !== null && budgetDelta < 0 ? "text-emerald-700" : "text-slate-900"
                              )}
                            >
                              {hasMaterial ? formatBudgetDelta(budgetDelta, projectCurrency) : "Select a material to compare"}
                            </p>
                          </div>
                        </div>
                      </div>
                    ) : objectBudget !== null || hasMaterial ? (
                      <div className="mt-1 grid gap-1 text-xs text-slate-500 sm:grid-cols-2">
                        <p>Selected cost: {hasMaterial ? formatCurrencyAmount(selectedLineCost, projectCurrency) : "No material selected"}</p>
                        <p>Object budget: {objectBudget === null ? "Not set" : formatCurrencyAmount(objectBudget, projectCurrency)}</p>
                      </div>
                    ) : null}

                    {isPushingRoomOverBudget ? (
                      <p className="mt-1 text-xs font-medium text-red-700">
                        This object contributes to the room going over plan.
                      </p>
                    ) : null}

                    {isSelected ? (
                      <form onSubmit={(event) => handleBudgetSave(event, objectItem.id)} className="mt-2 rounded-lg border border-slate-200 bg-white/90 p-2.5">
                        <div className="flex flex-wrap items-start justify-between gap-2">
                          <div>
                            <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Object budget</p>
                            <p className="text-xs text-slate-500">Set or update the object budget here without opening product options.</p>
                          </div>
                          <Badge variant="outline">Room section editor</Badge>
                        </div>
                        <div className="mt-2 flex flex-col gap-2 sm:flex-row">
                          <Input
                            value={budgetInput}
                            onChange={(event) => handleBudgetInputChange(objectItem.id, event.target.value)}
                            placeholder={`Set object budget in ${projectCurrency}`}
                            inputMode="numeric"
                            className="sm:flex-1"
                          />
                          <Button type="submit" size="sm" variant="outline" disabled={parsedBudgetInput === "invalid" || !isBudgetDirty}>
                            Save object budget
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            variant="ghost"
                            disabled={objectBudget === null && !budgetInput.trim()}
                            onClick={() => handleBudgetClear(objectItem.id)}
                          >
                            Clear
                          </Button>
                        </div>
                        {budgetErrors[objectItem.id] ? (
                          <p className="mt-2 text-xs text-red-600">{budgetErrors[objectItem.id]}</p>
                        ) : null}
                      </form>
                    ) : null}

                    {showWorkflowActions ? (
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        <Button
                          type="button"
                          size="sm"
                          variant={objectItem.poApproved ? "default" : "outline"}
                          className="h-7 px-2 text-xs"
                          disabled={!hasMaterial || Boolean(objectItem.poApproved)}
                          onClick={() => onUpdateWorkflow(objectItem.id, { poApproved: true })}
                        >
                          Approve PO
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant={objectItem.ordered ? "default" : "outline"}
                          className="h-7 px-2 text-xs"
                          disabled={!hasMaterial || !Boolean(objectItem.poApproved) || Boolean(objectItem.ordered)}
                          onClick={() => onUpdateWorkflow(objectItem.id, { ordered: true })}
                        >
                          Ordered
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant={objectItem.installed ? "default" : "outline"}
                          className="h-7 px-2 text-xs"
                          disabled={!hasMaterial || !Boolean(objectItem.ordered) || Boolean(objectItem.installed)}
                          onClick={() => onUpdateWorkflow(objectItem.id, { installed: true })}
                        >
                          Installed
                        </Button>
                        {objectItem.poApproved || objectItem.ordered || objectItem.installed ? (
                          <Button
                            type="button"
                            size="sm"
                            variant="ghost"
                            className="h-7 px-2 text-xs"
                            onClick={() => onUpdateWorkflow(objectItem.id, { poApproved: false })}
                          >
                            Reset
                          </Button>
                        ) : null}
                      </div>
                    ) : (
                      <p className="mt-2 text-xs text-slate-400">Select this object to update workflow and object budget</p>
                    )}
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-slate-500 hover:text-red-600"
                    onClick={() => onDeleteObject(objectItem.id)}
                    aria-label={`Delete ${objectItem.name}`}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </li>
            );
          })}
        </ul>
      </CardContent>
    </Card>
  );
}
