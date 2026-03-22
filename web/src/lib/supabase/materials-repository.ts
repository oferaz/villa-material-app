import { resolveBudgetCategory } from "@/lib/mock/budget";
import {
  normalizeMaterialTags,
  rankMaterialsForObject,
} from "@/lib/material-search";
import { isSupabaseConfigured, supabase } from "@/lib/supabase/client";
import { ProductOption } from "@/types";

interface MaterialRow {
  id: string;
  name: string;
  supplier_name: string | null;
  description: string | null;
  price: number | null;
  lead_time_days: number | null;
  budget_category: string;
  sku: string | null;
  source_type: string;
  source_url: string | null;
  tags?: string[] | null;
  updated_at?: string | null;
}

interface MaterialImageRow {
  material_id: string;
  image_url: string;
  sort_order: number | null;
  created_at: string | null;
}

interface SearchMaterialsInput {
  objectName: string;
  objectCategory?: string;
  query: string;
  limit?: number;
}

interface AddLinkMaterialInput {
  objectName: string;
  objectCategory?: string;
  url: string;
  name?: string;
  supplier?: string;
  price?: number;
  imageUrl?: string;
  tags?: string[];
}

export interface UserMaterial extends ProductOption {
  updatedAt?: string;
}

const budgetCategorySet = new Set([
  "Furniture",
  "Lighting",
  "Tiles",
  "Bathroom",
  "Kitchen",
  "Decor",
]);

function hasMissingMaterialTagsColumnError(code?: string, message?: string): boolean {
  if (code === "42703" || code === "PGRST204") {
    return true;
  }
  return (message ?? "").toLowerCase().includes("tags");
}

function normalizeBudgetCategory(
  storedCategory: string | null | undefined,
  objectName: string,
  objectCategory?: string
): ProductOption["budgetCategory"] {
  if (storedCategory && budgetCategorySet.has(storedCategory)) {
    return storedCategory as ProductOption["budgetCategory"];
  }
  return resolveBudgetCategory(objectName, objectCategory ?? objectName);
}

function toProductOption(
  row: MaterialRow,
  objectName: string,
  objectCategory?: string,
  imageUrl?: string
): UserMaterial {
  return {
    id: row.id,
    name: row.name,
    supplier: row.supplier_name ?? "Private Material",
    description: row.description ?? undefined,
    price: Math.max(0, Math.round(row.price ?? 0)),
    leadTimeDays: Math.max(0, Math.round(row.lead_time_days ?? 0)),
    budgetCategory: normalizeBudgetCategory(row.budget_category, objectName, objectCategory),
    sku: row.sku ?? undefined,
    sourceType: row.source_type === "link" ? "link" : "catalog",
    sourceUrl: row.source_url ?? undefined,
    imageUrl,
    tags: normalizeMaterialTags(row.tags ?? []),
    updatedAt: row.updated_at ?? undefined,
  };
}

function toUserMaterial(row: MaterialRow, imageUrl?: string): UserMaterial {
  return toProductOption(row, row.name, row.name, imageUrl);
}

function deriveSupplierFromUrl(url: string): string {
  try {
    const hostname = new URL(url).hostname.replace(/^www\./, "");
    const firstPart = hostname.split(".")[0] || "web";
    return firstPart
      .split("-")
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(" ");
  } catch {
    return "Web Source";
  }
}

function materialSelect(withTags: boolean): string {
  const base = "id,name,supplier_name,description,price,lead_time_days,budget_category,sku,source_type,source_url,updated_at";
  return withTags ? `${base},tags` : base;
}

async function loadPrimaryImageMap(materialIds: string[]): Promise<Record<string, string>> {
  if (materialIds.length === 0) {
    return {};
  }

  const { data, error } = await supabase
    .from("material_images")
    .select("material_id,image_url,sort_order,created_at")
    .in("material_id", materialIds)
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true });
  if (error) {
    throw new Error(error.message);
  }

  const imageRows = (data ?? []) as MaterialImageRow[];
  const imageMap: Record<string, string> = {};
  for (const imageRow of imageRows) {
    if (!imageMap[imageRow.material_id]) {
      imageMap[imageRow.material_id] = imageRow.image_url;
    }
  }
  return imageMap;
}

async function listVisibleMaterialRows(limit: number | null = null): Promise<MaterialRow[]> {
  const pageSize = typeof limit === "number" && Number.isFinite(limit) && limit > 0 ? Math.min(limit, 250) : 250;
  let from = 0;
  const rows: MaterialRow[] = [];
  let includeTags = true;

  while (true) {
    const to = from + pageSize - 1;
    const request = supabase
      .from("materials")
      .select(materialSelect(includeTags))
      .order("updated_at", { ascending: false })
      .range(from, to);
    const { data, error } = await request;

    if (error) {
      if (includeTags && hasMissingMaterialTagsColumnError(error.code, error.message)) {
        includeTags = false;
        from = 0;
        rows.length = 0;
        continue;
      }
      throw new Error(error.message);
    }

    const batch = (data ?? []) as unknown as MaterialRow[];
    rows.push(...batch);

    if (batch.length < pageSize) {
      break;
    }
    if (limit !== null && rows.length >= limit) {
      break;
    }

    from += pageSize;
  }

  return limit !== null ? rows.slice(0, limit) : rows;
}

async function ensureMaterialImage(materialId: string, imageUrl: string): Promise<void> {
  const trimmedImageUrl = imageUrl.trim();
  if (!trimmedImageUrl) {
    return;
  }

  let parsedImageUrl: URL;
  try {
    parsedImageUrl = new URL(trimmedImageUrl);
  } catch {
    throw new Error("Please enter a valid image URL.");
  }

  const normalizedImageUrl = parsedImageUrl.toString();

  const { data: existingRows, error: existingError } = await supabase
    .from("material_images")
    .select("material_id,image_url,sort_order,created_at")
    .eq("material_id", materialId)
    .eq("image_url", normalizedImageUrl)
    .limit(1);
  if (existingError) {
    throw new Error(existingError.message);
  }
  if ((existingRows ?? []).length > 0) {
    return;
  }

  const { data: latestRows, error: latestError } = await supabase
    .from("material_images")
    .select("material_id,image_url,sort_order,created_at")
    .eq("material_id", materialId)
    .order("sort_order", { ascending: false })
    .limit(1);
  if (latestError) {
    throw new Error(latestError.message);
  }
  const nextSortOrder = ((latestRows?.[0]?.sort_order as number | null | undefined) ?? -1) + 1;

  const { error: insertError } = await supabase.from("material_images").insert({
    material_id: materialId,
    image_url: normalizedImageUrl,
    sort_order: nextSortOrder,
  });
  if (insertError) {
    throw new Error(insertError.message);
  }
}

export async function searchMaterialsForCurrentUser({
  objectName,
  objectCategory,
  query,
  limit = 30,
}: SearchMaterialsInput): Promise<UserMaterial[]> {
  if (!isSupabaseConfigured) {
    return [];
  }

  const allMaterials = await listMaterialsForCurrentUser();
  return rankMaterialsForObject(allMaterials, {
    query,
    objectName,
    objectCategory,
    limit,
  });
}

export async function listMaterialsForCurrentUser(limit: number | null = null): Promise<UserMaterial[]> {
  if (!isSupabaseConfigured) {
    return [];
  }

  const rows = await listVisibleMaterialRows(limit);
  const imageMap = await loadPrimaryImageMap(rows.map((row) => row.id));
  return rows.map((row) => toUserMaterial(row, imageMap[row.id]));
}

export async function deleteMaterialForCurrentUser(materialId: string): Promise<void> {
  if (!isSupabaseConfigured) {
    throw new Error("Supabase is not configured.");
  }

  const normalizedId = materialId.trim();
  if (!normalizedId) {
    throw new Error("Material ID is required.");
  }

  const { error } = await supabase.from("materials").delete().eq("id", normalizedId);
  if (error) {
    throw new Error(error.message);
  }
}

export async function addLinkMaterialForCurrentUser({
  objectName,
  objectCategory,
  url,
  name,
  supplier,
  price,
  imageUrl,
  tags,
}: AddLinkMaterialInput): Promise<UserMaterial> {
  if (!isSupabaseConfigured) {
    throw new Error("Supabase is not configured.");
  }

  const trimmedUrl = url.trim();
  if (!trimmedUrl) {
    throw new Error("URL is required.");
  }

  let parsedUrl: URL;
  try {
    parsedUrl = new URL(trimmedUrl);
  } catch {
    throw new Error("Please enter a valid URL.");
  }

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();
  if (userError) {
    throw new Error(userError.message);
  }
  if (!user) {
    throw new Error("Sign in is required.");
  }

  const normalizedName = name?.trim() || `${objectName} from link`;
  const normalizedSupplier = supplier?.trim() || deriveSupplierFromUrl(parsedUrl.toString());
  const normalizedPrice =
    typeof price === "number" && Number.isFinite(price) && price > 0 ? Math.round(price) : null;
  const normalizedImageUrl = imageUrl?.trim() || "";
  const normalizedTags = normalizeMaterialTags(tags ?? []);

  const existingRequest = supabase
    .from("materials")
    .select(materialSelect(true))
    .eq("owner_user_id", user.id)
    .eq("source_url", parsedUrl.toString())
    .limit(1);
  let existingRows: MaterialRow[] | null = null;
  let existingError: Error | null = null;

  const existingResult = await existingRequest;
  if (existingResult.error) {
    if (hasMissingMaterialTagsColumnError(existingResult.error.code, existingResult.error.message)) {
      const fallbackResult = await supabase
        .from("materials")
        .select(materialSelect(false))
        .eq("owner_user_id", user.id)
        .eq("source_url", parsedUrl.toString())
        .limit(1);
      if (fallbackResult.error) {
        existingError = new Error(fallbackResult.error.message);
      } else {
        existingRows = (fallbackResult.data ?? []) as unknown as MaterialRow[];
      }
    } else {
      existingError = new Error(existingResult.error.message);
    }
  } else {
    existingRows = (existingResult.data ?? []) as unknown as MaterialRow[];
  }

  if (existingError) {
    throw existingError;
  }

  const existingRow = (existingRows ?? [])[0] as MaterialRow | undefined;
  if (existingRow) {
    if (normalizedImageUrl) {
      await ensureMaterialImage(existingRow.id, normalizedImageUrl);
    }
    if (normalizedTags.length > 0) {
      const mergedTags = normalizeMaterialTags([...(existingRow.tags ?? []), ...normalizedTags]);
      const { error: updateError } = await supabase
        .from("materials")
        .update({ tags: mergedTags })
        .eq("id", existingRow.id);
      if (!updateError || hasMissingMaterialTagsColumnError(updateError.code, updateError.message)) {
        existingRow.tags = mergedTags;
      } else {
        throw new Error(updateError.message);
      }
    }
    const imageMap = await loadPrimaryImageMap([existingRow.id]);
    return toUserMaterial(existingRow, imageMap[existingRow.id]);
  }

  const payload = {
    owner_user_id: user.id,
    supplier_name: normalizedSupplier || null,
    name: normalizedName,
    description: null,
    budget_category: resolveBudgetCategory(normalizedName, objectCategory ?? objectName),
    price: normalizedPrice,
    currency: "USD",
    lead_time_days: null,
    sku: null,
    source_type: "link",
    source_url: parsedUrl.toString(),
    is_private: true,
    tags: normalizedTags,
  };

  let data: MaterialRow | null = null;
  const insertResult = await supabase
    .from("materials")
    .insert(payload)
    .select(materialSelect(true))
    .single();
  let error = insertResult.error;
  data = (insertResult.data as unknown as MaterialRow | null) ?? null;

  if (error && hasMissingMaterialTagsColumnError(error.code, error.message)) {
    const fallbackResult = await supabase
      .from("materials")
      .insert({ ...payload, tags: undefined })
      .select(materialSelect(false))
      .single();
    error = fallbackResult.error;
    data = (fallbackResult.data as unknown as MaterialRow | null) ?? null;
  }

  if (error) {
    throw new Error(error.message);
  }

  const insertedRow = data as MaterialRow;
  insertedRow.tags = normalizedTags;
  if (normalizedImageUrl) {
    await ensureMaterialImage(insertedRow.id, normalizedImageUrl);
  }
  const imageMap = await loadPrimaryImageMap([insertedRow.id]);
  return toUserMaterial(insertedRow, imageMap[insertedRow.id]);
}
