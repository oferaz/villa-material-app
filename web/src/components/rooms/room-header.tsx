import { House, Room } from "@/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { roomTypeLabels } from "@/lib/mock/projects";

interface RoomHeaderProps {
  house?: House;
  room?: Room;
  selectedCount: number;
  missingCount: number;
  onJumpToSelected?: () => void;
  onJumpToMissing?: () => void;
}

export function RoomHeader({
  house,
  room,
  selectedCount,
  missingCount,
  onJumpToSelected,
  onJumpToMissing,
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
          <Badge variant="secondary">{roomTypeLabels[room.type]}</Badge>
        </div>
      </CardHeader>
      <CardContent className="flex flex-wrap items-center gap-2 pt-0">
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="h-7 border-emerald-200 bg-emerald-50 px-2 text-xs font-semibold text-emerald-700 hover:bg-emerald-100"
          disabled={selectedCount === 0 || !onJumpToSelected}
          onClick={onJumpToSelected}
          title="Jump to first assigned object"
        >
          {selectedCount} selected
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="h-7 border-rose-200 bg-rose-50 px-2 text-xs font-semibold text-rose-700 hover:bg-rose-100"
          disabled={missingCount === 0 || !onJumpToMissing}
          onClick={onJumpToMissing}
          title="Jump to first missing object"
        >
          {missingCount} missing
        </Button>
      </CardContent>
    </Card>
  );
}
