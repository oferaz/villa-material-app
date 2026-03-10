"use client";

import { useMemo, useState } from "react";
import { Check, Pencil, X } from "lucide-react";
import { House } from "@/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

interface HouseRoomTreeProps {
  houses: House[];
  selectedHouseId: string;
  selectedRoomId: string;
  onSelectRoom: (houseId: string, roomId: string) => void;
  onRenameRoom: (roomId: string, nextName: string) => void;
  searchQuery: string;
}

export function HouseRoomTree({
  houses,
  selectedHouseId,
  selectedRoomId,
  onSelectRoom,
  onRenameRoom,
  searchQuery,
}: HouseRoomTreeProps) {
  const [editingRoomId, setEditingRoomId] = useState<string | null>(null);
  const [draftName, setDraftName] = useState("");

  const filteredHouses = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) {
      return houses;
    }

    return houses
      .map((house) => ({
        ...house,
        rooms: house.rooms.filter((room) => room.name.toLowerCase().includes(q)),
      }))
      .filter((house) => house.rooms.length > 0 || house.name.toLowerCase().includes(q));
  }, [houses, searchQuery]);

  return (
    <div className="space-y-4">
      {filteredHouses.map((house) => (
        <section key={house.id}>
          <h3
            className={cn(
              "mb-2 text-sm font-semibold text-gray-700",
              selectedHouseId === house.id && "text-primary"
            )}
          >
            {house.name}
          </h3>
          <ul className="space-y-2">
            {house.rooms.map((room) => {
              const isSelected = selectedRoomId === room.id;
              const isEditing = editingRoomId === room.id;
              return (
                <li key={room.id} className="rounded-md border border-transparent px-2 py-1 hover:bg-muted">
                  {isEditing ? (
                    <div className="flex items-center gap-1">
                      <Input
                        value={draftName}
                        onChange={(event) => setDraftName(event.target.value)}
                        className="h-8"
                        autoFocus
                      />
                      <Button
                        variant="ghost"
                        className="h-8 w-8 p-0"
                        onClick={() => {
                          const trimmed = draftName.trim();
                          if (trimmed) {
                            onRenameRoom(room.id, trimmed);
                          }
                          setEditingRoomId(null);
                          setDraftName("");
                        }}
                        aria-label="Save room name"
                      >
                        <Check className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        className="h-8 w-8 p-0"
                        onClick={() => {
                          setEditingRoomId(null);
                          setDraftName("");
                        }}
                        aria-label="Cancel room name edit"
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  ) : (
                    <div className="flex items-center justify-between gap-2">
                      <button
                        className={cn(
                          "w-full truncate text-left text-sm",
                          isSelected ? "font-semibold text-primary" : "text-gray-700"
                        )}
                        onClick={() => onSelectRoom(house.id, room.id)}
                      >
                        {room.name}
                      </button>
                      <Button
                        variant="ghost"
                        className="h-8 w-8 p-0"
                        onClick={() => {
                          setEditingRoomId(room.id);
                          setDraftName(room.name);
                        }}
                        aria-label="Rename room"
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </div>
  );
}
