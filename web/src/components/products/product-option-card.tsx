/* eslint-disable @next/next/no-img-element */
import { ProductOption } from "@/types";
import { ExternalLink } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface ProductOptionCardProps {
  option: ProductOption;
  isSelected: boolean;
  onSelect: () => void;
}

export function ProductOptionCard({ option, isSelected, onSelect }: ProductOptionCardProps) {
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
          {isSelected ? <Badge variant="success">Selected</Badge> : null}
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
      <Button type="button" className="mt-3 w-full" variant={isSelected ? "secondary" : "outline"} onClick={onSelect}>
        {isSelected ? "Selected" : "Select"}
      </Button>
    </article>
  );
}
