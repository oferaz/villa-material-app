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

interface AddObjectDialogProps {
  open: boolean;
  roomName: string;
  onOpenChange: (open: boolean) => void;
  onCreateObject: (objectName: string, category: string) => void;
}

export function AddObjectDialog({ open, roomName, onOpenChange, onCreateObject }: AddObjectDialogProps) {
  const [objectName, setObjectName] = useState("");
  const [category, setCategory] = useState("Custom");

  useEffect(() => {
    if (!open) {
      setObjectName("");
      setCategory("Custom");
    }
  }, [open]);

  function handleCreate() {
    const trimmedName = objectName.trim();
    const trimmedCategory = category.trim() || "Custom";
    if (!trimmedName) {
      return;
    }
    onCreateObject(trimmedName, trimmedCategory);
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Add custom object</DialogTitle>
          <DialogDescription>Create a custom object in {roomName}.</DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="space-y-1.5">
            <p className="text-sm font-medium text-slate-700">Object name</p>
            <Input
              autoFocus
              placeholder="Example: Feature wall"
              value={objectName}
              onChange={(event) => setObjectName(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  handleCreate();
                }
              }}
            />
          </div>

          <div className="space-y-1.5">
            <p className="text-sm font-medium text-slate-700">Category</p>
            <Input placeholder="Example: Finishes" value={category} onChange={(event) => setCategory(event.target.value)} />
          </div>
        </div>

        <DialogFooter>
          <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button type="button" onClick={handleCreate} disabled={!objectName.trim()}>
            Add object
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
