import { Trash2 } from "lucide-react";
import { Room, RoomBudget, getObjectWorkflowStage, getWorkflowStageLabel } from "@/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface RoomObjectsListProps {
  room?: Room;
  selectedObjectId: string;
  showWorkflowHints: boolean;
  overBudgetObjectIds?: string[];
  roomBudget?: RoomBudget;
  onSelectObject: (objectId: string) => void;
  onDeleteObject: (objectId: string) => void;
  onUpdateWorkflow: (
    objectId: string,
    patch: { poApproved?: boolean; ordered?: boolean; installed?: boolean }
  ) => void;
}

function formatMoney(value: number | null | undefined): string {
  if (value === null || value === undefined) {
    return "Not set";
  }
  return `${Math.round(value).toLocaleString()} THB`;
}

export function RoomObjectsList({
  room,
  selectedObjectId,
  showWorkflowHints,
  overBudgetObjectIds = [],
  roomBudget,
  onSelectObject,
  onDeleteObject,
  onUpdateWorkflow,
}: RoomObjectsListProps) {
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
  const isRoomOverBudget = typeof roomBudget?.remainingAmount === "number" && roomBudget.remainingAmount < 0;

  return (
    <Card className="border-slate-200 shadow-sm">
      <CardHeader className="pb-3">
        <div>
          <CardTitle className="text-base">Room objects</CardTitle>
          <CardDescription>
            {room.objects.reduce((acc, objectItem) => acc + Math.max(1, objectItem.quantity), 0)} total items
          </CardDescription>
          {typeof roomBudget?.totalBudget === "number" ? (
            <p className={cn("mt-2 text-xs", isRoomOverBudget ? "font-medium text-red-700" : "text-slate-500")}>
              Room budget: {formatMoney(roomBudget.totalBudget)}
              {typeof roomBudget.remainingAmount === "number"
                ? isRoomOverBudget
                  ? `, over by ${formatMoney(Math.abs(roomBudget.remainingAmount))}`
                  : `, ${formatMoney(roomBudget.remainingAmount)} remaining`
                : ""}
            </p>
          ) : null}
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

            return (
              <li key={objectItem.id} data-room-object-id={objectItem.id}>
                <div
                  className={cn(
                    "flex items-start gap-2 rounded-lg border px-3 py-2 transition",
                    isPushingRoomOverBudget
                      ? "border-red-300 bg-red-50/70"
                      : hasMaterial
                        ? "border-emerald-200 bg-emerald-50/40"
                        : "border-rose-200 bg-rose-50/40",
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
                      <Badge variant="outline">{getWorkflowStageLabel(workflowStage)}</Badge>
                      {hasMaterial ? <Badge variant="success">Assigned</Badge> : <Badge variant="danger">Missing</Badge>}
                      {isPushingRoomOverBudget ? <Badge variant="danger">Over room target</Badge> : null}
                    </div>

                    <p
                      className={cn(
                        "mt-1 text-xs",
                        isPushingRoomOverBudget ? "text-red-700" : hasMaterial ? "text-emerald-700" : "text-rose-700"
                      )}
                    >
                      {hasMaterial
                        ? `Selected material: ${selectedMaterialName || "Assigned material"}`
                        : "No material selected yet. Tap to assign."}
                    </p>
                    {isPushingRoomOverBudget ? (
                      <p className="mt-1 text-xs font-medium text-red-700">
                        This object is contributing to the room going over budget.
                      </p>
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
                      <p className="mt-2 text-xs text-slate-400">Select this object to update workflow</p>
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

