import { House, getObjectStatus } from "@/types";
import { RoomHeader } from "@/components/rooms/room-header";
import { SuggestedObjects } from "@/components/rooms/suggested-objects";
import { RoomObjectsList } from "@/components/rooms/room-objects-list";
import { cn } from "@/lib/utils";

interface ProjectRoomsStackProps {
  houses: House[];
  selectedRoomId: string;
  selectedObjectId: string;
  onAddSuggestion: (roomId: string, objectName: string, category: string, basePrice: number) => void;
  onSelectObject: (houseId: string, roomId: string, objectId: string) => void;
  onDeleteObject: (roomId: string, objectId: string) => void;
  onOpenAddCustomObject: (roomId: string) => void;
}

export function ProjectRoomsStack({
  houses,
  selectedRoomId,
  selectedObjectId,
  onAddSuggestion,
  onSelectObject,
  onDeleteObject,
  onOpenAddCustomObject,
}: ProjectRoomsStackProps) {
  return (
    <div className="space-y-6">
      {houses.map((house) => (
        <section key={house.id} className="space-y-4">
          <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">House</p>
            <h3 className="text-lg font-semibold text-slate-800">{house.name}</h3>
          </div>

          {house.rooms.map((room) => {
            const selectedCount = room.objects.filter((obj) => getObjectStatus(obj) === "selected").length;
            const missingCount = room.objects.length - selectedCount;
            const isRoomSelected = room.id === selectedRoomId;

            return (
              <div
                key={room.id}
                id={`room-section-${room.id}`}
                data-room-section="true"
                data-house-id={house.id}
                data-room-id={room.id}
                className={cn(
                  "scroll-mt-28 space-y-3 rounded-2xl border p-3 transition sm:p-4",
                  isRoomSelected ? "border-primary bg-blue-50/40 shadow-sm" : "border-slate-200 bg-white"
                )}
              >
                <RoomHeader house={house} room={room} selectedCount={selectedCount} missingCount={missingCount} />
                <SuggestedObjects
                  room={room}
                  onAddSuggestion={(objectName, category, basePrice) =>
                    onAddSuggestion(room.id, objectName, category, basePrice)
                  }
                  onOpenAddCustomObject={() => onOpenAddCustomObject(room.id)}
                />
                <RoomObjectsList
                  room={room}
                  selectedObjectId={selectedObjectId}
                  onSelectObject={(objectId) => onSelectObject(house.id, room.id, objectId)}
                  onDeleteObject={(objectId) => onDeleteObject(room.id, objectId)}
                />
              </div>
            );
          })}
        </section>
      ))}
    </div>
  );
}
