"use client";

import { useMemo, useState } from "react";
import { ChevronDown, ChevronRight, Pencil, Plus, Home } from "lucide-react";
import { House, RoomType } from "@/types";
import { Sidebar } from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { AddRoomDialog } from "@/components/rooms/add-room-dialog";

interface HouseRoomTreeProps {
  houses: House[];
  selectedHouseId: string;
  selectedRoomId: string;
  onSelectRoom: (houseId: string, roomId: string) => void;
  onRenameRoom: (roomId: string, nextName: string) => void;
  onAddRoom: (houseId: string, roomName: string, roomType: RoomType, roomSizeSqm?: number) => void;
}

export function HouseRoomTree({
  houses,
  selectedHouseId,
  selectedRoomId,
  onSelectRoom,
  onRenameRoom,
  onAddRoom,
}: HouseRoomTreeProps) {
  const [collapsedHouses, setCollapsedHouses] = useState<Record<string, boolean>>({});
  const [editingRoomId, setEditingRoomId] = useState<string | null>(null);
  const [draftName, setDraftName] = useState("");
  const [roomDialogHouseId, setRoomDialogHouseId] = useState<string | null>(null);

  const selectedHouse = useMemo(() => {
    return houses.find((house) => house.id === selectedHouseId) ?? houses[0];
  }, [houses, selectedHouseId]);

  function toggleHouse(houseId: string) {
    setCollapsedHouses((prev) => ({ ...prev, [houseId]: !prev[houseId] }));
  }

  function startRename(roomId: string, currentName: string) {
    setEditingRoomId(roomId);
    setDraftName(currentName);
  }

  function cancelRename() {
    setEditingRoomId(null);
    setDraftName("");
  }

  function saveRename(roomId: string) {
    const trimmedName = draftName.trim();
    if (trimmedName) {
      onRenameRoom(roomId, trimmedName);
    }
    cancelRename();
  }

  return (
    <>
      <Sidebar className="h-full space-y-4 border-slate-200">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Project map</p>
            <h2 className="text-sm font-semibold text-slate-800">Houses and rooms</h2>
          </div>
          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-500">{houses.length}</span>
        </div>

        <div className="space-y-3">
          {houses.map((house) => {
            const isCollapsed = collapsedHouses[house.id] ?? false;
            const isHouseSelected = house.id === selectedHouseId;

            return (
              <section
                key={house.id}
                className={cn(
                  "rounded-xl border bg-slate-50/70 transition",
                  isHouseSelected ? "border-blue-200 shadow-sm" : "border-slate-200"
                )}
              >
                <div className="flex items-center justify-between px-3 py-2">
                  <button
                    type="button"
                    onClick={() => toggleHouse(house.id)}
                    className="flex items-center gap-2 text-left text-sm font-medium text-slate-800"
                  >
                    {isCollapsed ? <ChevronRight className="h-4 w-4 text-slate-500" /> : <ChevronDown className="h-4 w-4 text-slate-500" />}
                    <Home className="h-4 w-4 text-slate-500" />
                    <span>{house.name}</span>
                  </button>
                  <span className="text-xs text-slate-500">
                    {house.sizeSqm ? `${house.sizeSqm} m2` : `${house.rooms.length} rooms`}
                  </span>
                </div>

                {!isCollapsed ? (
                  <div className="space-y-2 border-t border-slate-200 px-2 pb-2 pt-2">
                    <ul className="space-y-1">
                      {house.rooms.map((room) => {
                        const isSelected = room.id === selectedRoomId;
                        const isEditing = room.id === editingRoomId;

                        return (
                          <li key={room.id}>
                            <div
                              className={cn(
                                "flex items-center gap-2 rounded-md border px-2 py-1.5 transition",
                                isSelected ? "border-blue-200 bg-blue-50" : "border-transparent bg-white hover:border-slate-200"
                              )}
                              onClick={() => onSelectRoom(house.id, room.id)}
                            >
                              {isEditing ? (
                                <Input
                                  autoFocus
                                  value={draftName}
                                  className="h-8"
                                  onChange={(event) => setDraftName(event.target.value)}
                                  onKeyDown={(event) => {
                                    if (event.key === "Enter") {
                                      event.preventDefault();
                                      saveRename(room.id);
                                    }
                                    if (event.key === "Escape") {
                                      event.preventDefault();
                                      cancelRename();
                                    }
                                  }}
                                  onBlur={() => saveRename(room.id)}
                                />
                              ) : (
                                <>
                                  <button
                                    type="button"
                                    className="min-w-0 flex-1 truncate text-left text-sm text-slate-700"
                                    onClick={(event) => {
                                      event.stopPropagation();
                                      onSelectRoom(house.id, room.id);
                                    }}
                                  >
                                    {room.name}
                                  </button>
                                  {room.sizeSqm ? <span className="text-[11px] text-slate-500">{room.sizeSqm} m2</span> : null}
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="icon"
                                    className="h-7 w-7 text-slate-500"
                                    onClick={(event) => {
                                      event.stopPropagation();
                                      onSelectRoom(house.id, room.id);
                                      startRename(room.id, room.name);
                                    }}
                                  >
                                    <Pencil className="h-3.5 w-3.5" />
                                  </Button>
                                </>
                              )}
                            </div>
                          </li>
                        );
                      })}
                    </ul>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="w-full justify-start text-slate-600 hover:text-slate-900"
                      onClick={() => setRoomDialogHouseId(house.id)}
                    >
                      <Plus className="mr-1.5 h-4 w-4" />
                      Add room
                    </Button>
                  </div>
                ) : null}
              </section>
            );
          })}
        </div>
      </Sidebar>

      <AddRoomDialog
        open={Boolean(roomDialogHouseId)}
        houseName={houses.find((house) => house.id === roomDialogHouseId)?.name ?? selectedHouse?.name ?? "house"}
        onOpenChange={(open) => {
          if (!open) {
            setRoomDialogHouseId(null);
          }
        }}
        onCreateRoom={(roomName, roomType, roomSizeSqm) => {
          const targetHouseId = roomDialogHouseId ?? selectedHouse?.id;
          if (!targetHouseId) {
            return;
          }
          onAddRoom(targetHouseId, roomName, roomType, roomSizeSqm);
        }}
      />
    </>
  );
}
