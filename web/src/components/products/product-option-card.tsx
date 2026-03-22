/* eslint-disable @next/next/no-img-element */
import { ProductOption, ProductOptionBudgetImpact } from "@/types";
import { ExternalLink } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatCurrencyAmount, formatSignedCurrencyDelta } from "@/lib/currency";
import { getBudgetHealthLabel, getBudgetHealthStatus, getBudgetHealthVariant } from "@/lib/mock/budget";
import { cn } from "@/lib/utils";

interface ProductOptionCardProps {
  option: ProductOption;
  isSelected: boolean;
  onSelect: () => void;
  projectCurrency: string;
  budgetImpact?: ProductOptionBudgetImpact;
}

function formatObjectBudgetDelta(value: number | null, currency: string): string {
  if (value === null) {
    return "No object budget";
  }
  const rounded = Math.round(value);
  if (rounded === 0) {
    return "On object budget";
  }
  if (rounded > 0) {
    return `${formatCurrencyAmount(rounded, currency)} over object budget`;
  }
  return `${formatCurrencyAmount(Math.abs(rounded), currency)} under object budget`;
}

export function ProductOptionCard({ option, isSelected, onSelect, projectCurrency, budgetImpact }: ProductOptionCardProps) {
  const roomHealth = budgetImpact
    ? getBudgetHealthStatus(
        budgetImpact.nextRoomRemaining === null ? null : budgetImpact.nextRoomRemaining + budgetImpact.candidateTotal,
        budgetImpact.nextRoomRemaining
      )
    : "not_planned";

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
            {budgetImpact ? <Badge variant={budgetImpact.fitTone === "danger" ? "danger" : budgetImpact.fitTone === "warn" ? "secondary" : budgetImpact.fitTone === "good" ? "success" : "outline"}>{budgetImpact.primaryReasonLabel}</Badge> : null}
            {budgetImpact?.secondaryReasonLabel ? <Badge variant="outline">{budgetImpact.secondaryReasonLabel}</Badge> : null}
            {isSelected ? <Badge variant="success">Selected</Badge> : null}
          </div>
        </div>
        <p className="text-xs text-slate-500">{option.supplier}</p>
        {option.searchMatchLabels?.length ? (
          <div className="flex flex-wrap gap-1">
            {option.searchMatchLabels.map((label) => (
              <Badge key={label} variant="outline" className="text-[10px]">
                {label}
              </Badge>
            ))}
          </div>
        ) : null}
        <p className="text-xs text-slate-500">
          {option.price > 0 ? `${formatCurrencyAmount(option.price, projectCurrency)} per unit` : "Price on request"} - {" "}
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
            <span>{formatCurrencyAmount(budgetImpact.candidateTotal, projectCurrency)} total</span>
          </div>
          <div className="mt-2 grid gap-2 sm:grid-cols-2">
            <p>
              Object budget:{" "}
              <span className="font-medium text-slate-800">{formatObjectBudgetDelta(budgetImpact.objectBudgetDelta, projectCurrency)}</span>
            </p>
            <p>
              Change vs current:{" "}
              <span className="font-medium text-slate-800">{formatSignedCurrencyDelta(budgetImpact.deltaAmount, projectCurrency)}</span>
            </p>
            <p>
              Room remaining:{" "}
              <span className="font-medium text-slate-800">{formatCurrencyAmount(budgetImpact.nextRoomRemaining, projectCurrency)}</span>
            </p>
            <p>
              House remaining:{" "}
              <span className="font-medium text-slate-800">{formatCurrencyAmount(budgetImpact.nextHouseRemaining, projectCurrency)}</span>
            </p>
            <p>
              Budget category remaining:{" "}
              <span className="font-medium text-slate-800">{formatCurrencyAmount(budgetImpact.nextCategoryRemaining, projectCurrency)}</span>
            </p>
            <p>
              Project remaining:{" "}
              <span className="font-medium text-slate-800">{formatCurrencyAmount(budgetImpact.nextProjectRemaining, projectCurrency)}</span>
            </p>
          </div>
          <div className="mt-2 flex flex-wrap gap-1.5">
            <Badge variant={budgetImpact.keepsRoomOnPlan ? "success" : "danger"}>
              {budgetImpact.keepsRoomOnPlan ? "Keeps room on plan" : "Breaks room plan"}
            </Badge>
            <Badge variant={budgetImpact.keepsHouseOnPlan ? "success" : "danger"}>
              {budgetImpact.keepsHouseOnPlan ? "Keeps house on plan" : "Breaks house plan"}
            </Badge>
            <Badge variant={budgetImpact.keepsCategoryOnPlan ? "success" : "danger"}>
              {budgetImpact.keepsCategoryOnPlan ? "Keeps category on plan" : "Breaks category plan"}
            </Badge>
            <Badge variant={budgetImpact.keepsProjectOnPlan ? "success" : "danger"}>
              {budgetImpact.keepsProjectOnPlan ? "Keeps project on plan" : "Breaks project plan"}
            </Badge>
            <Badge variant={getBudgetHealthVariant(roomHealth)}>{`Room after selection: ${getBudgetHealthLabel(roomHealth)}`}</Badge>
          </div>
        </div>
      ) : null}
      <Button type="button" className="mt-3 w-full" variant={isSelected ? "secondary" : "outline"} onClick={onSelect}>
        {isSelected ? "Selected" : "Select"}
      </Button>
    </article>
  );
}
