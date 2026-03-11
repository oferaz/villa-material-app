import { Plus } from "lucide-react";
import { Room } from "@/types";
import { getSuggestedObjectsForRoomType } from "@/lib/mock/projects";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

interface SuggestedObjectsProps {
  room?: Room;
  onAddSuggestion: (objectName: string, category: string, basePrice: number) => void;
  onOpenAddCustomObject: () => void;
}

export function SuggestedObjects({ room, onAddSuggestion, onOpenAddCustomObject }: SuggestedObjectsProps) {
  if (!room) {
    return null;
  }

  const suggestions = getSuggestedObjectsForRoomType(room.type);
  const existingNames = new Set(room.objects.map((item) => item.name.trim().toLowerCase()));

  return (
    <Card className="border-slate-200 shadow-sm">
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Suggested objects</CardTitle>
        <CardDescription>Add common objects for this room type in one click.</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
        {suggestions.map((suggestion) => {
          const isAlreadyAdded = existingNames.has(suggestion.name.toLowerCase());
          return (
            <div key={suggestion.name} className="flex items-center justify-between rounded-lg border border-slate-200 bg-white px-3 py-2">
              <div>
                <p className="text-sm font-medium text-slate-800">{suggestion.name}</p>
                <p className="text-xs text-slate-500">{suggestion.category}</p>
              </div>
              {isAlreadyAdded ? (
                <Badge variant="outline">Added</Badge>
              ) : (
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="h-8 px-2"
                  onClick={() => onAddSuggestion(suggestion.name, suggestion.category, suggestion.basePrice)}
                >
                  <Plus className="h-3.5 w-3.5" />
                </Button>
              )}
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
