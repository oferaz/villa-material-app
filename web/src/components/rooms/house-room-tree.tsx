"use client";

import { useMemo, useState } from "react";
import { Check, ChevronDown, ChevronRight, Copy, Home, Pencil, Plus, X } from "lucide-react";
import { House, RoomType } from "@/types";
import { Sidebar } from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { getHouseColor } from "@/lib/ui/house-colors";
import { AddRoomDialog } from "@/components/rooms/add-room-dialog";
import { AddHouseDialog } from "@/components/rooms/add-house-dialog";

interface HouseRoomTreeProps {
  houses: House[];
  selectedHouseId: string;
  selectedRoomId: string;
  onSelectRoom: (houseId: string, roomId: string) => void;
  onRenameHouse: (houseId: string, nextName: string) => void;
  onRenameRoom: (roomId: string, nextName: string) => void;
  onAddHouse: (houseName: string, houseSizeSqm?: number) => void;
  onDuplicateHouse: (houseId: string, duplicateName?: string) => void;
  onAddRoom: (houseId: string, roomName: string, roomType: RoomType, roomSizeSqm?: number) => void;
}

type EditingTarget =
  | {
      kind: "house" | "room";
      id: string;
    }
  | null;

export function HouseRoomTree({
  houses,
  selectedHouseId,
  selectedRoomId,
  onSelectRoom,
  onRenameHouse,
  onRenameRoom,
  onAddHouse,
  onDuplicateHouse,
  onAddRoom,
}: HouseRoomTreeProps) {
  const [collapsedHouses, setCollapsedHouses] = useState<Record<string, boolean>>({});
  const [editingTarget, setEditingTarget] = useState<EditingTarget>(null);
  const [draftName, setDraftName] = useState("");
  const [roomDialogHouseId, setRoomDialogHouseId] = useState<string | null>(null);
  const [isAddHouseOpen, setIsAddHouseOpen] = useState(false);

  const selectedHouse = useMemo(() => {
    return houses.find((house) => house.id === selectedHouseId) ?? houses[0];
  }, [houses, selectedHouseId]);

  function toggleHouse(houseId: string) {
    setCollapsedHouses((prev) => ({ ...prev, [houseId]: !prev[houseId] }));
  }

  function startRenameHouse(houseId: string, currentName: string) {
    setEditingTarget({ kind: "house", id: houseId });
    setDraftName(currentName);
  }

  function startRenameRoom(roomId: string, currentName: string) {
    setEditingTarget({ kind: "room", id: roomId });
    setDraftName(currentName);
  }

  function cancelRename() {
    setEditingTarget(null);
    setDraftName("");
  }

  function saveRename() {
    const trimmedName = draftName.trim();
    if (!editingTarget || !trimmedName) {
      cancelRename();
      return;
    }

    if (editingTarget.kind === "house") {
      onRenameHouse(editingTarget.id, trimmedName);
    } else {
      onRenameRoom(editingTarget.id, trimmedName);
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
          <div className="flex items-center gap-2">
            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-500">{houses.length}</span>
            <Button type="button" variant="outline" size="sm" onClick={() => setIsAddHouseOpen(true)}>
              <Plus className="h-4 w-4" />
              Add house
            </Button>
          </div>
        </div>

        <div className="space-y-3">
          {houses.map((house, houseIndex) => {
            const isCollapsed = collapsedHouses[house.id] ?? false;
            const isHouseSelected = house.id === selectedHouseId;
            const isEditingHouse = editingTarget?.kind === "house" && editingTarget.id === house.id;
            const houseColor = getHouseColor(house.id, houseIndex);

            return (
              <section
                key={house.id}
                className={cn(
                  "rounded-xl border bg-slate-50/70 transition",
                  isHouseSelected ? `${houseColor.softBorder} ${houseColor.softBg} shadow-sm` : "border-slate-200"
                )}
              >
                <div className="flex items-center justify-between px-3 py-2">
                  {isEditingHouse ? (
                    <div className="flex min-w-0 flex-1 items-center gap-2">
                      <Input
                        autoFocus
                        value={draftName}
                        className="h-8"
                        onChange={(event) => setDraftName(event.target.value)}
                        onKeyDown={(event) => {
                          if (event.key === "Enter") {
                            event.preventDefault();
                            saveRename();
                          }
                          if (event.key === "Escape") {
                            event.preventDefault();
                            cancelRename();
                          }
                        }}
                      />
                      <Button type="button" variant="ghost" size="icon" className="h-7 w-7" onClick={saveRename}>
                        <Check className="h-3.5 w-3.5" />
                      </Button>
                      <Button type="button" variant="ghost" size="icon" className="h-7 w-7" onClick={cancelRename}>
                        <X className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  ) : (
                    <>
                      <button
                        type="button"
                        onClick={() => toggleHouse(house.id)}
                        className="flex min-w-0 items-center gap-2 text-left text-sm font-medium text-slate-800"
                      >
                        {isCollapsed ? (
                          <ChevronRight className="h-4 w-4 shrink-0 text-slate-500" />
                        ) : (
                          <ChevronDown className="h-4 w-4 shrink-0 text-slate-500" />
                        )}
                        <span className={cn("h-2.5 w-2.5 rounded-full", houseColor.dot)} />
                        <Home className="h-4 w-4 shrink-0 text-slate-500" />
                        <span className="truncate">{house.name}</span>
                      </button>
                      <div className="ml-2 flex items-center gap-1">
                        <span className="text-xs text-slate-500">
                          {house.sizeSqm ? `${house.sizeSqm} m2` : `${house.rooms.length} rooms`}
                        </span>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-slate-500"
                          onClick={(event) => {
                            event.stopPropagation();
                            startRenameHouse(house.id, house.name);
                          }}
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-slate-500"
                          onClick={(event) => {
                            event.stopPropagation();
                            const suggestedName = `${house.name} Copy`;
                            const requestedName = window.prompt("Duplicate house as:", suggestedName);
                            if (requestedName === null) {
                              return;
                            }
                            onDuplicateHouse(house.id, requestedName.trim() || suggestedName);
                          }}
                        >
                          <Copy className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </>
                  )}
                </div>

                {!isCollapsed ? (
                  <div className="space-y-2 border-t border-slate-200 px-2 pb-2 pt-2">
                    <ul className="space-y-1">
                      {house.rooms.map((room) => {
                        const isSelected = room.id === selectedRoomId;
                        const isEditingRoom = editingTarget?.kind === "room" && editingTarget.id === room.id;

                        return (
                          <li key={room.id}>
                            <div
                              className={cn(
                                "flex items-center gap-2 rounded-md border px-2 py-1.5 transition",
                                isSelected
                                  ? `${houseColor.softBorder} ${houseColor.softBg}`
                                  : "border-transparent bg-white hover:border-slate-200"
                              )}
                              onClick={() => onSelectRoom(house.id, room.id)}
                            >
                              {isEditingRoom ? (
                                <div className="flex min-w-0 flex-1 items-center gap-2">
                                  <Input
                                    autoFocus
                                    value={draftName}
                                    className="h-8"
                                    onChange={(event) => setDraftName(event.target.value)}
                                    onKeyDown={(event) => {
                                      if (event.key === "Enter") {
                                        event.preventDefault();
                                        saveRename();
                                      }
                                      if (event.key === "Escape") {
                                        event.preventDefault();
                                        cancelRename();
                                      }
                                    }}
                                  />
                                  <Button type="button" variant="ghost" size="icon" className="h-7 w-7" onClick={saveRename}>
                                    <Check className="h-3.5 w-3.5" />
                                  </Button>
                                  <Button type="button" variant="ghost" size="icon" className="h-7 w-7" onClick={cancelRename}>
                                    <X className="h-3.5 w-3.5" />
                                  </Button>
                                </div>
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
                                      startRenameRoom(room.id, room.name);
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

      <AddHouseDialog
        open={isAddHouseOpen}
        onOpenChange={setIsAddHouseOpen}
        onCreateHouse={(houseName, houseSizeSqm) => {
          onAddHouse(houseName, houseSizeSqm);
        }}
      />
    </>
  );
}
