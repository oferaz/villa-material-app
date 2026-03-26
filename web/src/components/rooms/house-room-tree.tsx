"use client";

import { DragEvent, useState } from "react";
import { Check, ChevronDown, ChevronRight, Copy, GripVertical, Home, Pencil, Plus, X } from "lucide-react";
import { House } from "@/types";
import { Sidebar } from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { getHouseColor } from "@/lib/ui/house-colors";
import { AddHouseDialog } from "@/components/rooms/add-house-dialog";
import { reorderListItem } from "@/lib/ordering";

interface HouseRoomTreeProps {
  houses: House[];
  selectedHouseId: string;
  selectedRoomId: string;
  onSelectRoom: (houseId: string, roomId: string) => void;
  onRenameHouse: (houseId: string, nextName: string) => void;
  onRenameRoom: (roomId: string, nextName: string) => void;
  onAddHouse: (houseName: string, houseSizeSqm?: number) => void;
  onDuplicateHouse: (houseId: string, duplicateName?: string) => void;
  onRequestAddRoom: (houseId: string) => void;
  onReorderRoom: (houseId: string, orderedRoomIds: string[]) => void;
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
  onRequestAddRoom,
  onReorderRoom,
}: HouseRoomTreeProps) {
  const [collapsedHouses, setCollapsedHouses] = useState<Record<string, boolean>>({});
  const [editingTarget, setEditingTarget] = useState<EditingTarget>(null);
  const [draftName, setDraftName] = useState("");
  const [isAddHouseOpen, setIsAddHouseOpen] = useState(false);
  const [draggingRoom, setDraggingRoom] = useState<{ houseId: string; roomId: string } | null>(null);
  const [dragOverRoom, setDragOverRoom] = useState<{ houseId: string; roomId: string } | null>(null);

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

  function handleRoomDragStart(houseId: string, roomId: string) {
    if (editingTarget) {
      return;
    }

    setDraggingRoom({ houseId, roomId });
    setDragOverRoom({ houseId, roomId });
  }

  function handleRoomDragOver(event: DragEvent<HTMLLIElement>, houseId: string, roomId: string) {
    if (!draggingRoom || draggingRoom.houseId !== houseId || draggingRoom.roomId === roomId) {
      return;
    }

    event.preventDefault();
    if (event.dataTransfer) {
      event.dataTransfer.dropEffect = "move";
    }
    setDragOverRoom({ houseId, roomId });
  }

  function handleRoomDrop(house: House, targetRoomId: string) {
    if (!draggingRoom || draggingRoom.houseId !== house.id || draggingRoom.roomId === targetRoomId) {
      setDraggingRoom(null);
      setDragOverRoom(null);
      return;
    }

    const sourceIndex = house.rooms.findIndex((room) => room.id === draggingRoom.roomId);
    const targetIndex = house.rooms.findIndex((room) => room.id === targetRoomId);
    const nextRooms = reorderListItem(house.rooms, sourceIndex, targetIndex);

    if (nextRooms !== house.rooms) {
      onReorderRoom(house.id, nextRooms.map((room) => room.id));
    }

    setDraggingRoom(null);
    setDragOverRoom(null);
  }

  function clearRoomDragState() {
    setDraggingRoom(null);
    setDragOverRoom(null);
  }

  return (
    <>
      <Sidebar className="min-h-full space-y-4 border-slate-200">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Project map</p>
            <h2 className="text-sm font-semibold text-slate-800">Houses and rooms</h2>
          </div>
          <div className="flex items-center gap-2">
            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-500">{houses.length}</span>
            <Button
              type="button"
              size="sm"
              className="border-blue-600 bg-blue-600 px-2 text-xs text-white hover:border-blue-700 hover:bg-blue-700 sm:px-3 sm:text-sm"
              onClick={() => setIsAddHouseOpen(true)}
            >
              <Plus className="h-4 w-4" />
              <span className="sm:hidden">Add</span>
              <span className="hidden sm:inline">Add house</span>
            </Button>
          </div>
        </div>

        {houses.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-3 py-4 text-sm text-slate-600">
            <p className="font-medium text-slate-800">No houses in this project yet.</p>
            <p className="mt-1 text-xs text-slate-500">Add the first house to create a clear room structure and start organizing products.</p>
          </div>
        ) : null}

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
                  "rounded-xl border transition",
                  `${houseColor.softBorder} ${houseColor.softBg}`,
                  isHouseSelected ? "shadow-sm ring-1 ring-slate-200" : ""
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
                    {house.rooms.length === 0 ? (
                      <div className="rounded-lg border border-dashed border-slate-200 bg-white px-3 py-3 text-xs text-slate-600">
                        <p className="font-medium text-slate-800">No rooms in {house.name} yet.</p>
                        <p className="mt-1 text-slate-500">Add the first room to start searching products and building the layout.</p>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          className="mt-3 h-7 px-2 text-[11px]"
                          onClick={() => onRequestAddRoom(house.id)}
                        >
                          <Plus className="mr-1.5 h-3.5 w-3.5" />
                          Add first room
                        </Button>
                      </div>
                    ) : (
                      <ul className="space-y-1">
                        {house.rooms.map((room) => {
                          const isSelected = room.id === selectedRoomId;
                          const isEditingRoom = editingTarget?.kind === "room" && editingTarget.id === room.id;
                          const isDragging = draggingRoom?.houseId === house.id && draggingRoom.roomId === room.id;
                          const isDropTarget = dragOverRoom?.houseId === house.id && dragOverRoom.roomId === room.id && !isDragging;

                          return (
                            <li
                              key={room.id}
                              draggable={!isEditingRoom}
                              onDragStart={(event) => {
                                if (event.dataTransfer) {
                                  event.dataTransfer.effectAllowed = "move";
                                  event.dataTransfer.setData("text/plain", room.id);
                                }
                                handleRoomDragStart(house.id, room.id);
                              }}
                              onDragOver={(event) => handleRoomDragOver(event, house.id, room.id)}
                              onDrop={(event) => {
                                event.preventDefault();
                                handleRoomDrop(house, room.id);
                              }}
                              onDragEnd={clearRoomDragState}
                              className={cn("rounded-md", isDragging ? "opacity-65" : "")}
                              data-room-id={room.id}
                            >
                              <div
                                className={cn(
                                  "flex items-center gap-2 rounded-md border-y border-r border-l-4 px-2 py-1.5 transition",
                                  isSelected
                                    ? `${houseColor.softBorder} ${houseColor.softBg}`
                                    : "border-r-slate-200 border-y-slate-200 bg-white hover:bg-slate-50",
                                  houseColor.roomRail,
                                  isDropTarget ? "border-blue-300 bg-blue-50 shadow-sm" : ""
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
                                      className="inline-flex min-w-0 flex-1 items-center gap-2 truncate text-left text-sm text-slate-700"
                                      onClick={(event) => {
                                        event.stopPropagation();
                                        onSelectRoom(house.id, room.id);
                                      }}
                                    >
                                      <GripVertical className="h-3.5 w-3.5 shrink-0 text-slate-400" aria-hidden="true" />
                                      <span className={cn("h-1.5 w-1.5 shrink-0 rounded-full", houseColor.dot)} />
                                      <span className="truncate">{room.name}</span>
                                    </button>
                                    {isSelected ? (
                                      <span className="rounded-full bg-white/80 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-600">
                                        Selected
                                      </span>
                                    ) : null}
                                    <span className="text-[11px] text-slate-500">{room.objects.length} items</span>
                                    <div className="flex items-center gap-0.5">
                                      <span className="hidden text-[10px] text-slate-400 lg:inline">Drag to reorder</span>
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
                                    </div>
                                  </>
                                )}
                              </div>
                            </li>
                          );
                        })}
                      </ul>
                    )}
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="w-full justify-start text-slate-600 hover:text-slate-900"
                      onClick={() => onRequestAddRoom(house.id)}
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
