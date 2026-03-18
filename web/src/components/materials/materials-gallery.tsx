"use client";
/* eslint-disable @next/next/no-img-element */

import { FormEvent, useEffect, useMemo, useState } from "react";
import { Database, ExternalLink, Link2, RefreshCcw, Trash2 } from "lucide-react";
import { isSupabaseConfigured } from "@/lib/supabase/client";
import {
  addLinkMaterialForCurrentUser,
  deleteMaterialForCurrentUser,
  listMaterialsForCurrentUser,
  UserMaterial,
} from "@/lib/supabase/materials-repository";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";

interface MaterialsGalleryProps {
  searchQuery: string;
  focusTarget?: {
    houseName: string;
    roomName: string;
    objectName: string;
    objectId: string;
    selectedProductId?: string;
  };
  onAssignMaterial?: (material: UserMaterial) => void;
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

function formatLastUpdated(value?: string): string {
  if (!value) {
    return "Unknown";
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "Unknown";
  }
  return date.toLocaleDateString();
}

export function MaterialsGallery({ searchQuery, focusTarget, onAssignMaterial }: MaterialsGalleryProps) {
  const [materials, setMaterials] = useState<UserMaterial[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isAddLinkOpen, setIsAddLinkOpen] = useState(false);
  const [linkUrl, setLinkUrl] = useState("");
  const [linkName, setLinkName] = useState("");
  const [linkSupplier, setLinkSupplier] = useState("");
  const [linkPrice, setLinkPrice] = useState("");
  const [linkImageUrl, setLinkImageUrl] = useState("");
  const [linkError, setLinkError] = useState("");
  const [linkPreviewMessage, setLinkPreviewMessage] = useState("");
  const [isFetchingLinkPreview, setIsFetchingLinkPreview] = useState(false);
  const [isSavingFromLink, setIsSavingFromLink] = useState(false);

  async function loadMaterials(refresh = false) {
    if (!isSupabaseConfigured) {
      setMaterials([]);
      setIsLoading(false);
      setIsRefreshing(false);
      return;
    }

    if (refresh) {
      setIsRefreshing(true);
    } else {
      setIsLoading(true);
    }
    setError(null);

    try {
      const nextMaterials = await listMaterialsForCurrentUser();
      setMaterials(nextMaterials);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Failed to load materials.");
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }

  useEffect(() => {
    void loadMaterials(false);
  }, []);

  const filteredMaterials = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) {
      return materials;
    }
    return materials.filter((item) => {
      return (
        item.name.toLowerCase().includes(query) ||
        item.supplier.toLowerCase().includes(query) ||
        item.budgetCategory.toLowerCase().includes(query) ||
        (item.sku ?? "").toLowerCase().includes(query) ||
        (item.sourceUrl ?? "").toLowerCase().includes(query)
      );
    });
  }, [materials, searchQuery]);

  async function handleDelete(material: UserMaterial) {
    const confirmed = window.confirm(
      `Delete "${material.name}" from your material library?\n\nAny room object currently using it will be unselected.`
    );
    if (!confirmed) {
      return;
    }

    setDeletingId(material.id);
    try {
      await deleteMaterialForCurrentUser(material.id);
      setMaterials((prev) => prev.filter((item) => item.id !== material.id));
    } catch (deleteError) {
      window.alert(deleteError instanceof Error ? deleteError.message : "Failed to delete material.");
    } finally {
      setDeletingId(null);
    }
  }

  function resetLinkForm() {
    setLinkUrl("");
    setLinkName("");
    setLinkSupplier("");
    setLinkPrice("");
    setLinkImageUrl("");
    setLinkError("");
    setLinkPreviewMessage("");
    setIsFetchingLinkPreview(false);
    setIsSavingFromLink(false);
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
        setLinkPreviewMessage("Fetched price from link.");
      } else if (payload.imageFound) {
        setLinkPreviewMessage("Fetched image from link.");
      } else {
        setLinkPreviewMessage(payload.warning ?? "Could not auto-fetch details. You can still add manually.");
      }
      return true;
    } catch (fetchError) {
      setLinkError(fetchError instanceof Error ? fetchError.message : "Failed to fetch link details.");
      return false;
    } finally {
      setIsFetchingLinkPreview(false);
    }
  }

  async function handleAddFromLink(event: FormEvent) {
    event.preventDefault();

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

    const trimmedPrice = linkPrice.trim();
    let parsedPrice: number | undefined;
    if (trimmedPrice) {
      parsedPrice = Number(trimmedPrice);
      if (!Number.isFinite(parsedPrice) || parsedPrice <= 0) {
        setLinkError("Please enter a valid positive price.");
        return;
      }
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

    setLinkError("");
    setIsSavingFromLink(true);
    try {
      await addLinkMaterialForCurrentUser({
        objectName: linkName.trim() || "Link Material",
        url: trimmedUrl,
        name: linkName.trim() || undefined,
        supplier: linkSupplier.trim() || undefined,
        price: parsedPrice,
        imageUrl: trimmedImageUrl || undefined,
      });
      setIsAddLinkOpen(false);
      resetLinkForm();
      await loadMaterials(true);
    } catch (saveError) {
      setLinkError(saveError instanceof Error ? saveError.message : "Failed to save material from link.");
    } finally {
      setIsSavingFromLink(false);
    }
  }

  if (!isSupabaseConfigured) {
    return (
      <Card className="border-slate-200 shadow-sm">
        <CardHeader>
          <CardTitle>Materials Gallery</CardTitle>
          <CardDescription>Enable Supabase to manage your personal materials database.</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <Card className="border-slate-200 shadow-sm">
        <CardHeader className="flex flex-row items-start justify-between gap-3">
          <div>
            <CardTitle className="inline-flex items-center gap-2">
              <Database className="h-4 w-4" />
              My Materials Gallery
            </CardTitle>
            <CardDescription>
              View and remove materials from your personal DB. Added link products appear here automatically.
            </CardDescription>
          </div>
          <div className="flex flex-wrap items-center justify-end gap-2">
            <Button type="button" onClick={() => setIsAddLinkOpen(true)}>
              <Link2 className="h-4 w-4" />
              Add from link
            </Button>
            <Button type="button" variant="outline" onClick={() => void loadMaterials(true)} disabled={isRefreshing}>
              <RefreshCcw className="h-4 w-4" />
              {isRefreshing ? "Refreshing..." : "Refresh"}
            </Button>
          </div>
        </CardHeader>
        <CardContent className="text-xs text-slate-500">
          {materials.length} total materials
          {searchQuery.trim() ? ` - ${filteredMaterials.length} matching "${searchQuery.trim()}"` : ""}
          <div className="mt-2 rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-2 text-[11px] text-slate-600">
            {focusTarget
              ? `Assigning to: ${focusTarget.objectName} (${focusTarget.roomName} / ${focusTarget.houseName})`
              : "Select a room object in the right panel to enable one-click assignment from this gallery."}
          </div>
        </CardContent>
      </Card>

      <Dialog
        open={isAddLinkOpen}
        onOpenChange={(nextOpen) => {
          setIsAddLinkOpen(nextOpen);
          if (!nextOpen) {
            resetLinkForm();
          }
        }}
      >
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle className="inline-flex items-center gap-2">
              <Link2 className="h-4 w-4" />
              Add Material From Link
            </DialogTitle>
            <DialogDescription>
              Paste a product URL to fetch metadata and save it into your personal materials database.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleAddFromLink} className="space-y-3">
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
                placeholder="Price (optional)"
                inputMode="decimal"
              />
            </div>
            <Input
              value={linkImageUrl}
              onChange={(event) => setLinkImageUrl(event.target.value)}
              placeholder="Image URL (optional)"
            />
            {linkPreviewMessage ? <p className="text-xs text-emerald-700">{linkPreviewMessage}</p> : null}
            {linkError ? <p className="text-xs text-red-600">{linkError}</p> : null}
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setIsAddLinkOpen(false);
                  resetLinkForm();
                }}
                disabled={isSavingFromLink}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isSavingFromLink}>
                {isSavingFromLink ? "Adding..." : "Add to Materials"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {error ? (
        <Card className="border-red-200 bg-red-50">
          <CardContent className="py-4 text-sm text-red-700">{error}</CardContent>
        </Card>
      ) : null}

      {isLoading ? (
        <Card className="border-slate-200 shadow-sm">
          <CardContent className="py-6 text-sm text-slate-600">Loading materials...</CardContent>
        </Card>
      ) : null}

      {!isLoading && filteredMaterials.length === 0 ? (
        <Card className="border-slate-200 shadow-sm">
          <CardContent className="py-6 text-sm text-slate-600">
            {searchQuery.trim()
              ? "No materials match your search."
              : "No materials in your DB yet. Add products from link or choose options in rooms."}
          </CardContent>
        </Card>
      ) : null}

      {!isLoading && filteredMaterials.length > 0 ? (
        <section className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {filteredMaterials.map((material) => (
            <Card key={material.id} className="border-slate-200 bg-white shadow-sm">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <CardTitle className="truncate text-base">{material.name}</CardTitle>
                    <CardDescription className="truncate">{material.supplier}</CardDescription>
                  </div>
                  <Badge variant="secondary">{material.budgetCategory}</Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-3 text-xs text-slate-600">
                <div className="h-28 overflow-hidden rounded-lg border border-slate-200 bg-gradient-to-br from-slate-100 to-slate-200">
                  {material.imageUrl ? (
                    <img
                      src={material.imageUrl}
                      alt={material.name}
                      className="h-full w-full object-cover"
                      loading="lazy"
                      referrerPolicy="no-referrer"
                    />
                  ) : null}
                </div>
                <p>{material.price > 0 ? `${material.price.toLocaleString()} per unit` : "Price on request"}</p>
                <p>Updated: {formatLastUpdated(material.updatedAt)}</p>
                <div className="flex items-center gap-2">
                  {material.sourceType ? <Badge variant="outline">{material.sourceType}</Badge> : null}
                  {material.sku ? <Badge variant="outline">{material.sku}</Badge> : null}
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant={focusTarget?.selectedProductId === material.id ? "secondary" : "default"}
                    onClick={() => onAssignMaterial?.(material)}
                    disabled={!focusTarget || !onAssignMaterial}
                  >
                    {focusTarget?.selectedProductId === material.id ? "Assigned" : "Assign"}
                  </Button>
                  {material.sourceUrl ? (
                    <Button type="button" variant="outline" size="sm" asChild>
                      <a href={material.sourceUrl} target="_blank" rel="noreferrer">
                        <ExternalLink className="h-3.5 w-3.5" />
                        Open
                      </a>
                    </Button>
                  ) : null}
                  <Button
                    type="button"
                    variant="destructive"
                    size="sm"
                    onClick={() => void handleDelete(material)}
                    disabled={deletingId === material.id}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    {deletingId === material.id ? "Deleting..." : "Delete"}
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </section>
      ) : null}
    </div>
  );
}
