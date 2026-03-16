"use client";

import { useEffect, useState } from "react";
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

interface AddHouseDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreateHouse: (houseName: string, houseSizeSqm?: number) => void;
}

export function AddHouseDialog({ open, onOpenChange, onCreateHouse }: AddHouseDialogProps) {
  const [houseName, setHouseName] = useState("");
  const [houseSizeSqmInput, setHouseSizeSqmInput] = useState("");

  useEffect(() => {
    if (open) {
      setHouseName("");
      setHouseSizeSqmInput("");
      return;
    }
    setHouseName("");
    setHouseSizeSqmInput("");
  }, [open]);

  function handleCreate() {
    const normalizedName = houseName.trim();
    if (!normalizedName) {
      return;
    }

    const rawSize = Number(houseSizeSqmInput);
    const normalizedSize = Number.isFinite(rawSize) && rawSize > 0 ? Math.round(rawSize * 100) / 100 : undefined;
    onCreateHouse(normalizedName, normalizedSize);
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Add house</DialogTitle>
          <DialogDescription>Create a new house with default starter rooms.</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <label className="block space-y-1">
            <span className="text-sm font-medium text-slate-700">House name</span>
            <Input
              autoFocus
              placeholder="Main Villa"
              value={houseName}
              onChange={(event) => setHouseName(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  handleCreate();
                }
              }}
            />
          </label>

          <label className="block space-y-1">
            <span className="text-sm font-medium text-slate-700">House size (m2)</span>
            <Input
              type="number"
              min={0}
              step="0.1"
              placeholder="Optional"
              value={houseSizeSqmInput}
              onChange={(event) => setHouseSizeSqmInput(event.target.value)}
            />
          </label>
        </div>

        <DialogFooter>
          <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button type="button" onClick={handleCreate} disabled={!houseName.trim()}>
            Create house
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

