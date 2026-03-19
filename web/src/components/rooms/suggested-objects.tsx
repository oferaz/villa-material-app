import { useState } from "react";
import { Minus, Plus } from "lucide-react";
import { Room } from "@/types";
import { getSuggestedObjectsForRoomType } from "@/lib/mock/projects";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

interface SuggestedObjectsProps {
  room?: Room;
  onAddSuggestion: (objectName: string, category: string, basePrice: number, quantity?: number) => void;
  onDecreaseSuggestion: (objectName: string, category: string) => void;
  onOpenAddCustomObject: () => void;
}

const MIN_ADD_QUANTITY = 1;
const MAX_ADD_QUANTITY = 20;

export function SuggestedObjects({
  room,
  onAddSuggestion,
  onDecreaseSuggestion,
  onOpenAddCustomObject,
}: SuggestedObjectsProps) {
  const [draftAddQuantities, setDraftAddQuantities] = useState<Record<string, number>>({});

  if (!room) {
    return null;
  }

  const suggestions = getSuggestedObjectsForRoomType(room.type);
  const existingCountsByName = room.objects.reduce<Record<string, number>>((acc, item) => {
    const key = item.name.trim().toLowerCase();
    acc[key] = (acc[key] ?? 0) + Math.max(1, item.quantity);
    return acc;
  }, {});

  function getSuggestionKey(suggestionName: string, suggestionCategory: string) {
    return `${suggestionName.trim().toLowerCase()}::${suggestionCategory.trim().toLowerCase()}`;
  }

  function getDraftQuantity(suggestionName: string, suggestionCategory: string) {
    const key = getSuggestionKey(suggestionName, suggestionCategory);
    return draftAddQuantities[key] ?? MIN_ADD_QUANTITY;
  }

  function updateDraftQuantity(suggestionName: string, suggestionCategory: string, nextQuantity: number) {
    const key = getSuggestionKey(suggestionName, suggestionCategory);
    const safeQuantity = Math.max(MIN_ADD_QUANTITY, Math.min(MAX_ADD_QUANTITY, Math.round(nextQuantity)));
    setDraftAddQuantities((prev) => ({
      ...prev,
      [key]: safeQuantity,
    }));
  }

  function adjustDraftQuantity(suggestionName: string, suggestionCategory: string, delta: number) {
    const currentValue = getDraftQuantity(suggestionName, suggestionCategory);
    updateDraftQuantity(suggestionName, suggestionCategory, currentValue + delta);
  }

  return (
    <Card className="border-slate-200 shadow-sm">
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Suggested objects</CardTitle>
        <CardDescription>Add common objects quickly and edit quantities inline.</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
        {suggestions.map((suggestion) => {
          const quantityCount = existingCountsByName[suggestion.name.trim().toLowerCase()] ?? 0;
          const draftQuantity = getDraftQuantity(suggestion.name, suggestion.category);
          return (
            <div
              key={suggestion.name}
              className="flex items-start justify-between gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2"
            >
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-slate-800">{suggestion.name}</p>
                <p className="text-xs text-slate-500">{suggestion.category}</p>

                <div className="mt-2 flex flex-wrap items-center gap-1.5">
                  <span className="text-[11px] font-medium uppercase tracking-wide text-slate-500">Add qty</span>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="h-7 px-2"
                    onClick={() => adjustDraftQuantity(suggestion.name, suggestion.category, -1)}
                    disabled={draftQuantity <= MIN_ADD_QUANTITY}
                    aria-label={`Decrease add quantity for ${suggestion.name}`}
                  >
                    <Minus className="h-3.5 w-3.5" />
                  </Button>
                  <Badge variant="outline" className="h-7 min-w-8 justify-center px-2 text-xs">
                    {draftQuantity}
                  </Badge>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="h-7 px-2"
                    onClick={() => adjustDraftQuantity(suggestion.name, suggestion.category, 1)}
                    disabled={draftQuantity >= MAX_ADD_QUANTITY}
                    aria-label={`Increase add quantity for ${suggestion.name}`}
                  >
                    <Plus className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="h-7 px-2"
                    onClick={() => onAddSuggestion(suggestion.name, suggestion.category, suggestion.basePrice, draftQuantity)}
                  >
                    Add
                  </Button>
                </div>

                {quantityCount > 0 ? (
                  <div className="mt-2 flex flex-wrap items-center gap-1.5">
                    <span className="text-[11px] font-medium uppercase tracking-wide text-slate-500">In room</span>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="h-7 px-2"
                      onClick={() => onDecreaseSuggestion(suggestion.name, suggestion.category)}
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
                ) : null}
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
    </Card>
  );
}
