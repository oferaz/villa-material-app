"use client";

import { useMemo } from "react";
import { Room } from "@/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface RoomObjectsPanelProps {
  room: Room | undefined;
  selectedObjectId: string;
  onSelectObject: (objectId: string) => void;
  searchQuery: string;
}

export function RoomObjectsPanel({
  room,
  selectedObjectId,
  onSelectObject,
  searchQuery,
}: RoomObjectsPanelProps) {
  const objects = useMemo(() => {
    if (!room) {
      return [];
    }
    const q = searchQuery.trim().toLowerCase();
    if (!q) {
      return room.objects;
    }
    return room.objects.filter((obj) => {
      return (
        obj.name.toLowerCase().includes(q) ||
        obj.category.toLowerCase().includes(q) ||
        obj.productOptions.some((opt) => opt.title.toLowerCase().includes(q) || opt.supplier.toLowerCase().includes(q))
      );
    });
  }, [room, searchQuery]);

  if (!room) {
    return (
      <Card className="h-full">
        <CardHeader>
          <CardTitle>Room Objects</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-gray-500">Select a room to view its objects.</CardContent>
      </Card>
    );
  }

  return (
    <Card className="h-full">
      <CardHeader>
        <CardTitle>{room.name} Objects</CardTitle>
      </CardHeader>
      <CardContent>
        <ul className="space-y-3">
          {objects.map((obj) => (
            <li key={obj.id}>
              <button
                className={cn(
                  "w-full rounded-md border border-border p-3 text-left hover:bg-muted",
                  selectedObjectId === obj.id && "border-primary bg-blue-50"
                )}
                onClick={() => onSelectObject(obj.id)}
              >
                <div className="flex items-center justify-between text-sm">
                  <span className="font-medium">{obj.name}</span>
                  <span className="text-gray-500">x{obj.quantity}</span>
                </div>
                <p className="mt-1 text-xs text-gray-500">{obj.category}</p>
                <p className="mt-2 text-xs text-gray-600">{obj.productOptions.length} product option(s)</p>
              </button>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}
