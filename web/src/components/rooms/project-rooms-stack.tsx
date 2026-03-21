import { House, RoomBudget, WorkflowStage, getObjectStatus } from "@/types";
import { RoomHeader } from "@/components/rooms/room-header";
import { SuggestedObjects } from "@/components/rooms/suggested-objects";
import { RoomObjectsList } from "@/components/rooms/room-objects-list";
import { WorkflowOverview } from "@/components/workflow/workflow-overview";
import { cn } from "@/lib/utils";
import { getHouseColor } from "@/lib/ui/house-colors";
import { summarizeWorkflowForHouse, summarizeWorkflowForRoom } from "@/lib/workflow/summary";

interface ProjectRoomsStackProps {
  houses: House[];
  selectedRoomId: string;
  selectedObjectId: string;
  showWorkflowHints: boolean;
  selectedStages: WorkflowStage[];
  projectCurrency: string;
  onToggleStageFilter: (stage: WorkflowStage) => void;
  onAddSuggestion: (roomId: string, objectName: string, category: string, basePrice: number, quantity?: number) => void;
  onDecreaseSuggestion: (roomId: string, objectName: string, category: string) => void;
  onSelectObject: (houseId: string, roomId: string, objectId: string) => void;
  onDeleteObject: (roomId: string, objectId: string) => void;
  onUpdateWorkflow: (
    objectId: string,
    patch: { poApproved?: boolean; ordered?: boolean; installed?: boolean }
  ) => void;
  overBudgetObjectIdsByRoomId: Record<string, string[]>;
  roomBudgetByRoomId: RoomBudget[];
  onOpenAddCustomObject: (roomId: string) => void;
}

export function ProjectRoomsStack({
  houses,
  selectedRoomId,
  selectedObjectId,
  showWorkflowHints,
  selectedStages,
  projectCurrency,
  onToggleStageFilter,
  onAddSuggestion,
  onDecreaseSuggestion,
  onSelectObject,
  onDeleteObject,
  onUpdateWorkflow,
  overBudgetObjectIdsByRoomId,
  roomBudgetByRoomId,
  onOpenAddCustomObject,
}: ProjectRoomsStackProps) {
  return (
    <div className="space-y-5">
      {houses.map((house, houseIndex) => {
        const houseColor = getHouseColor(house.id, houseIndex);
        const houseWorkflowSummary = summarizeWorkflowForHouse(house);
        return (
          <section key={house.id} className="space-y-3">
            <div className={cn("rounded-lg border px-3 py-2", houseColor.softBorder, houseColor.softBg)}>
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">House</p>
              <h3 className={cn("inline-flex items-center gap-1.5 text-base font-semibold", houseColor.strongText)}>
                <span className={cn("h-2 w-2 rounded-full", houseColor.dot)} />
                {house.name}
              </h3>
              {house.sizeSqm ? <p className="text-xs text-slate-500">{house.sizeSqm} m2</p> : null}
            </div>
            <WorkflowOverview title={`${house.name} progress`} summary={houseWorkflowSummary} compact />

            {house.rooms.map((room) => {
              const roomWorkflowSummary = summarizeWorkflowForRoom(room);
              const selectedObjects = room.objects.filter((obj) => getObjectStatus(obj) === "selected");
              const selectedCount = selectedObjects.reduce((acc, obj) => acc + Math.max(1, obj.quantity), 0);

              const missingObjects = room.objects.filter((obj) => getObjectStatus(obj) === "missing");
              const missingCount = missingObjects.reduce((acc, obj) => acc + Math.max(1, obj.quantity), 0);

              const isRoomSelected = room.id === selectedRoomId;
              const roomBudget = roomBudgetByRoomId.find((item) => item.roomId === room.id);

              return (
                <div
                  key={room.id}
                  id={`room-section-${room.id}`}
                  data-room-section="true"
                  data-house-id={house.id}
                  data-room-id={room.id}
                  className={cn(
                    "scroll-mt-28 space-y-2.5 rounded-xl border-y border-r border-l-4 p-2.5 transition sm:p-3",
                    isRoomSelected ? `${houseColor.softBorder} ${houseColor.softBg} shadow-sm` : "border-slate-200 bg-white",
                    houseColor.roomRail
                  )}
                >
                  <RoomHeader
                    house={house}
                    room={room}
                    roomBudget={roomBudget}
                    projectCurrency={projectCurrency}
                    selectedCount={selectedCount}
                    missingCount={missingCount}
                    isAssignedFilterActive={selectedStages.includes("material_assigned")}
                    isMissingFilterActive={selectedStages.includes("material_missing")}
                    onToggleAssignedFilter={() => onToggleStageFilter("material_assigned")}
                    onToggleMissingFilter={() => onToggleStageFilter("material_missing")}
                  />
                  {showWorkflowHints || isRoomSelected ? (
                    <WorkflowOverview title={`${room.name} progress`} summary={roomWorkflowSummary} compact />
                  ) : null}
                  <SuggestedObjects
                    room={room}
                    onAddSuggestion={(objectName, category, basePrice, quantity = 1) =>
                      onAddSuggestion(room.id, objectName, category, basePrice, quantity)
                    }
                    onDecreaseSuggestion={(objectName, category) => onDecreaseSuggestion(room.id, objectName, category)}
                    onOpenAddCustomObject={() => onOpenAddCustomObject(room.id)}
                  />
                  <RoomObjectsList
                    room={room}
                    selectedObjectId={selectedObjectId}
                    showWorkflowHints={showWorkflowHints}
                    overBudgetObjectIds={overBudgetObjectIdsByRoomId[room.id] ?? []}
                    roomBudget={roomBudget}
                    projectCurrency={projectCurrency}
                    onSelectObject={(objectId) => onSelectObject(house.id, room.id, objectId)}
                    onDeleteObject={(objectId) => onDeleteObject(room.id, objectId)}
                    onUpdateWorkflow={onUpdateWorkflow}
                  />
                </div>
              );
            })}
          </section>
        );
      })}
    </div>
  );
}
