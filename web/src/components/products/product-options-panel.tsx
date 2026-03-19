"use client";

import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { Search, Link as LinkIcon } from "lucide-react";
import { RoomObject, getObjectStatus } from "@/types";
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

interface ProductOptionsPanelProps {
  roomObject: RoomObject | undefined;
  globalSearchQuery: string;
  onSelectProduct: (productId: string) => void;
  onSearchCatalog: (objectId: string, query: string) => void;
  onAddFromLink: (objectId: string, payload: AddFromLinkPayload) => void;
}

export function ProductOptionsPanel({
  roomObject,
  globalSearchQuery,
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
  const [linkError, setLinkError] = useState("");
  const [isFetchingLinkPreview, setIsFetchingLinkPreview] = useState(false);
  const [linkPreviewMessage, setLinkPreviewMessage] = useState("");
  const [showSearchTools, setShowSearchTools] = useState(true);
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

    const defaultQuery = roomObject.name;
    setCatalogQuery(defaultQuery);
    if (!hasSelectedMaterial) {
      onSearchCatalog(roomObject.id, defaultQuery);
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
    setLinkError("");
    setIsFetchingLinkPreview(false);
    setLinkPreviewMessage("");
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

  const selectedOption = useMemo(() => {
    if (!roomObject?.selectedProductId) {
      return undefined;
    }
    return roomObject.productOptions.find((option) => option.id === roomObject.selectedProductId);
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
    });

    setLinkUrl("");
    setLinkName("");
    setLinkSupplier("");
    setLinkPrice("");
    setLinkImageUrl("");
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
        {selectedOption ? (
          <div className="space-y-3 rounded-xl border border-emerald-200 bg-emerald-50/50 p-3 shadow-sm">
            <div className="flex items-start justify-between gap-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700">Selected material</p>
              <Button type="button" size="sm" variant="outline" onClick={handleShowSearchAlternatives}>
                Search alternatives
              </Button>
            </div>
            <ProductOptionCard option={selectedOption} isSelected onSelect={() => onSelectProduct(selectedOption.id)} />
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
                  onSelect={() => handleSelectProductOption(option.id)}
                />
              ))}
            </div>
          )
        ) : null}
      </CardContent>
    </Card>
  );
}

