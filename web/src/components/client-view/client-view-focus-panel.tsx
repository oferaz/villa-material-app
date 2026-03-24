"use client";

import { UserMaterial } from "@/lib/supabase/materials-repository";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCurrencyAmount } from "@/lib/currency";
import { ClientViewCardMode } from "@/types";

export const CLIENT_VIEW_FOCUS_PANEL_SLOT_ID = "client-view-focus-panel-slot";

interface ClientViewFocusedObjectManagerProps {
  houseName?: string;
  roomName?: string;
  objectName?: string;
  objectCategory?: string;
  quantity?: number;
  budgetAllowance?: number | null;
  currentSelectedMaterialName?: string | null;
  selected: boolean;
  cardMode: ClientViewCardMode;
  promptText: string;
  showSourceLink: boolean;
  optionMaterialIds: string[];
  materials: UserMaterial[];
  availableMaterials: UserMaterial[];
  optionPickerValue: string;
  projectCurrency: string;
  onToggleSelected: (selected: boolean) => void;
  onCardModeChange: (cardMode: ClientViewCardMode) => void;
  onPromptChange: (value: string) => void;
  onToggleShowSourceLink: (selected: boolean) => void;
  onOptionPickerChange: (value: string) => void;
  onAddOption: () => void;
  onRemoveOption: (materialId: string) => void;
}

export function ClientViewFocusPanelShell() {
  return (
    <Card className="border-slate-200 bg-white/95 shadow-sm backdrop-blur">
      <CardHeader>
        <CardTitle>Object Share Settings</CardTitle>
        <CardDescription>Select an object from the Client View map to manage card mode, prompt, source links, and published material options.</CardDescription>
      </CardHeader>
      <CardContent>
        <div id={CLIENT_VIEW_FOCUS_PANEL_SLOT_ID} className="min-h-[320px]" />
      </CardContent>
    </Card>
  );
}

export function ClientViewFocusedObjectManager(props: ClientViewFocusedObjectManagerProps) {
  const selectedMaterials = props.optionMaterialIds
    .map((materialId) => props.materials.find((entry) => entry.id === materialId) ?? null)
    .filter((material): material is UserMaterial => material !== null);

  return (
    <div className="space-y-4 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="space-y-3">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="min-w-0 space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="min-w-0 break-words text-lg font-semibold text-slate-900">{props.objectName ?? "No object selected"}</h3>
              {props.roomName ? <Badge variant="outline">{props.roomName}</Badge> : null}
              {props.houseName ? <Badge variant="outline">{props.houseName}</Badge> : null}
            </div>
            <p className="break-words text-sm text-slate-500">
              {props.objectCategory ?? "Object"} - Qty {props.quantity ?? 1}
              {props.currentSelectedMaterialName ? ` - Current: ${props.currentSelectedMaterialName}` : " - No current selection"}
            </p>
          </div>
          {props.budgetAllowance != null ? <Badge variant="outline">Budget {formatCurrencyAmount(props.budgetAllowance, props.projectCurrency)}</Badge> : null}
        </div>

        <label className="inline-flex items-center gap-2 text-sm font-medium text-slate-800">
          <input type="checkbox" checked={props.selected} onChange={(event) => props.onToggleSelected(event.target.checked)} />
          Include this object in the client view
        </label>
      </div>

      <label className="block space-y-1.5">
        <span className="text-sm font-medium text-slate-700">Card mode</span>
        <select className="h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none ring-offset-white focus:ring-2 focus:ring-slate-300" value={props.cardMode} onChange={(event) => props.onCardModeChange(event.target.value as ClientViewCardMode)}>
          <option value="material_choice">Material choice</option>
          <option value="budget_input">Budget input</option>
          <option value="scope_confirmation">Scope confirmation</option>
        </select>
      </label>

      <label className="block space-y-1.5">
        <span className="text-sm font-medium text-slate-700">Prompt</span>
        <textarea className="min-h-24 w-full rounded-md border border-slate-200 px-3 py-2 text-sm outline-none ring-offset-white focus:ring-2 focus:ring-slate-300" value={props.promptText} onChange={(event) => props.onPromptChange(event.target.value)} placeholder="Optional prompt shown to the client" />
      </label>

      <label className="inline-flex items-center gap-2 text-sm text-slate-700">
        <input type="checkbox" checked={props.showSourceLink} onChange={(event) => props.onToggleShowSourceLink(event.target.checked)} />
        Show source/vendor links when available
      </label>

      {!props.selected ? <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50 p-3 text-sm text-slate-500">This object stays private until you enable &quot;Include this object in the client view.&quot;</div> : null}

      {props.cardMode === "material_choice" ? (
        <div className="space-y-3 rounded-xl border border-slate-200 bg-slate-50 p-4">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="text-sm font-medium text-slate-800">Published options</p>
              <p className="break-words text-xs text-slate-500">Choose up to 3 explicit materials from your private library.</p>
            </div>
            <Badge variant="outline">{props.optionMaterialIds.length}/3</Badge>
          </div>
          <div className="space-y-2">
            <select className="h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none ring-offset-white focus:ring-2 focus:ring-slate-300" value={props.optionPickerValue} onChange={(event) => props.onOptionPickerChange(event.target.value)}>
              <option value="">Choose material</option>
              {props.availableMaterials.map((material) => (
                <option key={material.id} value={material.id}>{material.name} - {material.supplier}</option>
              ))}
            </select>
            <Button type="button" variant="outline" className="w-full" disabled={!props.optionPickerValue || props.optionMaterialIds.length >= 3} onClick={props.onAddOption}>Add material option</Button>
          </div>
          {selectedMaterials.length > 0 ? (
            <div className="space-y-2">
              {selectedMaterials.map((material) => (
                <div key={material.id} className="rounded-lg border border-slate-200 bg-white p-3 text-sm">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="break-words font-medium text-slate-900">{material.name}</p>
                      <p className="break-words text-slate-500">{material.supplier}</p>
                      <p className="mt-1 text-slate-700">{formatCurrencyAmount(material.price, props.projectCurrency)}</p>
                    </div>
                    <Button type="button" size="sm" variant="ghost" className="shrink-0" onClick={() => props.onRemoveOption(material.id)}>Remove</Button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="rounded-lg border border-dashed border-slate-200 bg-white p-3 text-sm text-slate-500">No material options selected yet. Add up to three materials for the client to compare.</div>
          )}
        </div>
      ) : (
        <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 p-4 text-sm text-slate-500">
          {props.cardMode === "budget_input" ? "Clients will see the object context and submit a preferred budget." : "Clients will confirm whether this object is approved, not needed, or needs revision."}
        </div>
      )}
    </div>
  );
}
