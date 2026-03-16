"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { Search, Link as LinkIcon } from "lucide-react";
import { RoomObject, getObjectStatus, getObjectWorkflowStage, getWorkflowStageLabel } from "@/types";
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
}

interface ProductOptionsPanelProps {
  roomObject: RoomObject | undefined;
  globalSearchQuery: string;
  onSelectProduct: (productId: string) => void;
  onUpdateWorkflow: (objectId: string, patch: Partial<Pick<RoomObject, "poApproved" | "ordered" | "installed">>) => void;
  onSearchCatalog: (objectId: string, query: string) => void;
  onAddFromLink: (objectId: string, payload: AddFromLinkPayload) => void;
}

export function ProductOptionsPanel({
  roomObject,
  globalSearchQuery,
  onSelectProduct,
  onUpdateWorkflow,
  onSearchCatalog,
  onAddFromLink,
}: ProductOptionsPanelProps) {
  const [catalogQuery, setCatalogQuery] = useState("");
  const [linkUrl, setLinkUrl] = useState("");
  const [linkName, setLinkName] = useState("");
  const [linkSupplier, setLinkSupplier] = useState("");
  const [linkPrice, setLinkPrice] = useState("");
  const [linkImageUrl, setLinkImageUrl] = useState("");
  const [linkError, setLinkError] = useState("");

  useEffect(() => {
    if (!roomObject) {
      return;
    }
    const defaultQuery = roomObject.name;
    setCatalogQuery(defaultQuery);
    onSearchCatalog(roomObject.id, defaultQuery);
    setLinkUrl("");
    setLinkName("");
    setLinkSupplier("");
    setLinkPrice("");
    setLinkImageUrl("");
    setLinkError("");
  }, [roomObject?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const visibleOptions = useMemo(() => {
    if (!roomObject) {
      return [];
    }
    const q = (globalSearchQuery ?? "").trim().toLowerCase();
    if (!q) {
      return roomObject.productOptions;
    }
    return roomObject.productOptions.filter((option) => {
      return option.name.toLowerCase().includes(q) || option.supplier.toLowerCase().includes(q);
    });
  }, [roomObject, globalSearchQuery]);

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
  const workflowStage = getObjectWorkflowStage(roomObject);
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

  function handleAddFromLink(event: FormEvent) {
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
      setLinkError("Price is required and must be greater than 0.");
      return;
    }
    const trimmedImageUrl = linkImageUrl.trim();
    if (!trimmedImageUrl) {
      setLinkError("Image URL is required.");
      return;
    }
    try {
      new URL(trimmedImageUrl);
    } catch {
      setLinkError("Please enter a valid image URL.");
      return;
    }

    onAddFromLink(roomObject.id, {
      url: trimmedUrl,
      name: linkName.trim() || undefined,
      supplier: linkSupplier.trim() || undefined,
      price: parsedPrice,
      imageUrl: trimmedImageUrl,
    });

    setLinkUrl("");
    setLinkName("");
    setLinkSupplier("");
    setLinkPrice("");
    setLinkImageUrl("");
    setLinkError("");
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
        <div className="mt-2 rounded-lg border border-slate-200 bg-slate-50 p-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Workflow stage</p>
          <p className="text-sm font-medium text-slate-800">{getWorkflowStageLabel(workflowStage)}</p>
          <div className="mt-2 flex flex-wrap gap-2">
            <Button
              type="button"
              size="sm"
              variant={roomObject.poApproved ? "default" : "outline"}
              disabled={!roomObject.selectedProductId || roomObject.poApproved}
              onClick={() => onUpdateWorkflow(roomObject.id, { poApproved: true })}
            >
              Approve for PO
            </Button>
            <Button
              type="button"
              size="sm"
              variant={roomObject.ordered ? "default" : "outline"}
              disabled={!roomObject.selectedProductId || !roomObject.poApproved || roomObject.ordered}
              onClick={() => onUpdateWorkflow(roomObject.id, { ordered: true })}
            >
              Mark ordered
            </Button>
            <Button
              type="button"
              size="sm"
              variant={roomObject.installed ? "default" : "outline"}
              disabled={!roomObject.selectedProductId || !roomObject.ordered || roomObject.installed}
              onClick={() => onUpdateWorkflow(roomObject.id, { installed: true })}
            >
              Mark installed
            </Button>
            {(roomObject.poApproved || roomObject.ordered || roomObject.installed) ? (
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={() => onUpdateWorkflow(roomObject.id, { poApproved: false })}
              >
                Reset stage
              </Button>
            ) : null}
          </div>
        </div>
      </CardHeader>
      <CardContent className="flex-1 space-y-4 overflow-y-auto pb-5">
        <form onSubmit={handleSearchSubmit} className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Material search query</p>
          <div className="flex flex-col gap-2 sm:flex-row">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-2.5 top-2.5 h-4 w-4 text-slate-400" />
              <Input
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
        </form>

        <form onSubmit={handleAddFromLink} className="space-y-2 rounded-lg border border-slate-200 bg-white p-3">
          <p className="inline-flex items-center gap-2 text-sm font-bold text-slate-700">
            <LinkIcon className="h-3.5 w-3.5" />
            Add material from link
          </p>
          <Input
            value={linkUrl}
            onChange={(event) => setLinkUrl(event.target.value)}
            placeholder="https://supplier-site.com/product"
          />
          {showLinkOptionalFields ? (
            <>
              <Input
                value={linkName}
                onChange={(event) => setLinkName(event.target.value)}
                placeholder="Product name (optional)"
              />
              <div className="grid grid-cols-2 gap-2">
                <Input
                  value={linkSupplier}
                  onChange={(event) => setLinkSupplier(event.target.value)}
                  placeholder="Supplier (optional)"
                />
                <Input
                  value={linkPrice}
                  onChange={(event) => setLinkPrice(event.target.value)}
                  placeholder="Price (required)"
                  inputMode="decimal"
                />
              </div>
              <Input
                value={linkImageUrl}
                onChange={(event) => setLinkImageUrl(event.target.value)}
                placeholder="Image URL (required)"
              />
            </>
          ) : (
            <p className="text-xs text-slate-500">Optional fields will appear after you paste a link.</p>
          )}
          {linkError ? <p className="text-xs text-red-600">{linkError}</p> : null}
          <Button type="submit" variant="outline" className="w-full">
            Add from link
          </Button>
        </form>

        {visibleOptions.length === 0 ? (
          <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50 p-4 text-sm text-slate-500">
            {(globalSearchQuery ?? "").trim()
              ? `No options match "${globalSearchQuery}".`
              : "No options found for this query yet. Try changing search words or add from link."}
          </div>
        ) : (
          <div className="space-y-3">
            {visibleOptions.map((option) => (
              <ProductOptionCard
                key={option.id}
                option={option}
                isSelected={roomObject.selectedProductId === option.id}
                onSelect={() => onSelectProduct(option.id)}
              />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
