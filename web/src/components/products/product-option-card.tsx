/* eslint-disable @next/next/no-img-element */
import { ProductOption, ProductOptionBudgetImpact } from "@/types";
import { ExternalLink } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface ProductOptionCardProps {
  option: ProductOption;
  isSelected: boolean;
  onSelect: () => void;
  budgetImpact?: ProductOptionBudgetImpact;
}

function formatMoney(value: number | null): string {
  if (value === null) {
    return "Not set";
  }
  return `${Math.round(value).toLocaleString()} THB`;
}

function formatDelta(value: number): string {
  const rounded = Math.round(value);
  if (rounded === 0) {
    return "No budget change";
  }
  const prefix = rounded > 0 ? "+" : "-";
  return `${prefix}${Math.abs(rounded).toLocaleString()} THB`;
}

function formatAllowanceDelta(value: number | null): string {
  if (value === null) {
    return "No target set";
  }
  const rounded = Math.round(value);
  if (rounded === 0) {
    return "On target";
  }
  if (rounded > 0) {
    return `${rounded.toLocaleString()} THB over target`;
  }
  return `${Math.abs(rounded).toLocaleString()} THB under target`;
}

function getBudgetBadgeVariant(tone: ProductOptionBudgetImpact["fitTone"]): "success" | "secondary" | "danger" | "outline" {
  switch (tone) {
    case "good":
      return "success";
    case "warn":
      return "secondary";
    case "danger":
      return "danger";
    default:
      return "outline";
  }
}

function getAllowanceBadgeVariant(tone: ProductOptionBudgetImpact["allowanceTone"]): "success" | "secondary" | "danger" | "outline" {
  switch (tone) {
    case "good":
      return "success";
    case "warn":
      return "secondary";
    case "danger":
      return "danger";
    default:
      return "outline";
  }
}

export function ProductOptionCard({ option, isSelected, onSelect, budgetImpact }: ProductOptionCardProps) {
  return (
    <article
      className={cn(
        "rounded-xl border p-3 transition",
        isSelected ? "border-emerald-200 bg-emerald-50/70 shadow-sm" : "border-slate-200 bg-white hover:border-slate-300"
      )}
    >
      <div className="mb-3 h-28 overflow-hidden rounded-lg border border-slate-200 bg-gradient-to-br from-slate-100 to-slate-200">
        {option.imageUrl ? (
          <img
            src={option.imageUrl}
            alt={option.name}
            className="h-full w-full object-cover"
            loading="lazy"
            referrerPolicy="no-referrer"
          />
        ) : null}
      </div>
      <div className="space-y-1">
        <div className="flex items-start justify-between gap-2">
          <p className="text-sm font-semibold text-slate-800">{option.name}</p>
          <div className="flex flex-wrap items-center justify-end gap-1.5">
            {budgetImpact?.allowanceLabel ? (
              <Badge variant={getAllowanceBadgeVariant(budgetImpact.allowanceTone)}>{budgetImpact.allowanceLabel}</Badge>
            ) : null}
            {budgetImpact ? <Badge variant={getBudgetBadgeVariant(budgetImpact.fitTone)}>{budgetImpact.fitLabel}</Badge> : null}
            {isSelected ? <Badge variant="success">Selected</Badge> : null}
          </div>
        </div>
        <p className="text-xs text-slate-500">{option.supplier}</p>
        <p className="text-xs text-slate-500">
          {option.price > 0 ? `${option.price.toLocaleString()} THB per unit` : "Price on request"} -{" "}
          {option.leadTimeDays > 0 ? `${option.leadTimeDays} days lead time` : "Lead time pending"}
        </p>
        {option.sourceUrl ? (
          <a
            href={option.sourceUrl}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
          >
            Source link
            <ExternalLink className="h-3 w-3" />
          </a>
        ) : null}
      </div>
      {budgetImpact ? (
        <div className="mt-3 rounded-lg border border-slate-200 bg-slate-50 p-2.5 text-[11px] text-slate-600">
          <div className="flex items-center justify-between gap-2 text-slate-700">
            <span className="font-medium">Budget impact</span>
            <span>{formatMoney(budgetImpact.candidateTotal)} total</span>
          </div>
          <div className="mt-2 space-y-1">
            {budgetImpact.objectAllowance !== null ? (
              <>
                <p>
                  Target allowance: <span className="font-medium text-slate-800">{formatMoney(budgetImpact.objectAllowance)}</span>
                </p>
                <p>
                  Target status: <span className="font-medium text-slate-800">{formatAllowanceDelta(budgetImpact.allowanceDelta)}</span>
                </p>
              </>
            ) : null}
            <p>
              Change vs current: <span className="font-medium text-slate-800">{formatDelta(budgetImpact.deltaAmount)}</span>
            </p>
            <p>
              Room remaining: <span className="font-medium text-slate-800">{formatMoney(budgetImpact.currentRoomRemaining)}</span>{" "}
              -&gt; <span className="font-medium text-slate-800">{formatMoney(budgetImpact.nextRoomRemaining)}</span>
            </p>
            <p>
              House remaining: <span className="font-medium text-slate-800">{formatMoney(budgetImpact.currentHouseRemaining)}</span>{" "}
              -&gt; <span className="font-medium text-slate-800">{formatMoney(budgetImpact.nextHouseRemaining)}</span>
            </p>
            <p>
              {budgetImpact.candidateCategory} remaining:{" "}
              <span className="font-medium text-slate-800">{formatMoney(budgetImpact.currentCategoryRemaining)}</span> -&gt;{" "}
              <span className="font-medium text-slate-800">{formatMoney(budgetImpact.nextCategoryRemaining)}</span>
            </p>
            <p>
              Project remaining: <span className="font-medium text-slate-800">{formatMoney(budgetImpact.currentProjectRemaining)}</span>{" "}
              -&gt; <span className="font-medium text-slate-800">{formatMoney(budgetImpact.nextProjectRemaining)}</span>
            </p>
          </div>
        </div>
      ) : null}
      <Button type="button" className="mt-3 w-full" variant={isSelected ? "secondary" : "outline"} onClick={onSelect}>
        {isSelected ? "Selected" : "Select"}
      </Button>
    </article>
  );
}
