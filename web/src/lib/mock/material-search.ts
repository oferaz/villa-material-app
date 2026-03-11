import { ProductOption } from "@/types";

interface LinkProductInput {
  objectName: string;
  url: string;
  name?: string;
  supplier?: string;
  price?: number;
}

function toSlug(input: string): string {
  return input
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function hashSeed(value: string): number {
  let hash = 0;
  for (let i = 0; i < value.length; i += 1) {
    hash = (hash * 33 + value.charCodeAt(i)) % 100000;
  }
  return hash;
}

const suppliers = [
  "Atelier Living",
  "Nordic House",
  "Stone Form",
  "Madera Works",
  "Urban Foundry",
  "Lumen Studio",
  "Aqua Systems",
  "Linea Habitat",
];

const styleLabels = ["Catalog", "Studio", "Essential", "Signature", "Premium"];

function inferBasePriceFromQuery(query: string): number {
  const q = query.toLowerCase();

  if (/(marble|stone|travertine|granite|quartz)/.test(q)) {
    return 32000;
  }
  if (/(oak|walnut|wood|veneer|timber)/.test(q)) {
    return 22000;
  }
  if (/(linen|velvet|fabric|textile|rug|curtain)/.test(q)) {
    return 14500;
  }
  if (/(brass|chrome|black|metal|steel)/.test(q)) {
    return 17500;
  }
  if (/(tile|ceramic|porcelain|mosaic)/.test(q)) {
    return 12800;
  }
  return 16000;
}

export function searchMockCatalogOptions(objectName: string, rawQuery: string): ProductOption[] {
  const query = rawQuery.trim() || objectName;
  const normalized = query.toLowerCase();
  const queryTokens = normalized.split(/\s+/).filter(Boolean);
  const hash = hashSeed(`${objectName}:${normalized}`);
  const optionCount = 4;
  const basePrice = inferBasePriceFromQuery(query) + objectName.length * 130;

  return Array.from({ length: optionCount }, (_, index) => {
    const supplier = suppliers[(hash + index) % suppliers.length];
    const label = styleLabels[(hash + index) % styleLabels.length];
    const keyWord = queryTokens[index % queryTokens.length] ?? objectName.toLowerCase();
    const price = Math.max(2200, Math.round((basePrice * (0.82 + index * 0.13)) / 100) * 100);
    const leadTimeDays = 8 + ((hash + index * 11) % 30);

    return {
      id: `db-${toSlug(objectName)}-${toSlug(normalized)}-${index + 1}-${hash}`,
      name: `${label} ${objectName} ${keyWord}`.replace(/\s+/g, " ").trim(),
      supplier,
      price,
      leadTimeDays,
      sku: `${toSlug(objectName).toUpperCase()}-${(hash + index * 17).toString().slice(-4)}`,
      sourceType: "catalog",
      sourceUrl: `https://catalog.example.com/search?q=${encodeURIComponent(query)}`,
    };
  });
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

export function buildProductOptionFromLink({ objectName, url, name, supplier, price }: LinkProductInput): ProductOption {
  const safeName = name?.trim() || `${objectName} from link`;
  const safeSupplier = supplier?.trim() || deriveSupplierFromUrl(url);
  const safePrice = price && Number.isFinite(price) && price > 0 ? Math.round(price) : 0;
  const hash = hashSeed(`${safeName}:${url}`);

  return {
    id: `link-${toSlug(objectName)}-${hash}-${Date.now()}`,
    name: safeName,
    supplier: safeSupplier,
    price: safePrice,
    leadTimeDays: 0,
    sku: `LINK-${hash.toString().slice(-4)}`,
    sourceType: "link",
    sourceUrl: url,
  };
}
