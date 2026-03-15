"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
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
  onCreateObject: (objectName: string, category: string, quantity: number, mode: "stack" | "separate") => void;
}

export function AddObjectDialog({ open, roomName, onOpenChange, onCreateObject }: AddObjectDialogProps) {
  const [objectName, setObjectName] = useState("");
  const [category, setCategory] = useState("Custom");
  const [quantity, setQuantity] = useState(1);
  const [mode, setMode] = useState<"stack" | "separate">("stack");

  useEffect(() => {
    if (!open) {
      setObjectName("");
      setCategory("Custom");
      setQuantity(1);
      setMode("stack");
    }
  }, [open]);

  function handleCreate() {
    const trimmedName = objectName.trim();
    const trimmedCategory = category.trim() || "Custom";
    const safeQuantity = Number.isFinite(quantity) ? Math.max(1, Math.min(50, Math.round(quantity))) : 1;
    if (!trimmedName) {
      return;
    }
    onCreateObject(trimmedName, trimmedCategory, safeQuantity, mode);
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

          <div className="space-y-1.5">
            <p className="text-sm font-medium text-slate-700">Quantity</p>
            <Input
              type="number"
              min={1}
              max={50}
              value={quantity}
              onChange={(event) => setQuantity(Number(event.target.value))}
            />
          </div>

          <div className="space-y-2">
            <p className="text-sm font-medium text-slate-700">Add mode</p>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setMode("stack")}
                className={cn(
                  "rounded-md border px-3 py-2 text-left text-sm transition",
                  mode === "stack"
                    ? "border-primary bg-blue-50 text-primary"
                    : "border-slate-200 bg-white text-slate-700 hover:border-slate-300"
                )}
              >
                Stack same type
              </button>
              <button
                type="button"
                onClick={() => setMode("separate")}
                className={cn(
                  "rounded-md border px-3 py-2 text-left text-sm transition",
                  mode === "separate"
                    ? "border-primary bg-blue-50 text-primary"
                    : "border-slate-200 bg-white text-slate-700 hover:border-slate-300"
                )}
              >
                Add separate items
              </button>
            </div>
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
