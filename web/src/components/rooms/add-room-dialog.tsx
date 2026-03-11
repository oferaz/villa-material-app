"use client";

import { useEffect, useState } from "react";
import { RoomType } from "@/types";
import { roomTypeLabels } from "@/lib/mock/projects";
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
  onCreateRoom: (roomName: string, roomType: RoomType) => void;
}

const typeOptions = Object.entries(roomTypeLabels) as [RoomType, string][];

export function AddRoomDialog({ open, houseName, onOpenChange, onCreateRoom }: AddRoomDialogProps) {
  const [selectedType, setSelectedType] = useState<RoomType>("living_room");
  const [roomName, setRoomName] = useState("");

  useEffect(() => {
    if (open) {
      setSelectedType("living_room");
      setRoomName("Living Room");
      return;
    }
    setRoomName("");
  }, [open]);

  function handleCreate() {
    const trimmedName = roomName.trim();
    if (!trimmedName) {
      return;
    }
    onCreateRoom(trimmedName, selectedType);
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
                    if (!roomName.trim()) {
                      setRoomName(label);
                    }
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
