"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { isSupabaseConfigured, supabase } from "@/lib/supabase/client";
import { listMaterialsForCurrentUser } from "@/lib/supabase/materials-repository";
import type { UserMaterial } from "@/lib/supabase/materials-repository";
import { LibraryPage } from "./library-page";
import { SAMPLE_LIBRARY } from "./mockup-data";
import type { LibraryProduct, ProductCategory } from "./mockup-data";

// ── Adapter ────────────────────────────────────────────────────────────────

const IMAGE_PALETTE: string[] = [
  "bg-slate-200",
  "bg-stone-200",
  "bg-amber-100",
  "bg-teal-200",
  "bg-rose-200",
  "bg-blue-100",
  "bg-violet-100",
  "bg-emerald-100",
];

function pickImageColor(id: string): string {
  const code = id.charCodeAt(0);
  return IMAGE_PALETTE[code % IMAGE_PALETTE.length] ?? "bg-slate-200";
}

function mapBudgetCategoryToProductCategory(budgetCategory: string): ProductCategory {
  switch (budgetCategory) {
    case "Furniture":
      return "Furniture";
    case "Lighting":
      return "Lighting";
    case "Tiles":
      return "Flooring";
    case "Bathroom":
      return "Bathroom";
    case "Kitchen":
      return "Kitchen";
    case "Decor":
      return "Wall finish";
    default:
      return "Furniture";
  }
}

function adaptMaterialToLibraryProduct(material: UserMaterial): LibraryProduct {
  return {
    id: material.id,
    name: material.name,
    supplier: material.supplier ?? "Unknown",
    category: mapBudgetCategoryToProductCategory(material.budgetCategory),
    roomTypes: [],
    style: "Modern",
    priceUsd: material.price ?? 0,
    imageColor: pickImageColor(material.id),
    tags: material.tags ?? [],
  };
}

// ── Component ──────────────────────────────────────────────────────────────

type LoadState =
  | { kind: "loading" }
  | { kind: "ready"; products: LibraryProduct[]; isFallback: boolean };

export function RealLibraryPage() {
  const router = useRouter();
  const [state, setState] = useState<LoadState>({ kind: "loading" });

  useEffect(() => {
    let cancelled = false;

    async function load() {
      if (isSupabaseConfigured) {
        const {
          data: { session },
        } = await supabase.auth.getSession();

        if (cancelled) return;

        if (!session) {
          router.replace("/login");
          return;
        }
      }

      const materials = await listMaterialsForCurrentUser();
      if (cancelled) return;

      if (materials.length === 0) {
        setState({ kind: "ready", products: SAMPLE_LIBRARY, isFallback: true });
      } else {
        const products = materials.map(adaptMaterialToLibraryProduct);
        setState({ kind: "ready", products, isFallback: false });
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [router]);

  if (state.kind === "loading") {
    return (
      <div className="flex h-screen items-center justify-center bg-slate-50">
        <div className="flex flex-col items-center gap-3 text-slate-500">
          <Loader2 className="h-8 w-8 animate-spin" />
          <p className="text-sm">Loading your materials library…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen">
      {state.isFallback && (
        <div className="shrink-0 flex items-center justify-center gap-2 bg-blue-50 border-b border-blue-200 px-4 py-2 text-xs text-blue-700">
          <span className="h-1.5 w-1.5 rounded-full bg-blue-400 inline-block" />
          Showing sample products — your saved materials will appear here once you add some.
        </div>
      )}
      <div className="flex-1 min-h-0">
        <LibraryPage products={state.products} shortlists={[]} />
      </div>
    </div>
  );
}
