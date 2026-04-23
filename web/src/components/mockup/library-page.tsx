"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { Search, Star, ArrowLeft, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import {
  SAMPLE_LIBRARY,
  SAMPLE_SHORTLISTS,
  SAMPLE_PROJECT,
  filterLibrary,
  formatMoney,
  type ProductCategory,
  type ProductStyle,
  type LibraryProduct,
  type Shortlist,
} from "@/components/mockup/mockup-data";

const CATEGORIES: ProductCategory[] = [
  "Flooring",
  "Wall finish",
  "Bathroom",
  "Kitchen",
  "Lighting",
  "Furniture",
  "Hardware",
  "Outdoor",
];

const STYLES: ProductStyle[] = ["Modern", "Classic", "Industrial", "Coastal", "Japandi"];

type PriceFilter = "all" | "under500" | "500to2k" | "2kto5k" | "over5k";

const PRICE_FILTER_LABELS: Record<PriceFilter, string> = {
  all: "All prices",
  under500: "Under $500",
  "500to2k": "$500–$2k",
  "2kto5k": "$2k–$5k",
  over5k: "Over $5k",
};

type SidebarSelection = "all" | "recent" | "used" | string;

interface LibraryPageProps {
  products?: LibraryProduct[];
  shortlists?: Shortlist[];
}

export function LibraryPage({ products: productsProp, shortlists: shortlistsProp }: LibraryPageProps = {}) {
  const allProducts = productsProp ?? SAMPLE_LIBRARY;
  const allShortlists = shortlistsProp ?? SAMPLE_SHORTLISTS;
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<ProductCategory | null>(null);
  const [styleFilter, setStyleFilter] = useState<ProductStyle | null>(null);
  const [priceFilter, setPriceFilter] = useState<PriceFilter>("all");
  const [sidebarSelection, setSidebarSelection] = useState<SidebarSelection>("all");
  const [starredIds, setStarredIds] = useState<Set<string>>(new Set());
  const [showNewShortlistInput, setShowNewShortlistInput] = useState(false);
  const [newShortlistName, setNewShortlistName] = useState("");

  const priceRange = useMemo(() => {
    const ranges: Record<PriceFilter, { min: number | null; max: number | null }> = {
      all: { min: null, max: null },
      under500: { min: null, max: 500 },
      "500to2k": { min: 500, max: 2000 },
      "2kto5k": { min: 2000, max: 5000 },
      over5k: { min: 5000, max: null },
    };
    return ranges[priceFilter];
  }, [priceFilter]);

  const shortlistId = useMemo(() => {
    if (
      typeof sidebarSelection === "string" &&
      sidebarSelection !== "all" &&
      sidebarSelection !== "recent" &&
      sidebarSelection !== "used"
    ) {
      return sidebarSelection;
    }
    return null;
  }, [sidebarSelection]);

  const filtered = useMemo<LibraryProduct[]>(() => {
    let result = filterLibrary(allProducts, {
      search,
      category: categoryFilter,
      style: styleFilter,
      shortlistId,
      shortlists: allShortlists,
      minPriceUsd: priceRange.min,
      maxPriceUsd: priceRange.max,
    });

    if (sidebarSelection === "recent") {
      result = allProducts.slice(-6);
    }

    if (sidebarSelection === "used") {
      const usedNames = new Set<string>();
      for (const house of SAMPLE_PROJECT.houses) {
        for (const room of house.rooms) {
          for (const obj of room.objects) {
            if (obj.selectedProduct) usedNames.add(obj.selectedProduct.name);
          }
        }
      }
      result = result.filter((p) => usedNames.has(p.name));
    }

    return result;
  }, [search, categoryFilter, styleFilter, shortlistId, priceRange, sidebarSelection, allProducts, allShortlists]);

  function toggleStar(id: string) {
    setStarredIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }

  function handleNewShortlistSubmit() {
    setNewShortlistName("");
    setShowNewShortlistInput(false);
  }

  return (
    <div className="flex flex-col h-screen bg-slate-50">
      {/* Topbar */}
      <header className="sticky top-0 z-10 h-14 flex items-center justify-between px-4 border-b border-slate-200 bg-white">
        <Button variant="ghost" size="sm" asChild>
          <Link href="/mockup" className="flex items-center gap-1.5 text-slate-600">
            <ArrowLeft className="h-4 w-4" />
            Canvas
          </Link>
        </Button>
        <h1 className="text-lg font-semibold text-slate-900">Materials Library</h1>
        <div className="flex items-center gap-2">
          <Input
            placeholder="Paste link to import…"
            className="w-48 h-8 text-sm"
            disabled
          />
          <Button size="sm" disabled>
            Import
          </Button>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar */}
        <aside className="w-56 flex-shrink-0 border-r border-slate-200 bg-white overflow-y-auto flex flex-col">
          <nav className="flex-1 px-2 py-4 space-y-0.5">
            {/* All products */}
            <button
              onClick={() => setSidebarSelection("all")}
              className={cn(
                "w-full text-left px-3 py-2 rounded-md text-sm transition-colors",
                sidebarSelection === "all"
                  ? "bg-blue-50 text-blue-700 font-medium"
                  : "text-slate-600 hover:bg-slate-50"
              )}
            >
              All products
            </button>

            {/* Shortlists section */}
            <div className="pt-3 pb-1 px-3">
              <span className="text-xs font-semibold text-slate-400 uppercase tracking-wide">
                Shortlists
              </span>
            </div>
            {allShortlists.map((shortlist) => (
              <button
                key={shortlist.id}
                onClick={() => setSidebarSelection(shortlist.id)}
                className={cn(
                  "w-full text-left px-3 py-2 rounded-md text-sm transition-colors truncate",
                  sidebarSelection === shortlist.id
                    ? "bg-blue-50 text-blue-700 font-medium"
                    : "text-slate-600 hover:bg-slate-50"
                )}
              >
                {shortlist.name}
              </button>
            ))}

            {/* Separator */}
            <div className="my-2 border-t border-slate-100" />

            {/* Recently added */}
            <button
              onClick={() => setSidebarSelection("recent")}
              className={cn(
                "w-full text-left px-3 py-2 rounded-md text-sm transition-colors",
                sidebarSelection === "recent"
                  ? "bg-blue-50 text-blue-700 font-medium"
                  : "text-slate-600 hover:bg-slate-50"
              )}
            >
              Recently added
            </button>

            {/* Used in projects */}
            <button
              onClick={() => setSidebarSelection("used")}
              className={cn(
                "w-full text-left px-3 py-2 rounded-md text-sm transition-colors",
                sidebarSelection === "used"
                  ? "bg-blue-50 text-blue-700 font-medium"
                  : "text-slate-600 hover:bg-slate-50"
              )}
            >
              Used in projects
            </button>

            {/* Separator */}
            <div className="my-2 border-t border-slate-100" />

            {/* New shortlist */}
            <button
              onClick={() => setShowNewShortlistInput((v) => !v)}
              className="w-full text-left px-3 py-2 rounded-md text-sm text-blue-600 hover:bg-blue-50 transition-colors flex items-center gap-1.5"
            >
              <Plus className="h-3.5 w-3.5" />
              New shortlist
            </button>
            {showNewShortlistInput && (
              <div className="px-3 pb-2 space-y-1.5">
                <Input
                  value={newShortlistName}
                  onChange={(e) => setNewShortlistName(e.target.value)}
                  placeholder="List name…"
                  className="h-7 text-sm"
                  autoFocus
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleNewShortlistSubmit();
                    if (e.key === "Escape") {
                      setShowNewShortlistInput(false);
                      setNewShortlistName("");
                    }
                  }}
                />
                <div className="flex gap-1.5">
                  <Button
                    size="sm"
                    className="h-6 text-xs px-2"
                    onClick={handleNewShortlistSubmit}
                  >
                    Add
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-6 text-xs px-2"
                    onClick={() => {
                      setShowNewShortlistInput(false);
                      setNewShortlistName("");
                    }}
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            )}
          </nav>
        </aside>

        {/* Main area */}
        <main className="flex-1 overflow-y-auto px-6 py-4">
          {/* Search + Style + Price row */}
          <div className="flex flex-wrap items-center gap-3 mb-4">
            {/* Search */}
            <div className="relative flex-1 min-w-48 max-w-sm">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search products…"
                className="pl-8 h-9"
              />
            </div>

            {/* Style chips */}
            <div className="flex items-center gap-1.5 flex-wrap">
              <button
                onClick={() => setStyleFilter(null)}
                className={cn(
                  "px-3 py-1.5 rounded-full text-xs font-medium border transition-colors",
                  styleFilter === null
                    ? "bg-slate-800 text-white border-slate-800"
                    : "border-slate-200 text-slate-600 hover:border-slate-300 bg-white"
                )}
              >
                All styles
              </button>
              {STYLES.map((style) => (
                <button
                  key={style}
                  onClick={() => setStyleFilter(styleFilter === style ? null : style)}
                  className={cn(
                    "px-3 py-1.5 rounded-full text-xs font-medium border transition-colors",
                    styleFilter === style
                      ? "bg-slate-800 text-white border-slate-800"
                      : "border-slate-200 text-slate-600 hover:border-slate-300 bg-white"
                  )}
                >
                  {style}
                </button>
              ))}
            </div>

            {/* Price select */}
            <select
              value={priceFilter}
              onChange={(e) => setPriceFilter(e.target.value as PriceFilter)}
              className="rounded-md border border-slate-200 px-2 py-1.5 text-sm bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-slate-300"
            >
              {(Object.keys(PRICE_FILTER_LABELS) as PriceFilter[]).map((key) => (
                <option key={key} value={key}>
                  {PRICE_FILTER_LABELS[key]}
                </option>
              ))}
            </select>
          </div>

          {/* Category chips row */}
          <div className="flex items-center gap-1.5 mb-4 overflow-x-auto pb-1">
            <button
              onClick={() => setCategoryFilter(null)}
              className={cn(
                "flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-medium border transition-colors",
                categoryFilter === null
                  ? "bg-blue-600 text-white border-blue-600"
                  : "border-slate-200 text-slate-600 hover:border-slate-300 bg-white"
              )}
            >
              All
            </button>
            {CATEGORIES.map((cat) => (
              <button
                key={cat}
                onClick={() => setCategoryFilter(categoryFilter === cat ? null : cat)}
                className={cn(
                  "flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-medium border transition-colors",
                  categoryFilter === cat
                    ? "bg-blue-600 text-white border-blue-600"
                    : "border-slate-200 text-slate-600 hover:border-slate-300 bg-white"
                )}
              >
                {cat}
              </button>
            ))}
          </div>

          {/* Count */}
          <p className="text-xs text-slate-500 mb-4">
            Showing {filtered.length} of {allProducts.length} products
          </p>

          {/* Product grid */}
          {filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-24 text-slate-400">
              <Search className="h-10 w-10 mb-3 opacity-40" />
              <p className="text-sm font-medium">No products match your filters</p>
              <p className="text-xs mt-1">Try adjusting your search or filter criteria</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-4">
              {filtered.map((product) => (
                <ProductCard
                  key={product.id}
                  product={product}
                  isStarred={starredIds.has(product.id)}
                  onToggleStar={() => toggleStar(product.id)}
                />
              ))}
            </div>
          )}
        </main>
      </div>
    </div>
  );
}

interface ProductCardProps {
  product: LibraryProduct;
  isStarred: boolean;
  onToggleStar: () => void;
}

function ProductCard({ product, isStarred, onToggleStar }: ProductCardProps) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white overflow-hidden shadow-sm hover:shadow-md transition-shadow">
      {/* Thumbnail */}
      <div className={cn("relative h-40 flex items-center justify-center", product.imageColor)}>
        <span className="text-white text-2xl font-bold select-none">
          {product.name.charAt(0).toUpperCase()}
        </span>
        <button
          onClick={onToggleStar}
          aria-label={isStarred ? "Remove from starred" : "Add to starred"}
          className="absolute top-2 right-2 p-1 rounded-full bg-white/80 hover:bg-white transition-colors shadow-sm"
        >
          <Star
            className={cn(
              "h-4 w-4 transition-colors",
              isStarred ? "fill-amber-400 text-amber-400" : "text-slate-400"
            )}
          />
        </button>
      </div>

      {/* Info */}
      <div className="p-3 space-y-1.5">
        <p className="font-medium text-sm text-slate-900 leading-tight line-clamp-1">
          {product.name}
        </p>
        <p className="text-xs text-slate-500">
          {product.supplier} &middot; {formatMoney(product.priceUsd)}
        </p>
        <div className="flex flex-wrap gap-1 pt-0.5">
          <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-slate-100 text-slate-600">
            {product.category}
          </span>
          <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-blue-50 text-blue-600">
            {product.style}
          </span>
        </div>
      </div>
    </div>
  );
}
