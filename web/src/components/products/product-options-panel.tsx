"use client";

import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { Search, Link as LinkIcon } from "lucide-react";
import { ProductOptionBudgetImpact, ProductSelectionBudgetSummary, RoomObject, getObjectStatus } from "@/types";
import { formatCurrencyAmount } from "@/lib/currency";
import {
  getBudgetHealthLabel,
  getBudgetHealthVariant,
  getObjectBudgetFitLabel,
  getObjectBudgetFitVariant,
  resolveBudgetCategory,
} from "@/lib/mock/budget";
import { parseMaterialTagsInput } from "@/lib/material-search";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ProductOptionCard } from "@/components/products/product-option-card";

interface AddFromLinkPayload {
  url: string;
  name?: string;
  supplier?: string;
  price?: number;
  imageUrl?: string;
  tags?: string[];
}

interface LinkPreviewResult {
  ok: boolean;
  name?: string;
  supplier?: string;
  imageUrl?: string;
  price?: number;
  priceFound: boolean;
  imageFound: boolean;
  warning?: string;
}

type BudgetFilter = "recommended" | "object_budget" | "room_plan" | "all";

interface ProductOptionsPanelProps {
  roomObject: RoomObject | undefined;
  projectCurrency: string;
  materialLibraryVersion: number;
  budgetSelectionSummary?: ProductSelectionBudgetSummary;
  budgetImpactByOptionId?: Record<string, ProductOptionBudgetImpact>;
  onSelectProduct: (productId: string) => void;
  onSearchCatalog: (objectId: string, query: string) => void;
  onAddFromLink: (objectId: string, payload: AddFromLinkPayload) => void;
}

function formatMoney(value: number | null | undefined, currency: string): string {
  return formatCurrencyAmount(value, currency);
}

function formatObjectBudgetDelta(value: number | null | undefined, currency: string): string {
  if (value === null || value === undefined) {
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

function matchesBudgetFilter(
  filter: BudgetFilter,
  impact: ProductOptionBudgetImpact | undefined,
  summary: ProductSelectionBudgetSummary | undefined
): boolean {
  if (!impact || filter === "all") {
    return true;
  }

  switch (filter) {
    case "recommended":
      return (
        impact.isCurrentSelection ||
        (impact.keepsRoomOnPlan &&
          impact.keepsHouseOnPlan &&
          impact.keepsCategoryOnPlan &&
          impact.keepsProjectOnPlan &&
          !impact.priceMissing &&
          (summary?.objectBudget === null || summary?.objectBudget === undefined || impact.objectBudgetStatus !== "over_object_budget"))
      );
    case "object_budget":
      if (summary?.objectBudget === null || summary?.objectBudget === undefined) {
        return true;
      }
      return impact.objectBudgetStatus === "under_object_budget" || impact.objectBudgetStatus === "on_object_budget";
    case "room_plan":
      if (summary?.currentRoomHealth === "not_planned") {
        return true;
      }
      return impact.keepsRoomOnPlan;
    default:
      return true;
  }
}

export function ProductOptionsPanel({
  roomObject,
  projectCurrency,
  materialLibraryVersion,
  budgetSelectionSummary,
  budgetImpactByOptionId,
  onSelectProduct,
  onSearchCatalog,
  onAddFromLink,
}: ProductOptionsPanelProps) {
  const [catalogQuery, setCatalogQuery] = useState("");
  const [linkUrl, setLinkUrl] = useState("");
  const [linkName, setLinkName] = useState("");
  const [linkSupplier, setLinkSupplier] = useState("");
  const [linkPrice, setLinkPrice] = useState("");
  const [linkImageUrl, setLinkImageUrl] = useState("");
  const [linkTagsInput, setLinkTagsInput] = useState("");
  const [linkError, setLinkError] = useState("");
  const [isFetchingLinkPreview, setIsFetchingLinkPreview] = useState(false);
  const [linkPreviewMessage, setLinkPreviewMessage] = useState("");
  const [showSearchTools, setShowSearchTools] = useState(true);
  const [budgetFilter, setBudgetFilter] = useState<BudgetFilter>("recommended");
  const searchInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (!roomObject) {
      return;
    }

    const hasSelectedMaterial = Boolean(
      roomObject.selectedProductId &&
        roomObject.productOptions.some((option) => option.id === roomObject.selectedProductId)
    );
    setShowSearchTools(!hasSelectedMaterial);
    setBudgetFilter("recommended");

    const defaultQuery = roomObject.materialSearchQuery?.trim() || roomObject.name;
    setCatalogQuery(defaultQuery);
    if (!hasSelectedMaterial) {
      window.requestAnimationFrame(() => {
        searchInputRef.current?.focus();
        searchInputRef.current?.select();
      });
    }
    setLinkUrl("");
    setLinkName("");
    setLinkSupplier("");
    setLinkPrice("");
    setLinkImageUrl("");
    setLinkTagsInput("");
    setLinkError("");
    setIsFetchingLinkPreview(false);
    setLinkPreviewMessage("");
  }, [roomObject?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!roomObject || !showSearchTools) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      const nextQuery = catalogQuery.trim() || roomObject.name;
      onSearchCatalog(roomObject.id, nextQuery);
    }, 220);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [catalogQuery, materialLibraryVersion, roomObject?.id, roomObject?.name, showSearchTools]); // eslint-disable-line react-hooks/exhaustive-deps


  const rankedOptions = useMemo(() => {
    if (!roomObject) {
      return [];
    }

    return [...roomObject.productOptions].sort((a, b) => {
      const impactA = budgetImpactByOptionId?.[a.id];
      const impactB = budgetImpactByOptionId?.[b.id];
      const scoreA = impactA?.recommendationScore ?? Number.MIN_SAFE_INTEGER;
      const scoreB = impactB?.recommendationScore ?? Number.MIN_SAFE_INTEGER;
      if (scoreB !== scoreA) {
        return scoreB - scoreA;
      }
      if (a.price !== b.price) {
        const aMissing = a.price <= 0 ? 1 : 0;
        const bMissing = b.price <= 0 ? 1 : 0;
        if (aMissing !== bMissing) {
          return aMissing - bMissing;
        }
      }
      if (a.leadTimeDays !== b.leadTimeDays) {
        return a.leadTimeDays - b.leadTimeDays;
      }
      return a.name.localeCompare(b.name);
    });
  }, [budgetImpactByOptionId, roomObject]);

  const visibleOptions = useMemo(() => {
    return rankedOptions.filter((option) =>
      matchesBudgetFilter(budgetFilter, budgetImpactByOptionId?.[option.id], budgetSelectionSummary)
    );
  }, [budgetFilter, budgetImpactByOptionId, budgetSelectionSummary, rankedOptions]);

  const selectedOption = useMemo(() => {
    if (!roomObject?.selectedProductId) {
      return undefined;
    }
    return roomObject.productOptions.find((option) => option.id === roomObject.selectedProductId);
  }, [roomObject]);

  const suggestionChips = useMemo(() => {
    if (!roomObject) {
      return [];
    }

    const budgetCategory = resolveBudgetCategory(roomObject.name, roomObject.category);
    switch (budgetCategory) {
      case "Lighting":
        return ["brushed brass", "matte black", "warm light", "wall light"];
      case "Tiles":
        return ["travertine", "matte porcelain", "mosaic", "outdoor"];
      case "Bathroom":
        return ["wall mirror", "brushed nickel", "stone", "floating vanity"];
      case "Kitchen":
        return ["quartz", "stainless steel", "oak veneer", "matte white"];
      case "Decor":
        return ["textured", "handmade", "woven", "minimal"];
      default:
        return ["white oak", "walnut", "linen", "performance fabric"];
    }
  }, [roomObject]);

  if (!roomObject) {
    return (
      <Card className="h-full border-slate-200 shadow-sm">
        <CardHeader>
          <CardTitle>Product options</CardTitle>
          <CardDescription>Select an object to view options.</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  const objectStatus = getObjectStatus(roomObject);
  const showLinkOptionalFields = linkUrl.trim().length > 0;

  function handleSearchSubmit(event?: FormEvent) {
    event?.preventDefault();
    if (!roomObject) {
      return;
    }
    const nextQuery = catalogQuery.trim() || roomObject.name;
    onSearchCatalog(roomObject.id, nextQuery);
    setCatalogQuery(nextQuery);
  }

  function handleSelectProductOption(productId: string) {
    onSelectProduct(productId);
    setShowSearchTools(false);
  }

  function handleShowSearchAlternatives() {
    if (!roomObject) {
      return;
    }

    setShowSearchTools(true);
    const nextQuery = catalogQuery.trim() || roomObject.name;
    onSearchCatalog(roomObject.id, nextQuery);
    setCatalogQuery(nextQuery);

    window.requestAnimationFrame(() => {
      searchInputRef.current?.focus();
      searchInputRef.current?.select();
    });
  }


  async function fetchLinkDetails() {
    const trimmedUrl = linkUrl.trim();
    if (!trimmedUrl) {
      setLinkError("Link is required.");
      return false;
    }
    try {
      new URL(trimmedUrl);
    } catch {
      setLinkError("Please enter a valid URL.");
      return false;
    }

    setLinkError("");
    setLinkPreviewMessage("");
    setIsFetchingLinkPreview(true);
    try {
      const response = await fetch("/api/link-preview", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ url: trimmedUrl }),
      });
      const payload = (await response.json()) as LinkPreviewResult & { error?: string };
      if (!response.ok || !payload.ok) {
        throw new Error(payload.error || "Failed to fetch link details.");
      }

      if (!linkName.trim() && payload.name) {
        setLinkName(payload.name);
      }
      if (!linkSupplier.trim() && payload.supplier) {
        setLinkSupplier(payload.supplier);
      }
      if (!linkPrice.trim() && typeof payload.price === "number" && payload.price > 0) {
        setLinkPrice(String(payload.price));
      }
      if (!linkImageUrl.trim() && payload.imageUrl) {
        setLinkImageUrl(payload.imageUrl);
      }

      if (payload.priceFound && payload.imageFound) {
        setLinkPreviewMessage("Fetched price and image from link.");
      } else if (payload.priceFound) {
        setLinkPreviewMessage("Fetched price from link. Add image optionally.");
      } else if (payload.imageFound) {
        setLinkPreviewMessage("Fetched image from link. Add price manually.");
      } else {
        setLinkPreviewMessage(payload.warning ?? "Could not auto-fetch details. Enter manually.");
      }

      return true;
    } catch (error) {
      setLinkError(error instanceof Error ? error.message : "Failed to fetch link details.");
      return false;
    } finally {
      setIsFetchingLinkPreview(false);
    }
  }

  async function handleAddFromLink(event: FormEvent) {
    event.preventDefault();
    if (!roomObject) {
      return;
    }

    const trimmedUrl = linkUrl.trim();
    if (!trimmedUrl) {
      setLinkError("Link is required.");
      return;
    }
    try {
      new URL(trimmedUrl);
    } catch {
      setLinkError("Please enter a valid URL.");
      return;
    }

    const parsedPrice = linkPrice.trim() ? Number(linkPrice.trim()) : undefined;
    if (parsedPrice === undefined || !Number.isFinite(parsedPrice) || parsedPrice <= 0) {
      setLinkError("Price is required. Click Fetch details or enter it manually.");
      return;
    }

    const trimmedImageUrl = linkImageUrl.trim();
    if (trimmedImageUrl) {
      try {
        new URL(trimmedImageUrl);
      } catch {
        setLinkError("Please enter a valid image URL.");
        return;
      }
    }

    onAddFromLink(roomObject.id, {
      url: trimmedUrl,
      name: linkName.trim() || undefined,
      supplier: linkSupplier.trim() || undefined,
      price: parsedPrice,
      imageUrl: trimmedImageUrl || undefined,
      tags: parseMaterialTagsInput(linkTagsInput),
    });

    setLinkUrl("");
    setLinkName("");
    setLinkSupplier("");
    setLinkPrice("");
    setLinkImageUrl("");
    setLinkTagsInput("");
    setLinkError("");
    setLinkPreviewMessage("");
  }

  return (
    <Card className="flex h-full flex-col border-slate-200 shadow-sm">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-2">
          <div>
            <CardTitle>{roomObject.name}</CardTitle>
            <CardDescription>{visibleOptions.length} option(s) shown from your private materials</CardDescription>
          </div>
          <Badge variant={objectStatus === "selected" ? "success" : "danger"}>{objectStatus}</Badge>
        </div>
      </CardHeader>
      <CardContent className="flex-1 space-y-4 overflow-y-auto pb-5">
        {budgetSelectionSummary ? (
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 shadow-sm">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Object budget and impact</p>
                <p className="text-sm font-semibold text-slate-900">Qty {budgetSelectionSummary.quantity}</p>
              </div>
              <div className="flex flex-wrap items-center justify-end gap-1.5">
                {budgetSelectionSummary.currentCategoryName ? (
                  <Badge variant="outline">{`Budget category: ${budgetSelectionSummary.currentCategoryName}`}</Badge>
                ) : null}
                <Badge variant={getObjectBudgetFitVariant(budgetSelectionSummary.objectBudgetStatus)}>
                  {getObjectBudgetFitLabel(budgetSelectionSummary.objectBudgetStatus)}
                </Badge>
                <Badge variant={getBudgetHealthVariant(budgetSelectionSummary.currentRoomHealth)}>
                  {`Room: ${getBudgetHealthLabel(budgetSelectionSummary.currentRoomHealth)}`}
                </Badge>
              </div>
            </div>
            <div className="mt-3 grid gap-2 text-xs text-slate-600 sm:grid-cols-2">
              <p>
                Object budget:{" "}
                <span className="font-medium text-slate-800">{formatMoney(budgetSelectionSummary.objectBudget, projectCurrency)}</span>
              </p>
              <p>
                Current selection:{" "}
                <span className="font-medium text-slate-800">{formatMoney(budgetSelectionSummary.currentSelectedTotal, projectCurrency)}</span>
              </p>
              <p>
                Object budget status:{" "}
                <span className="font-medium text-slate-800">
                  {formatObjectBudgetDelta(budgetSelectionSummary.currentObjectBudgetDelta, projectCurrency)}
                </span>
              </p>
              <p>
                Room remaining:{" "}
                <span className="font-medium text-slate-800">{formatMoney(budgetSelectionSummary.currentRoomRemaining, projectCurrency)}</span>
              </p>
              <p>
                House remaining:{" "}
                <span className="font-medium text-slate-800">{formatMoney(budgetSelectionSummary.currentHouseRemaining, projectCurrency)}</span>
              </p>
              <p>
                Project remaining:{" "}
                <span className="font-medium text-slate-800">{formatMoney(budgetSelectionSummary.currentProjectRemaining, projectCurrency)}</span>
              </p>
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              {([
                ["recommended", "Recommended"],
                ["object_budget", "Within object budget"],
                ["room_plan", "Within room plan"],
                ["all", "All"],
              ] as const).map(([value, label]) => {
                const disabled =
                  (value === "object_budget" && budgetSelectionSummary.objectBudget === null) ||
                  (value === "room_plan" && budgetSelectionSummary.currentRoomHealth === "not_planned");
                return (
                  <Button
                    key={value}
                    type="button"
                    size="sm"
                    variant={budgetFilter === value ? "default" : "outline"}
                    disabled={disabled}
                    onClick={() => setBudgetFilter(value)}
                  >
                    {label}
                  </Button>
                );
              })}
            </div>
            <p className="mt-3 text-[11px] text-slate-500">Options are ranked by plan safety, object-budget fit, delta, lead time, and missing-price penalty.</p>
          </div>
        ) : null}

        {selectedOption ? (
          <div className="space-y-3 rounded-xl border border-emerald-200 bg-emerald-50/50 p-3 shadow-sm">
            <div className="flex items-start justify-between gap-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700">Selected material</p>
              <Button type="button" size="sm" variant="outline" onClick={handleShowSearchAlternatives}>
                Search alternatives
              </Button>
            </div>
            <ProductOptionCard
              option={selectedOption}
              isSelected
              onSelect={() => onSelectProduct(selectedOption.id)}
              projectCurrency={projectCurrency}
              budgetImpact={budgetImpactByOptionId?.[selectedOption.id]}
            />
          </div>
        ) : null}

        <form
          onSubmit={handleSearchSubmit}
          className={`rounded-xl border border-slate-200 bg-white p-3 shadow-sm ${showSearchTools ? "" : "hidden"}`}
        >
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Material search query</p>
          <div className="flex flex-col gap-2 sm:flex-row">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-2.5 top-2.5 h-4 w-4 text-slate-400" />
              <Input
                ref={searchInputRef}
                value={catalogQuery}
                onChange={(event) => setCatalogQuery(event.target.value)}
                placeholder="Refine search (e.g. white oak matte, brushed brass)"
                className="h-10 border-slate-300 bg-slate-50 pl-8 text-sm text-slate-900 placeholder:text-slate-500 focus-visible:bg-white"
              />
            </div>
            <Button type="submit" size="sm" className="h-10 px-3 text-sm font-medium sm:min-w-[140px]">
              Search Library
            </Button>
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            {suggestionChips.map((chip) => {
              const nextQuery = `${roomObject.name} ${chip}`.trim();
              return (
                <Button
                  key={chip}
                  type="button"
                  size="sm"
                  variant="outline"
                  className="h-7 px-2 text-[11px]"
                  onClick={() => setCatalogQuery(nextQuery)}
                >
                  {chip}
                </Button>
              );
            })}
          </div>
        </form>

        <form
          onSubmit={handleAddFromLink}
          className={`space-y-2 rounded-lg border border-slate-200 bg-white p-3 ${showSearchTools ? "" : "hidden"}`}
        >
          <p className="inline-flex items-center gap-2 text-sm font-bold text-slate-700">
            <LinkIcon className="h-3.5 w-3.5" />
            Add material from link
          </p>
          <Input
            value={linkUrl}
            onChange={(event) => {
              setLinkUrl(event.target.value);
              setLinkError("");
              setLinkPreviewMessage("");
            }}
            placeholder="https://supplier-site.com/product"
            onBlur={() => {
              if (linkUrl.trim()) {
                void fetchLinkDetails();
              }
            }}
          />
          {showLinkOptionalFields ? (
            <>
              <Button
                type="button"
                variant="secondary"
                className="w-full"
                onClick={() => void fetchLinkDetails()}
                disabled={isFetchingLinkPreview}
              >
                {isFetchingLinkPreview ? "Fetching details..." : "Fetch details from link"}
              </Button>
              <Input
                value={linkName}
                onChange={(event) => setLinkName(event.target.value)}
                placeholder="Product name (optional)"
              />
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                <Input
                  value={linkSupplier}
                  onChange={(event) => setLinkSupplier(event.target.value)}
                  placeholder="Supplier (optional)"
                />
                <Input
                  value={linkPrice}
                  onChange={(event) => setLinkPrice(event.target.value)}
                  placeholder="Price (required if not found)"
                  inputMode="decimal"
                />
              </div>
              <Input
                value={linkImageUrl}
                onChange={(event) => setLinkImageUrl(event.target.value)}
                placeholder="Image URL (auto-filled, optional override)"
              />
              <Input
                value={linkTagsInput}
                onChange={(event) => setLinkTagsInput(event.target.value)}
                placeholder="Optional tags, e.g. material:oak, finish:matte, room:bathroom"
              />
            </>
          ) : (
            <p className="text-xs text-slate-500">Optional fields will appear after you paste a link.</p>
          )}
          {linkPreviewMessage ? <p className="text-xs text-emerald-700">{linkPreviewMessage}</p> : null}
          {linkError ? <p className="text-xs text-red-600">{linkError}</p> : null}
          <Button type="submit" variant="outline" className="w-full">
            Add from link
          </Button>
        </form>

        {showSearchTools ? (
          visibleOptions.length === 0 ? (
            <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50 p-4 text-sm text-slate-500">
              {catalogQuery.trim()
                ? `No options match "${catalogQuery.trim()}" yet. Try changing the search words or add from link.`
                : "No options found for this query yet. Try changing search words or add from link."}
            </div>
          ) : (
            <div className="space-y-3">
              {visibleOptions.map((option) => (
                <ProductOptionCard
                  key={option.id}
                  option={option}
                  isSelected={roomObject.selectedProductId === option.id}
                  onSelect={() => handleSelectProductOption(option.id)}
                  projectCurrency={projectCurrency}
                  budgetImpact={budgetImpactByOptionId?.[option.id]}
                />
              ))}
            </div>
          )
        ) : null}
      </CardContent>
    </Card>
  );
}

