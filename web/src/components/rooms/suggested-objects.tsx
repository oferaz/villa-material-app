import { useEffect, useMemo, useState } from "react";
import { ChevronDown, ChevronRight, Minus, Plus } from "lucide-react";
import { Room } from "@/types";
import { getSuggestedObjectsForRoomType } from "@/lib/mock/projects";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface SuggestedObjectsProps {
  room?: Room;
  onAddSuggestion: (objectName: string, category: string, basePrice: number, quantity?: number) => void;
  onDecreaseSuggestion: (objectName: string, category: string) => void;
  onOpenAddCustomObject: () => void;
}

export function SuggestedObjects({
  room,
  onAddSuggestion,
  onDecreaseSuggestion,
  onOpenAddCustomObject,
}: SuggestedObjectsProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const roomId = room?.id;
  const roomObjectCount = room?.objects.length ?? 0;

  useEffect(() => {
    if (!roomId) {
      return;
    }

    setIsExpanded(roomObjectCount === 0);
  }, [roomId, roomObjectCount]);

  const suggestions = useMemo(() => {
    if (!room) {
      return [];
    }

    return getSuggestedObjectsForRoomType(room.type);
  }, [room]);

  if (!room) {
    return null;
  }

  const existingCountsByName = room.objects.reduce<Record<string, number>>((acc, item) => {
    const key = item.name.trim().toLowerCase();
    acc[key] = (acc[key] ?? 0) + Math.max(1, item.quantity);
    return acc;
  }, {});
  const populatedSuggestionCount = suggestions.filter(
    (suggestion) => (existingCountsByName[suggestion.name.trim().toLowerCase()] ?? 0) > 0
  ).length;
  const previewSuggestions = suggestions.slice(0, 4);
  const summaryText =
    room.objects.length === 0
      ? "Starter ideas are ready for this new room."
      : `${populatedSuggestionCount} of ${suggestions.length} starter objects already used in this room.`;

  return (
    <Card className="border-slate-200 shadow-sm">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-3">
          <div>
            <CardTitle className="text-base">Suggested objects</CardTitle>
            <CardDescription>
              Keep starter structure nearby without letting it take over the room page.
            </CardDescription>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-8 px-2 text-slate-600"
            onClick={() => setIsExpanded((current) => !current)}
            aria-expanded={isExpanded}
            aria-label={isExpanded ? "Collapse suggested objects" : "Expand suggested objects"}
          >
            {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
            <span>{isExpanded ? "Hide" : "Show"}</span>
          </Button>
        </div>
        <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5">
          <div className="flex flex-wrap items-center gap-2 text-xs text-slate-600">
            <Badge variant={room.objects.length === 0 ? "secondary" : "outline"}>
              {room.objects.length === 0 ? "Recommended for new room" : `${suggestions.length} starter ideas`}
            </Badge>
            <span>{summaryText}</span>
          </div>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {previewSuggestions.map((suggestion) => {
              const quantityCount = existingCountsByName[suggestion.name.trim().toLowerCase()] ?? 0;
              return (
                <span
                  key={suggestion.name}
                  className={cn(
                    "rounded-full border px-2 py-1 text-[11px]",
                    quantityCount > 0
                      ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                      : "border-slate-200 bg-white text-slate-600"
                  )}
                >
                  {suggestion.name}
                  {quantityCount > 0 ? ` (${quantityCount})` : ""}
                </span>
              );
            })}
            {suggestions.length > previewSuggestions.length ? (
              <span className="rounded-full border border-slate-200 bg-white px-2 py-1 text-[11px] text-slate-500">
                +{suggestions.length - previewSuggestions.length} more
              </span>
            ) : null}
          </div>
        </div>
      </CardHeader>
      {isExpanded ? (
        <CardContent className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
          {suggestions.map((suggestion) => {
            const quantityCount = existingCountsByName[suggestion.name.trim().toLowerCase()] ?? 0;
            return (
              <div
                key={suggestion.name}
                className="flex items-start justify-between gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2"
              >
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-slate-800">{suggestion.name}</p>
                  <p className="text-xs text-slate-500">{suggestion.category}</p>

                  <div className="mt-2 flex flex-wrap items-center gap-1.5">
                    <span className="text-[11px] font-medium uppercase tracking-wide text-slate-500">In room</span>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="h-7 px-2"
                      onClick={() => onDecreaseSuggestion(suggestion.name, suggestion.category)}
                      disabled={quantityCount <= 0}
                      aria-label={`Decrease room quantity for ${suggestion.name}`}
                    >
                      <Minus className="h-3.5 w-3.5" />
                    </Button>
                    <Badge variant="outline" className="h-7 min-w-8 justify-center px-2 text-xs">
                      {quantityCount}
                    </Badge>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="h-7 px-2"
                      onClick={() => onAddSuggestion(suggestion.name, suggestion.category, suggestion.basePrice, 1)}
                      aria-label={`Increase room quantity for ${suggestion.name}`}
                    >
                      <Plus className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              </div>
            );
          })}
          <button
            type="button"
            onClick={onOpenAddCustomObject}
            className="flex items-center justify-between rounded-lg border border-dashed border-slate-300 bg-slate-50 px-3 py-2 text-left transition hover:border-slate-400 hover:bg-white"
          >
            <div>
              <p className="text-sm font-medium text-slate-800">Add custom object</p>
              <p className="text-xs text-slate-500">Create a custom item for this room</p>
            </div>
            <Plus className="h-4 w-4 text-slate-600" />
          </button>
        </CardContent>
      ) : null}
    </Card>
  );
}
