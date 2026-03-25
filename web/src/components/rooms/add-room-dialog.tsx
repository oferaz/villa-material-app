"use client";

import { useEffect, useMemo, useState } from "react";
import { RoomType } from "@/types";
import { getRoomStarterTemplate, roomTypeLabels } from "@/lib/mock/projects";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

interface AddRoomDialogProps {
  open: boolean;
  houseName: string;
  onOpenChange: (open: boolean) => void;
  onCreateRoom: (input: AddRoomDialogCreateInput) => void;
}

export interface AddRoomDialogCreateInput {
  roomName: string;
  roomType: RoomType;
  roomSizeSqm?: number;
  useStarterTemplate: boolean;
}

const typeOptions = Object.entries(roomTypeLabels) as [RoomType, string][];

export function AddRoomDialog({ open, houseName, onOpenChange, onCreateRoom }: AddRoomDialogProps) {
  const [selectedType, setSelectedType] = useState<RoomType>("living_room");
  const [roomName, setRoomName] = useState("");
  const [roomSizeSqmInput, setRoomSizeSqmInput] = useState("");
  const [useStarterTemplate, setUseStarterTemplate] = useState(true);

  useEffect(() => {
    if (open) {
      setSelectedType("living_room");
      setRoomName("Living Room");
      setRoomSizeSqmInput("");
      setUseStarterTemplate(true);
      return;
    }
    setRoomName("");
    setRoomSizeSqmInput("");
  }, [open]);

  const starterItems = useMemo(() => getRoomStarterTemplate(selectedType), [selectedType]);

  function handleCreate() {
    const trimmedName = roomName.trim();
    if (!trimmedName) {
      return;
    }
    const rawSize = Number(roomSizeSqmInput);
    const normalizedSize = Number.isFinite(rawSize) && rawSize > 0 ? Math.round(rawSize * 100) / 100 : undefined;
    onCreateRoom({
      roomName: trimmedName,
      roomType: selectedType,
      roomSizeSqm: normalizedSize,
      useStarterTemplate,
    });
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>Add room</DialogTitle>
          <DialogDescription>Create a new room under {houseName}.</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <p className="text-sm font-medium text-slate-700">Room type</p>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {typeOptions.map(([type, label]) => (
                <button
                  key={type}
                  type="button"
                  onClick={() => {
                    setSelectedType(type);
                    setRoomName(label);
                  }}
                  className={cn(
                    "rounded-md border px-3 py-2 text-left text-sm transition",
                    selectedType === type
                      ? "border-primary bg-blue-50 text-primary"
                      : "border-slate-200 bg-white text-slate-700 hover:border-slate-300"
                  )}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <p className="text-sm font-medium text-slate-700">Room name</p>
            <Input
              autoFocus
              placeholder="Enter room name"
              value={roomName}
              onChange={(event) => setRoomName(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  handleCreate();
                }
              }}
            />
          </div>

          <div className="space-y-2">
            <p className="text-sm font-medium text-slate-700">Room size (m2)</p>
            <Input
              type="number"
              min={0}
              step="0.1"
              placeholder="Optional"
              value={roomSizeSqmInput}
              onChange={(event) => setRoomSizeSqmInput(event.target.value)}
            />
          </div>

          <div className="space-y-3 rounded-lg border border-slate-200 bg-slate-50 p-3">
            <div>
              <p className="text-sm font-medium text-slate-700">Starting structure</p>
              <p className="mt-1 text-xs text-slate-500">Choose a fast starter setup or begin with a blank room.</p>
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
              <button
                type="button"
                onClick={() => setUseStarterTemplate(true)}
                className={cn(
                  "rounded-lg border px-3 py-3 text-left transition",
                  useStarterTemplate
                    ? "border-blue-300 bg-white text-slate-900 shadow-sm"
                    : "border-slate-200 bg-white/70 text-slate-700 hover:border-slate-300"
                )}
              >
                <p className="text-sm font-semibold">Use starter items</p>
                <p className="mt-1 text-xs text-slate-500">
                  Start with {starterItems.length} suggested items for a {roomTypeLabels[selectedType].toLowerCase()}.
                </p>
              </button>
              <button
                type="button"
                onClick={() => setUseStarterTemplate(false)}
                className={cn(
                  "rounded-lg border px-3 py-3 text-left transition",
                  !useStarterTemplate
                    ? "border-blue-300 bg-white text-slate-900 shadow-sm"
                    : "border-slate-200 bg-white/70 text-slate-700 hover:border-slate-300"
                )}
              >
                <p className="text-sm font-semibold">Start blank</p>
                <p className="mt-1 text-xs text-slate-500">
                  Create the room first, then search products, paste links, or add custom items when ready.
                </p>
              </button>
            </div>
            {useStarterTemplate && starterItems.length > 0 ? (
              <div className="rounded-lg border border-slate-200 bg-white p-3">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Starter preview</p>
                <p className="mt-1 text-xs text-slate-500">
                  These items are optional and can be reordered or removed later.
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {starterItems.map((item) => (
                    <span key={item.name} className="rounded-full border border-slate-200 bg-slate-50 px-2 py-1 text-[11px] text-slate-700">
                      {item.name}
                    </span>
                  ))}
                </div>
              </div>
            ) : null}
          </div>
        </div>

        <DialogFooter>
          <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button type="button" onClick={handleCreate} disabled={!roomName.trim()}>
            Create room
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
