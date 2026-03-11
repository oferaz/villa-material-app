import { House, Room } from "@/types";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { roomTypeLabels } from "@/lib/mock/projects";

interface RoomHeaderProps {
  house?: House;
  room?: Room;
  selectedCount: number;
  missingCount: number;
}

export function RoomHeader({ house, room, selectedCount, missingCount }: RoomHeaderProps) {
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
          </div>
          <Badge variant="secondary">{roomTypeLabels[room.type]}</Badge>
        </div>
      </CardHeader>
      <CardContent className="flex flex-wrap items-center gap-2 pt-0">
        <Badge variant="success">{selectedCount} selected</Badge>
        <Badge variant="danger">{missingCount} missing</Badge>
      </CardContent>
    </Card>
  );
}
