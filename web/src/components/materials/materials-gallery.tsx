"use client";
/* eslint-disable @next/next/no-img-element */

import { useEffect, useMemo, useState } from "react";
import { Database, ExternalLink, RefreshCcw, Trash2 } from "lucide-react";
import { isSupabaseConfigured } from "@/lib/supabase/client";
import {
  deleteMaterialForCurrentUser,
  listMaterialsForCurrentUser,
  UserMaterial,
} from "@/lib/supabase/materials-repository";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

interface MaterialsGalleryProps {
  searchQuery: string;
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

export function MaterialsGallery({ searchQuery }: MaterialsGalleryProps) {
  const [materials, setMaterials] = useState<UserMaterial[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

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
          <Button type="button" variant="outline" onClick={() => void loadMaterials(true)} disabled={isRefreshing}>
            <RefreshCcw className="h-4 w-4" />
            {isRefreshing ? "Refreshing..." : "Refresh"}
          </Button>
        </CardHeader>
        <CardContent className="text-xs text-slate-500">
          {materials.length} total materials
          {searchQuery.trim() ? ` - ${filteredMaterials.length} matching "${searchQuery.trim()}"` : ""}
        </CardContent>
      </Card>

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
