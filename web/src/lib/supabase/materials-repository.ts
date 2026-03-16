import { resolveBudgetCategory } from "@/lib/mock/budget";
import { isSupabaseConfigured, supabase } from "@/lib/supabase/client";
import { ProductOption } from "@/types";

interface MaterialRow {
  id: string;
  name: string;
  supplier_name: string | null;
  price: number | null;
  lead_time_days: number | null;
  budget_category: string;
  sku: string | null;
  source_type: string;
  source_url: string | null;
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
): ProductOption {
  return {
    id: row.id,
    name: row.name,
    supplier: row.supplier_name ?? "Private Material",
    price: Math.max(0, Math.round(row.price ?? 0)),
    leadTimeDays: Math.max(0, Math.round(row.lead_time_days ?? 0)),
    budgetCategory: normalizeBudgetCategory(row.budget_category, objectName, objectCategory),
    sku: row.sku ?? undefined,
    sourceType: row.source_type === "link" ? "link" : "catalog",
    sourceUrl: row.source_url ?? undefined,
    imageUrl,
  };
}

function toUserMaterial(row: MaterialRow, imageUrl?: string): UserMaterial {
  return {
    ...toProductOption(row, row.name, row.name, imageUrl),
    updatedAt: row.updated_at ?? undefined,
  };
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

function getSafeQueryPattern(query: string): string {
  const sanitized = query.trim().replace(/[,%]/g, " ").replace(/\s+/g, " ");
  return `%${sanitized}%`;
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
}: SearchMaterialsInput): Promise<ProductOption[]> {
  if (!isSupabaseConfigured) {
    return [];
  }

  let request = supabase
    .from("materials")
    .select("id,name,supplier_name,price,lead_time_days,budget_category,sku,source_type,source_url")
    .order("updated_at", { ascending: false })
    .limit(limit);

  const trimmedQuery = query.trim();
  if (trimmedQuery) {
    const pattern = getSafeQueryPattern(trimmedQuery);
    request = request.or(
      `name.ilike.${pattern},description.ilike.${pattern},supplier_name.ilike.${pattern},sku.ilike.${pattern}`
    );
  }

  const { data, error } = await request;
  if (error) {
    throw new Error(error.message);
  }

  const rows = (data ?? []) as MaterialRow[];
  const imageMap = await loadPrimaryImageMap(rows.map((row) => row.id));
  return rows.map((row) => toProductOption(row, objectName, objectCategory, imageMap[row.id]));
}

export async function listMaterialsForCurrentUser(limit = 200): Promise<UserMaterial[]> {
  if (!isSupabaseConfigured) {
    return [];
  }

  const { data, error } = await supabase
    .from("materials")
    .select("id,name,supplier_name,price,lead_time_days,budget_category,sku,source_type,source_url,updated_at")
    .order("updated_at", { ascending: false })
    .limit(limit);

  if (error) {
    throw new Error(error.message);
  }

  const rows = (data ?? []) as MaterialRow[];
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
}: AddLinkMaterialInput): Promise<ProductOption> {
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

  const { data: existingRows, error: existingError } = await supabase
    .from("materials")
    .select("id,name,supplier_name,price,lead_time_days,budget_category,sku,source_type,source_url")
    .eq("owner_user_id", user.id)
    .eq("source_url", parsedUrl.toString())
    .limit(1);

  if (existingError) {
    throw new Error(existingError.message);
  }

  const existingRow = (existingRows ?? [])[0] as MaterialRow | undefined;
  if (existingRow) {
    if (normalizedImageUrl) {
      await ensureMaterialImage(existingRow.id, normalizedImageUrl);
    }
    const imageMap = await loadPrimaryImageMap([existingRow.id]);
    return toProductOption(existingRow, objectName, objectCategory, imageMap[existingRow.id]);
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
  };

  const { data, error } = await supabase
    .from("materials")
    .insert(payload)
    .select("id,name,supplier_name,price,lead_time_days,budget_category,sku,source_type,source_url")
    .single();

  if (error) {
    throw new Error(error.message);
  }

  const insertedRow = data as MaterialRow;
  if (normalizedImageUrl) {
    await ensureMaterialImage(insertedRow.id, normalizedImageUrl);
  }
  const imageMap = await loadPrimaryImageMap([insertedRow.id]);
  return toProductOption(insertedRow, objectName, objectCategory, imageMap[insertedRow.id]);
}
