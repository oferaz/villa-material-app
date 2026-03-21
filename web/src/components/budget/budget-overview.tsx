"use client";

import { type KeyboardEvent, useEffect, useMemo, useState } from "react";
import {
  BudgetCategoryName,
  Project,
  ProjectBudget,
  RoomObject,
  WorkflowStage,
  getObjectWorkflowStage,
  getWorkflowStageLabel,
} from "@/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { buildCategoryBudgetMap, budgetCategoryOrder } from "@/lib/mock/budget";

export type BudgetFocusSelection =
  | { kind: "room"; label: string; roomId: string; houseId: string }
  | { kind: "house"; label: string; houseId: string }
  | { kind: "category"; label: string; category: string }
  | { kind: "provider"; label: string; provider: string }
  | { kind: "workflow"; label: string; stage: WorkflowStage };

type BudgetBreakdownFocusSelection = Exclude<BudgetFocusSelection, { kind: "workflow" }>;

interface SaveBudgetPayload {
  totalBudget: number;
  categoryBudgets: Record<BudgetCategoryName, number>;
  houseBudgets: Record<string, number>;
  roomBudgets: Record<string, number | null>;
}

interface BudgetOverviewProps {
  project: Project;
  budget: ProjectBudget;
  onSaveBudget: (payload: SaveBudgetPayload) => void;
  onSelectFocus?: (selection: BudgetFocusSelection) => void;
}

type BudgetViewMode = "room" | "house" | "category" | "provider";

interface BudgetLineItem {
  houseId: string;
  houseName: string;
  roomId: string;
  roomName: string;
  quantity: number;
  allocatedAmount: number;
  budgetCategory: string;
  provider: string;
  assigned: boolean;
  workflowStage: WorkflowStage;
}

interface BudgetPlanSummary {
  plannedBudget: number | null;
  remainingAmount: number | null;
  varianceAmount: number | null;
}

interface BudgetBreakdownItem {
  key: string;
  label: string;
  secondaryLabel?: string;
  allocatedAmount: number;
  objectCount: number;
  totalQuantity: number;
  assignedCount: number;
  missingCount: number;
  focusSelection: BudgetBreakdownFocusSelection;
  plan: BudgetPlanSummary;
}

interface WorkflowBudgetItem {
  stage: WorkflowStage;
  label: string;
  allocatedAmount: number;
  objectCount: number;
  totalQuantity: number;
  focusSelection: Extract<BudgetFocusSelection, { kind: "workflow" }>;
}

const workflowStageOrder: WorkflowStage[] = [
  "material_missing",
  "material_assigned",
  "po_approved",
  "ordered",
  "installed",
];

const currencyFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
});

function formatCurrency(value: number): string {
  return currencyFormatter.format(value);
}

function formatInteger(value: number): string {
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(value);
}

function sanitizeNumber(value: string): number {
  const parsed = Number(value.replace(/[^0-9.-]/g, ""));
  if (!Number.isFinite(parsed)) {
    return 0;
  }
  return Math.max(0, Math.round(parsed));
}

function sumInputValues(values: Record<string, string>): number {
  return Object.values(values).reduce((sum, value) => {
    if (!value.trim()) {
      return sum;
    }
    return sum + sanitizeNumber(value);
  }, 0);
}

function getSelectedProduct(roomObject: RoomObject) {
  if (!roomObject.selectedProductId) {
    return undefined;
  }
  return roomObject.productOptions.find((item) => item.id === roomObject.selectedProductId);
}

function buildBudgetLineItems(project: Project): BudgetLineItem[] {
  return project.houses.flatMap((house) =>
    house.rooms.flatMap((room) =>
      room.objects.map((objectItem) => {
        const selectedProduct = getSelectedProduct(objectItem);
        const quantity = Math.max(1, objectItem.quantity || 1);
        return {
          houseId: house.id,
          houseName: house.name,
          roomId: room.id,
          roomName: room.name,
          quantity,
          allocatedAmount: Math.max(0, (selectedProduct?.price ?? 0) * quantity),
          budgetCategory: selectedProduct?.budgetCategory ?? "Unassigned",
          provider: selectedProduct?.supplier?.trim() || "Unassigned",
          assigned: Boolean(selectedProduct),
          workflowStage: getObjectWorkflowStage(objectItem),
        };
      })
    )
  );
}

function buildBudgetBreakdown(
  lineItems: BudgetLineItem[],
  mode: BudgetViewMode,
  hasMultipleHouses: boolean,
  categoryPlanMap: Map<string, BudgetPlanSummary>,
  housePlanMap: Map<string, BudgetPlanSummary>,
  roomPlanMap: Map<string, BudgetPlanSummary>
): BudgetBreakdownItem[] {
  const groups = new Map<string, Omit<BudgetBreakdownItem, "plan">>();

  for (const item of lineItems) {
    let key = "";
    let label = "";
    let secondaryLabel: string | undefined;
    let focusSelection: BudgetBreakdownFocusSelection;

    switch (mode) {
      case "room":
        key = item.roomId;
        label = item.roomName;
        secondaryLabel = hasMultipleHouses ? item.houseName : undefined;
        focusSelection = {
          kind: "room",
          label: hasMultipleHouses ? `${item.roomName} (${item.houseName})` : item.roomName,
          roomId: item.roomId,
          houseId: item.houseId,
        };
        break;
      case "house":
        key = item.houseId;
        label = item.houseName;
        focusSelection = {
          kind: "house",
          label: item.houseName,
          houseId: item.houseId,
        };
        break;
      case "category":
        key = item.budgetCategory;
        label = item.budgetCategory;
        focusSelection = {
          kind: "category",
          label: item.budgetCategory,
          category: item.budgetCategory,
        };
        break;
      case "provider":
        key = item.provider;
        label = item.provider;
        focusSelection = {
          kind: "provider",
          label: item.provider,
          provider: item.provider,
        };
        break;
      default:
        key = item.roomId;
        label = item.roomName;
        focusSelection = {
          kind: "room",
          label: item.roomName,
          roomId: item.roomId,
          houseId: item.houseId,
        };
    }

    const current = groups.get(key) ?? {
      key,
      label,
      secondaryLabel,
      allocatedAmount: 0,
      objectCount: 0,
      totalQuantity: 0,
      assignedCount: 0,
      missingCount: 0,
      focusSelection,
    };

    current.allocatedAmount += item.allocatedAmount;
    current.objectCount += 1;
    current.totalQuantity += item.quantity;
    current.assignedCount += item.assigned ? 1 : 0;
    current.missingCount += item.assigned ? 0 : 1;

    groups.set(key, current);
  }

  const planMap =
    mode === "category"
      ? categoryPlanMap
      : mode === "house"
        ? housePlanMap
        : mode === "room"
          ? roomPlanMap
          : new Map<string, BudgetPlanSummary>();

  return Array.from(groups.values())
    .map((item) => ({
      ...item,
      plan: planMap.get(item.key) ?? { plannedBudget: null, remainingAmount: null, varianceAmount: null },
    }))
    .sort((a, b) => {
      if (b.allocatedAmount !== a.allocatedAmount) {
        return b.allocatedAmount - a.allocatedAmount;
      }
      if (b.assignedCount !== a.assignedCount) {
        return b.assignedCount - a.assignedCount;
      }
      return a.label.localeCompare(b.label);
    });
}

function handleCardActivation(event: KeyboardEvent<HTMLDivElement>, onActivate?: () => void) {
  if (!onActivate) {
    return;
  }
  if (event.key !== "Enter" && event.key !== " ") {
    return;
  }
  event.preventDefault();
  onActivate();
}

function buildWorkflowBudgetBreakdown(lineItems: BudgetLineItem[]): WorkflowBudgetItem[] {
  return workflowStageOrder.map((stage) => {
    const label = getWorkflowStageLabel(stage);
    const matchingItems = lineItems.filter((item) => item.workflowStage === stage);
    return {
      stage,
      label,
      allocatedAmount: matchingItems.reduce((sum, item) => sum + item.allocatedAmount, 0),
      objectCount: matchingItems.length,
      totalQuantity: matchingItems.reduce((sum, item) => sum + item.quantity, 0),
      focusSelection: {
        kind: "workflow",
        label,
        stage,
      },
    };
  });
}

function createBudgetPlanMap(
  items: Array<{ key: string; totalBudget: number | null; allocatedAmount: number; remainingAmount: number | null }>
) {
  return new Map<string, BudgetPlanSummary>(
    items.map((item) => [
      item.key,
      {
        plannedBudget: item.totalBudget,
        remainingAmount: item.remainingAmount,
        varianceAmount: item.totalBudget === null ? null : item.allocatedAmount - item.totalBudget,
      },
    ])
  );
}

function getPlanBadgeLabel(plan: BudgetPlanSummary): string {
  if (plan.plannedBudget === null) {
    return "Optional";
  }
  if (plan.varianceAmount !== null && plan.varianceAmount > 0) {
    return "Over";
  }
  return "On plan";
}

function getPlanBadgeVariant(plan: BudgetPlanSummary): "outline" | "success" | "danger" {
  if (plan.plannedBudget === null) {
    return "outline";
  }
  if (plan.varianceAmount !== null && plan.varianceAmount > 0) {
    return "danger";
  }
  return "success";
}

export function BudgetOverview({ project, budget, onSaveBudget, onSelectFocus }: BudgetOverviewProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [budgetView, setBudgetView] = useState<BudgetViewMode>("category");
  const [totalBudgetInput, setTotalBudgetInput] = useState("");
  const [categoryInputs, setCategoryInputs] = useState<Record<BudgetCategoryName, string>>(
    {} as Record<BudgetCategoryName, string>
  );
  const [houseInputs, setHouseInputs] = useState<Record<string, string>>({});
  const [roomInputs, setRoomInputs] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    setTotalBudgetInput(String(budget.totalBudget));

    const nextCategoryInputs = budgetCategoryOrder.reduce<Record<BudgetCategoryName, string>>((acc, categoryName) => {
      const category = budget.categories.find((item) => item.name === categoryName);
      acc[categoryName] = String(category?.totalBudget ?? 0);
      return acc;
    }, {} as Record<BudgetCategoryName, string>);
    setCategoryInputs(nextCategoryInputs);

    const nextHouseInputs = budget.houses.reduce<Record<string, string>>((acc, house) => {
      acc[house.houseId] = String(house.totalBudget);
      return acc;
    }, {});
    setHouseInputs(nextHouseInputs);

    const nextRoomInputs = budget.rooms.reduce<Record<string, string>>((acc, room) => {
      acc[room.roomId] = room.totalBudget === null ? "" : String(room.totalBudget);
      return acc;
    }, {});
    setRoomInputs(nextRoomInputs);
  }, [isOpen, budget]);

  const categoryBudgetMap = useMemo(() => buildCategoryBudgetMap(budget.categories), [budget.categories]);
  const lineItems = useMemo(() => buildBudgetLineItems(project), [project]);
  const categoryPlanMap = useMemo(
    () => createBudgetPlanMap(budget.categories.map((item) => ({ key: item.name, ...item }))),
    [budget.categories]
  );
  const housePlanMap = useMemo(
    () => createBudgetPlanMap(budget.houses.map((item) => ({ key: item.houseId, ...item }))),
    [budget.houses]
  );
  const roomPlanMap = useMemo(
    () => createBudgetPlanMap(budget.rooms.map((item) => ({ key: item.roomId, ...item }))),
    [budget.rooms]
  );
  const breakdownItems = useMemo(
    () =>
      buildBudgetBreakdown(
        lineItems,
        budgetView,
        project.houses.length > 1,
        categoryPlanMap,
        housePlanMap,
        roomPlanMap
      ),
    [budgetView, categoryPlanMap, housePlanMap, lineItems, project.houses.length, roomPlanMap]
  );
  const workflowBreakdown = useMemo(() => buildWorkflowBudgetBreakdown(lineItems), [lineItems]);

  const budgetSnapshot = useMemo(() => {
    const assignedObjects = lineItems.filter((item) => item.assigned).length;
    const missingObjects = lineItems.length - assignedObjects;
    const activeProviders = new Set(
      lineItems.filter((item) => item.assigned && item.provider !== "Unassigned").map((item) => item.provider)
    ).size;
    const plannedPercent = budget.totalBudget > 0 ? (budget.allocatedAmount / budget.totalBudget) * 100 : 0;

    return {
      assignedObjects,
      missingObjects,
      activeProviders,
      plannedPercent,
      varianceAmount: budget.allocatedAmount - budget.totalBudget,
    };
  }, [budget.allocatedAmount, budget.totalBudget, lineItems]);

  const budgetInputSummary = useMemo(() => {
    return {
      categoryTotal: sumInputValues(categoryInputs),
      houseTotal: sumInputValues(houseInputs),
      roomTotal: sumInputValues(roomInputs),
    };
  }, [categoryInputs, houseInputs, roomInputs]);

  function handleSave() {
    const categoryBudgets = budgetCategoryOrder.reduce<Record<BudgetCategoryName, number>>((acc, categoryName) => {
      acc[categoryName] = sanitizeNumber(categoryInputs[categoryName] ?? "0");
      return acc;
    }, {} as Record<BudgetCategoryName, number>);

    const houseBudgets = project.houses.reduce<Record<string, number>>((acc, house) => {
      acc[house.id] = sanitizeNumber(houseInputs[house.id] ?? "0");
      return acc;
    }, {});

    const roomBudgets = project.houses.reduce<Record<string, number | null>>((acc, house) => {
      house.rooms.forEach((room) => {
        const rawValue = roomInputs[room.id] ?? "";
        acc[room.id] = rawValue.trim() ? sanitizeNumber(rawValue) : null;
      });
      return acc;
    }, {});

    onSaveBudget({
      totalBudget: sanitizeNumber(totalBudgetInput),
      categoryBudgets,
      houseBudgets,
      roomBudgets,
    });
    setIsOpen(false);
  }

  return (
    <div className="space-y-4">
      <Card className="border-slate-200 shadow-sm">
        <CardHeader className="flex flex-row items-start justify-between gap-3">
          <div>
            <CardTitle>Project Budget Overview</CardTitle>
            <CardDescription>
              Plan budget at project, house, material type, and optional room level, then compare it against what is already allocated.
            </CardDescription>
          </div>
          <Button type="button" variant="outline" onClick={() => setIsOpen(true)}>
            Edit Budget
          </Button>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Total Budget</p>
            <p className="mt-1 text-xl font-semibold text-slate-900">{formatCurrency(budget.totalBudget)}</p>
          </div>
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Allocated</p>
            <p className="mt-1 text-xl font-semibold text-slate-900">{formatCurrency(budget.allocatedAmount)}</p>
          </div>
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Remaining</p>
            <p className="mt-1 text-xl font-semibold text-slate-900">{formatCurrency(budget.remainingAmount)}</p>
          </div>
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Assigned Objects</p>
            <p className="mt-1 text-xl font-semibold text-slate-900">{formatInteger(budgetSnapshot.assignedObjects)}</p>
          </div>
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Missing Objects</p>
            <p className="mt-1 text-xl font-semibold text-slate-900">{formatInteger(budgetSnapshot.missingObjects)}</p>
          </div>
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Active Providers</p>
            <p className="mt-1 text-xl font-semibold text-slate-900">{formatInteger(budgetSnapshot.activeProviders)}</p>
          </div>
        </CardContent>
      </Card>

      <Card className="border-slate-200 shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle>Planned vs actual</CardTitle>
          <CardDescription>
            Compare the working project budget against what is already allocated to selected materials.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 md:grid-cols-3">
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Planned</p>
              <p className="mt-1 text-xl font-semibold text-slate-900">{formatCurrency(budget.totalBudget)}</p>
            </div>
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Actual allocated</p>
              <p className="mt-1 text-xl font-semibold text-slate-900">{formatCurrency(budget.allocatedAmount)}</p>
            </div>
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Variance</p>
              <p
                className={`mt-1 text-xl font-semibold ${
                  budgetSnapshot.varianceAmount > 0 ? "text-red-600" : "text-emerald-700"
                }`}
              >
                {formatCurrency(budgetSnapshot.varianceAmount)}
              </p>
            </div>
          </div>
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm text-slate-600">
              <span>Budget usage</span>
              <span className="font-medium text-slate-800">{Math.round(budgetSnapshot.plannedPercent)}%</span>
            </div>
            <Progress
              value={budgetSnapshot.plannedPercent}
              indicatorClassName={budgetSnapshot.varianceAmount > 0 ? "bg-red-500" : "bg-emerald-500"}
            />
          </div>
        </CardContent>
      </Card>

      <Card className="border-slate-200 shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle>Execution status</CardTitle>
          <CardDescription>
            See how much budget is sitting in each workflow stage right now, then click a stage to focus those
            objects in Rooms.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-5">
          {workflowBreakdown.map((item) => {
            const handleFocus = onSelectFocus ? () => onSelectFocus(item.focusSelection) : undefined;
            return (
              <div
                key={item.stage}
                role={handleFocus ? "button" : undefined}
                tabIndex={handleFocus ? 0 : undefined}
                className={`min-w-0 rounded-lg border border-slate-200 bg-white p-3 ${
                  handleFocus ? "cursor-pointer transition hover:border-slate-300 hover:shadow-sm" : ""
                }`}
                onClick={handleFocus}
                onKeyDown={handleFocus ? (event) => handleCardActivation(event, handleFocus) : undefined}
              >
                <div className="flex items-start justify-between gap-3">
                  <p className="min-w-0 text-sm font-semibold text-slate-900">{item.label}</p>
                  <Badge variant={item.stage === "material_missing" ? "danger" : "outline"}>
                    {formatInteger(item.objectCount)}
                  </Badge>
                </div>
                <p className="mt-3 min-w-0 text-base font-semibold leading-tight text-slate-900 [overflow-wrap:anywhere] sm:text-lg">
                  {formatCurrency(item.allocatedAmount)}
                </p>
                <p className="mt-1 min-w-0 text-xs text-slate-500 [overflow-wrap:anywhere]">
                  Qty {formatInteger(item.totalQuantity)}
                </p>
              </div>
            );
          })}
        </CardContent>
      </Card>

      <Card className="border-slate-200 shadow-sm">
        <CardHeader className="space-y-3">
          <div>
            <CardTitle>Budget breakdowns</CardTitle>
            <CardDescription>
              Switch between material type, house, room, and provider. Budgeted views show planned, allocated, and remaining side by side.
            </CardDescription>
          </div>
          <div className="flex flex-wrap gap-2">
            {([
              ["category", "By material type"],
              ["room", "By room"],
              ["house", "By house"],
              ["provider", "By provider"],
            ] as const).map(([value, label]) => (
              <Button
                key={value}
                type="button"
                size="sm"
                variant={budgetView === value ? "default" : "outline"}
                onClick={() => setBudgetView(value)}
              >
                {label}
              </Button>
            ))}
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {breakdownItems.map((item) => {
              const share = budget.allocatedAmount > 0 ? (item.allocatedAmount / budget.allocatedAmount) * 100 : 0;
              const hasPlannedBudget = item.plan.plannedBudget !== null;
              const handleFocus = onSelectFocus ? () => onSelectFocus(item.focusSelection) : undefined;
              return (
                <Card
                  key={item.key}
                  role={handleFocus ? "button" : undefined}
                  tabIndex={handleFocus ? 0 : undefined}
                  className={`border-slate-200 shadow-none ${
                    handleFocus ? "cursor-pointer transition hover:border-slate-300 hover:shadow-sm" : ""
                  }`}
                  onClick={handleFocus}
                  onKeyDown={handleFocus ? (event) => handleCardActivation(event, handleFocus) : undefined}
                >
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <CardTitle className="text-base">{item.label}</CardTitle>
                        {item.secondaryLabel ? <CardDescription className="mt-1">{item.secondaryLabel}</CardDescription> : null}
                      </div>
                      <Badge
                        variant={
                          budgetView === "provider"
                            ? item.missingCount > 0
                              ? "danger"
                              : "success"
                            : getPlanBadgeVariant(item.plan)
                        }
                      >
                        {budgetView === "provider" ? `${Math.round(share)}%` : getPlanBadgeLabel(item.plan)}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className={`grid gap-3 ${hasPlannedBudget ? "sm:grid-cols-3" : "sm:grid-cols-2"}`}>
                      {hasPlannedBudget ? (
                        <div>
                          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Planned</p>
                          <p className="mt-1 text-lg font-semibold text-slate-900">{formatCurrency(item.plan.plannedBudget ?? 0)}</p>
                        </div>
                      ) : null}
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Allocated</p>
                        <p className="mt-1 text-lg font-semibold text-slate-900">{formatCurrency(item.allocatedAmount)}</p>
                      </div>
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                          {hasPlannedBudget ? "Remaining" : "Room budget"}
                        </p>
                        <p
                          className={`mt-1 text-lg font-semibold ${
                            hasPlannedBudget && (item.plan.varianceAmount ?? 0) > 0 ? "text-red-600" : "text-slate-900"
                          }`}
                        >
                          {hasPlannedBudget
                            ? formatCurrency(item.plan.remainingAmount ?? 0)
                            : budgetView === "room"
                              ? "Not set"
                              : "Actual only"}
                        </p>
                      </div>
                    </div>
                    <div className="space-y-1 text-sm text-slate-600">
                      <div className="flex items-center justify-between">
                        <span>Objects</span>
                        <span className="font-medium text-slate-800">{formatInteger(item.objectCount)}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span>Total quantity</span>
                        <span className="font-medium text-slate-800">{formatInteger(item.totalQuantity)}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span>Assigned / missing</span>
                        <span className="font-medium text-slate-800">
                          {formatInteger(item.assignedCount)} / {formatInteger(item.missingCount)}
                        </span>
                      </div>
                    </div>
                    <Progress value={share} indicatorClassName={item.missingCount > 0 ? "bg-amber-500" : "bg-emerald-500"} />
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </CardContent>
      </Card>

      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="max-h-[85vh] max-w-4xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit budget</DialogTitle>
            <DialogDescription>
              Set total project budget, split it by house and material type, and optionally add room-level budgets.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-5">
            <div className="space-y-1.5">
              <p className="text-sm font-medium text-slate-700">Total project budget</p>
              <Input value={totalBudgetInput} onChange={(event) => setTotalBudgetInput(event.target.value)} />
            </div>

            <div className="grid gap-3 md:grid-cols-3">
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">House budgets total</p>
                <p className="mt-1 text-lg font-semibold text-slate-900">{formatCurrency(budgetInputSummary.houseTotal)}</p>
              </div>
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Category budgets total</p>
                <p className="mt-1 text-lg font-semibold text-slate-900">{formatCurrency(budgetInputSummary.categoryTotal)}</p>
              </div>
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Optional room budgets total</p>
                <p className="mt-1 text-lg font-semibold text-slate-900">{formatCurrency(budgetInputSummary.roomTotal)}</p>
              </div>
            </div>

            <div className="space-y-3">
              <div>
                <p className="text-sm font-medium text-slate-700">Budget by house</p>
                <p className="text-xs text-slate-500">Set a planned budget for each house. These budgets are part of the main plan.</p>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                {budget.houses.map((house) => (
                  <div key={house.houseId} className="space-y-1.5">
                    <div className="flex items-center justify-between gap-3 text-sm">
                      <p className="font-medium text-slate-700">{house.houseName}</p>
                      <span className="text-xs text-slate-500">Allocated {formatCurrency(house.allocatedAmount)}</span>
                    </div>
                    <Input
                      value={houseInputs[house.houseId] ?? String(house.totalBudget)}
                      onChange={(event) =>
                        setHouseInputs((prev) => ({
                          ...prev,
                          [house.houseId]: event.target.value,
                        }))
                      }
                    />
                  </div>
                ))}
              </div>
            </div>

            <div className="space-y-3">
              <div>
                <p className="text-sm font-medium text-slate-700">Budget by material type</p>
                <p className="text-xs text-slate-500">These category budgets stay project-wide and work alongside house budgets.</p>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                {budgetCategoryOrder.map((categoryName) => {
                  const category = budget.categories.find((item) => item.name === categoryName);
                  return (
                    <div key={categoryName} className="space-y-1.5">
                      <div className="flex items-center justify-between gap-3 text-sm">
                        <p className="font-medium text-slate-700">{categoryName}</p>
                        <span className="text-xs text-slate-500">Allocated {formatCurrency(category?.allocatedAmount ?? 0)}</span>
                      </div>
                      <Input
                        value={categoryInputs[categoryName] ?? String(categoryBudgetMap[categoryName] ?? 0)}
                        onChange={(event) =>
                          setCategoryInputs((prev) => ({
                            ...prev,
                            [categoryName]: event.target.value,
                          }))
                        }
                      />
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="space-y-3">
              <div>
                <p className="text-sm font-medium text-slate-700">Room budgets (optional)</p>
                <p className="text-xs text-slate-500">Leave a room blank to rely on the project, house, and material-type budgets instead.</p>
              </div>
              <div className="space-y-4">
                {project.houses.map((house) => (
                  <div key={house.id} className="rounded-lg border border-slate-200 p-3">
                    <p className="text-sm font-semibold text-slate-800">{house.name}</p>
                    <div className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                      {house.rooms.map((room) => {
                        const roomBudget = budget.rooms.find((item) => item.roomId === room.id);
                        return (
                          <div key={room.id} className="space-y-1.5">
                            <div className="flex items-center justify-between gap-3 text-sm">
                              <p className="font-medium text-slate-700">{room.name}</p>
                              <span className="text-xs text-slate-500">Allocated {formatCurrency(roomBudget?.allocatedAmount ?? 0)}</span>
                            </div>
                            <Input
                              placeholder="Optional"
                              value={roomInputs[room.id] ?? ""}
                              onChange={(event) =>
                                setRoomInputs((prev) => ({
                                  ...prev,
                                  [room.id]: event.target.value,
                                }))
                              }
                            />
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => setIsOpen(false)}>
              Cancel
            </Button>
            <Button type="button" onClick={handleSave}>
              Save budget
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

