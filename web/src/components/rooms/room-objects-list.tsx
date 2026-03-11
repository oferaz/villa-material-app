import { Trash2 } from "lucide-react";
import { Room, getObjectStatus } from "@/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface RoomObjectsListProps {
  room?: Room;
  selectedObjectId: string;
  onSelectObject: (objectId: string) => void;
  onDeleteObject: (objectId: string) => void;
}

export function RoomObjectsList({
  room,
  selectedObjectId,
  onSelectObject,
  onDeleteObject,
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

  return (
    <Card className="border-slate-200 shadow-sm">
      <CardHeader className="pb-3">
        <div>
          <CardTitle className="text-base">Room objects</CardTitle>
          <CardDescription>{room.objects.length} objects in scope</CardDescription>
        </div>
      </CardHeader>
      <CardContent>
        <ul className="space-y-2">
          {room.objects.map((objectItem) => {
            const status = getObjectStatus(objectItem);
            const isSelected = selectedObjectId === objectItem.id;
            return (
              <li key={objectItem.id}>
                <div
                  className={cn(
                    "flex items-center gap-2 rounded-lg border px-3 py-2 transition",
                    isSelected ? "border-primary bg-blue-50 shadow-sm" : "border-slate-200 bg-white"
                  )}
                >
                  <button type="button" className="min-w-0 flex-1 text-left" onClick={() => onSelectObject(objectItem.id)}>
                    <p className="truncate text-sm font-medium text-slate-800">{objectItem.name}</p>
                    <p className="text-xs text-slate-500">{objectItem.category}</p>
                  </button>
                  <Badge variant={status === "selected" ? "success" : "danger"}>{status}</Badge>
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
