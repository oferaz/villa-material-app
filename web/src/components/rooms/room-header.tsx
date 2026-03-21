import { House, Room, RoomBudget } from "@/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCurrencyAmount } from "@/lib/currency";
import { getBudgetHealthLabel, getBudgetHealthStatus, getBudgetHealthVariant } from "@/lib/mock/budget";
import { roomTypeLabels } from "@/lib/mock/projects";
import { cn } from "@/lib/utils";

interface RoomHeaderProps {
  house?: House;
  room?: Room;
  roomBudget?: RoomBudget;
  projectCurrency: string;
  selectedCount: number;
  missingCount: number;
  isAssignedFilterActive?: boolean;
  isMissingFilterActive?: boolean;
  onToggleAssignedFilter?: () => void;
  onToggleMissingFilter?: () => void;
}

function formatRemainingAmount(roomBudget?: RoomBudget, projectCurrency = "USD"): string {
  if (!roomBudget || roomBudget.totalBudget === null || roomBudget.remainingAmount === null) {
    return "Not planned";
  }
  return formatCurrencyAmount(roomBudget.remainingAmount, projectCurrency);
}

export function RoomHeader({
  house,
  room,
  roomBudget,
  projectCurrency,
  selectedCount,
  missingCount,
  isAssignedFilterActive = false,
  isMissingFilterActive = false,
  onToggleAssignedFilter,
  onToggleMissingFilter,
}: RoomHeaderProps) {
  if (!house || !room) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Select a room</CardTitle>
        </CardHeader>
      </Card>
    );
  }

  const roomBudgetHealth = getBudgetHealthStatus(roomBudget?.totalBudget, roomBudget?.remainingAmount);

  return (
    <Card className="border-slate-200 shadow-sm">
      <CardHeader className="pb-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{house.name}</p>
            <CardTitle className="mt-1 text-2xl">{room.name}</CardTitle>
            <p className="mt-1 text-xs text-slate-500">
              {room.sizeSqm ? `Room size: ${room.sizeSqm} m2` : "Room size: not set"}
              {house.sizeSqm ? ` | House size: ${house.sizeSqm} m2` : ""}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant={getBudgetHealthVariant(roomBudgetHealth)}>{`Budget: ${getBudgetHealthLabel(roomBudgetHealth)}`}</Badge>
            <Badge variant="secondary">{roomTypeLabels[room.type]}</Badge>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3 pt-0">
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Budget plan</p>
            <p className="mt-1 text-sm font-semibold text-slate-900">
              {roomBudget?.totalBudget === null || roomBudget?.totalBudget === undefined
                ? "Not planned"
                : formatCurrencyAmount(roomBudget.totalBudget, projectCurrency)}
            </p>
          </div>
          <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Allocated</p>
            <p className="mt-1 text-sm font-semibold text-slate-900">
              {formatCurrencyAmount(roomBudget?.allocatedAmount ?? 0, projectCurrency)}
            </p>
          </div>
          <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Remaining</p>
            <p
              className={cn(
                "mt-1 text-sm font-semibold",
                roomBudgetHealth === "over_budget" ? "text-red-700" : "text-slate-900"
              )}
            >
              {formatRemainingAmount(roomBudget, projectCurrency)}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            size="sm"
            variant="outline"
            className={cn(
              "h-7 border-emerald-200 bg-emerald-50 px-2 text-xs font-semibold text-emerald-700 hover:bg-emerald-100",
              isAssignedFilterActive ? "ring-2 ring-emerald-500 ring-offset-1" : ""
            )}
            disabled={selectedCount === 0 || !onToggleAssignedFilter}
            onClick={onToggleAssignedFilter}
            title="Toggle assigned filter"
            aria-pressed={isAssignedFilterActive}
          >
            {selectedCount} assigned
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            className={cn(
              "h-7 border-rose-200 bg-rose-50 px-2 text-xs font-semibold text-rose-700 hover:bg-rose-100",
              isMissingFilterActive ? "ring-2 ring-rose-500 ring-offset-1" : ""
            )}
            disabled={missingCount === 0 || !onToggleMissingFilter}
            onClick={onToggleMissingFilter}
            title="Toggle missing filter"
            aria-pressed={isMissingFilterActive}
          >
            {missingCount} without material
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
