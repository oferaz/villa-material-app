import { resolveBudgetCategory } from "@/lib/mock/budget";
import { ProductOption } from "@/types";

const TAG_PREFIXES = ["material", "color", "finish", "style", "room", "use"] as const;

const inferredTagPrefixByValue: Record<string, (typeof TAG_PREFIXES)[number]> = {
  oak: "material",
  walnut: "material",
  wood: "material",
  timber: "material",
  veneer: "material",
  marble: "material",
  travertine: "material",
  quartz: "material",
  granite: "material",
  stone: "material",
  linen: "material",
  velvet: "material",
  boucle: "material",
  leather: "material",
  brass: "material",
  chrome: "material",
  nickel: "material",
  steel: "material",
  black: "color",
  white: "color",
  cream: "color",
  beige: "color",
  taupe: "color",
  gray: "color",
  grey: "color",
  brown: "color",
  green: "color",
  blue: "color",
  matte: "finish",
  polished: "finish",
  brushed: "finish",
  satin: "finish",
  glossy: "finish",
  textured: "finish",
  minimal: "style",
  modern: "style",
  rustic: "style",
  classic: "style",
  handmade: "style",
  woven: "style",
  bathroom: "room",
  kitchen: "room",
  bedroom: "room",
  living: "room",
  outdoor: "room",
  indoor: "use",
  exterior: "use",
  exterior_use: "use",
  outdoor_use: "use",
};

const synonymMap: Record<string, string[]> = {
  sofa: ["couch", "sectional"],
  couch: ["sofa", "sectional"],
  sconce: ["wall light", "wall", "light"],
  "wall light": ["sconce"],
  pendant: ["hanging light", "hanging", "light"],
  "hanging light": ["pendant"],
  vanity: ["bathroom", "mirror", "cabinet"],
  oak: ["wood", "timber"],
  walnut: ["wood", "timber"],
  matte: ["flat"],
  brass: ["gold"],
};

function toTitleCase(value: string): string {
  return value
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export function normalizeSearchText(value: string | null | undefined): string {
  return String(value ?? "")
    .toLowerCase()
    .replace(/[_-]+/g, " ")
    .replace(/[^\w\s]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function singularizeToken(token: string): string {
  if (token.length > 4 && token.endsWith("ies")) {
    return `${token.slice(0, -3)}y`;
  }
  if (token.length > 3 && token.endsWith("ses")) {
    return token.slice(0, -2);
  }
  if (token.length > 3 && token.endsWith("s") && !token.endsWith("ss")) {
    return token.slice(0, -1);
  }
  return token;
}

function tokenize(value: string | null | undefined): string[] {
  const normalized = normalizeSearchText(value);
  if (!normalized) {
    return [];
  }
  return normalized
    .split(" ")
    .map((token) => singularizeToken(token))
    .filter(Boolean);
}

function normalizeTagBody(value: string): string {
  return normalizeSearchText(value).replace(/\s+/g, "_");
}

export function normalizeMaterialTag(value: string | null | undefined): string | null {
  const raw = String(value ?? "").trim();
  if (!raw) {
    return null;
  }

  const normalized = normalizeSearchText(raw);
  if (!normalized) {
    return null;
  }

  const explicitPrefix = TAG_PREFIXES.find((prefix) => normalized.startsWith(`${prefix} `));
  if (explicitPrefix) {
    const tagBody = normalizeTagBody(normalized.slice(explicitPrefix.length + 1));
    return tagBody ? `${explicitPrefix}:${tagBody}` : null;
  }

  const explicitColonPrefix = TAG_PREFIXES.find((prefix) => normalized.startsWith(`${prefix}:`));
  if (explicitColonPrefix) {
    const tagBody = normalizeTagBody(normalized.slice(explicitColonPrefix.length + 1));
    return tagBody ? `${explicitColonPrefix}:${tagBody}` : null;
  }

  const inferredPrefix = inferredTagPrefixByValue[normalized.replace(/\s+/g, "_")] ?? inferredTagPrefixByValue[normalized];
  if (!inferredPrefix) {
    return null;
  }

  return `${inferredPrefix}:${normalizeTagBody(normalized)}`;
}

export function normalizeMaterialTags(values: Array<string | null | undefined>): string[] {
  const seen = new Set<string>();
  const normalizedTags: string[] = [];

  for (const value of values) {
    const normalized = normalizeMaterialTag(value);
    if (!normalized || seen.has(normalized)) {
      continue;
    }
    seen.add(normalized);
    normalizedTags.push(normalized);
  }

  return normalizedTags;
}

export function parseMaterialTagsInput(value: string): string[] {
  return normalizeMaterialTags(value.split(/[,;\n]/g));
}

export function formatMaterialTagLabel(value: string): string {
  const normalized = normalizeMaterialTag(value) ?? value;
  const [prefix, body = ""] = normalized.split(":");
  const prefixLabel = toTitleCase(prefix);
  const bodyLabel = toTitleCase(body.replace(/_/g, " "));
  return bodyLabel ? `${prefixLabel}: ${bodyLabel}` : prefixLabel;
}

export function collectTopMaterialTags(materials: ProductOption[], maxTags = 8): string[] {
  const counts = new Map<string, number>();

  for (const material of materials) {
    for (const tag of normalizeMaterialTags(material.tags ?? [])) {
      counts.set(tag, (counts.get(tag) ?? 0) + 1);
    }
  }

  return [...counts.entries()]
    .sort((a, b) => {
      if (b[1] !== a[1]) {
        return b[1] - a[1];
      }
      return a[0].localeCompare(b[0]);
    })
    .slice(0, maxTags)
    .map(([tag]) => tag);
}

interface SearchTerm {
  value: string;
  weight: number;
}

type RankedMaterial<T extends ProductOption> = T & {
  tags: string[];
  searchMatchLabels: string[];
  __score: number;
  __qualityScore: number;
};

export interface RankMaterialsInput {
  query: string;
  objectName?: string;
  objectCategory?: string;
  limit?: number;
  activeTag?: string | null;
}

function buildSearchTerms(query: string): SearchTerm[] {
  const normalizedQuery = normalizeSearchText(query);
  const termWeights = new Map<string, number>();

  if (normalizedQuery) {
    termWeights.set(normalizedQuery, 1);
  }

  for (const token of tokenize(query)) {
    termWeights.set(token, Math.max(termWeights.get(token) ?? 0, 1));
  }

  const expansionCandidates = [...termWeights.keys()];
  for (const candidate of expansionCandidates) {
    for (const expansion of synonymMap[candidate] ?? []) {
      const normalizedExpansion = normalizeSearchText(expansion);
      if (!normalizedExpansion) {
        continue;
      }
      termWeights.set(normalizedExpansion, Math.max(termWeights.get(normalizedExpansion) ?? 0, 0.72));
      for (const token of tokenize(normalizedExpansion)) {
        termWeights.set(token, Math.max(termWeights.get(token) ?? 0, 0.72));
      }
    }
  }

  return [...termWeights.entries()].map(([value, weight]) => ({ value, weight }));
}

function hasPhrase(haystack: string, needle: string): boolean {
  return Boolean(needle) && haystack.includes(needle);
}

function hasTokenPrefix(haystackTokens: string[], token: string): boolean {
  return haystackTokens.some((haystackToken) => haystackToken.startsWith(token) || token.startsWith(haystackToken));
}

export function rankMaterialsForObject<T extends ProductOption>(
  materials: T[],
  { query, objectName, objectCategory, limit, activeTag }: RankMaterialsInput
): T[] {
  const normalizedQuery = normalizeSearchText(query);
  const searchTerms = buildSearchTerms(query);
  const objectContextTokens = tokenize(`${objectName ?? ""} ${objectCategory ?? ""}`);
  const normalizedActiveTag = activeTag ? normalizeMaterialTag(activeTag) : null;
  const preferredBudgetCategory =
    objectName || objectCategory
      ? resolveBudgetCategory(objectName ?? objectCategory ?? "", objectCategory ?? objectName ?? "")
      : null;

  const ranked = materials
    .map((material) => {
      const normalizedTags = normalizeMaterialTags(material.tags ?? []);
      const normalizedTagBodies = normalizedTags.map((tag) => tag.split(":")[1]?.replace(/_/g, " ") ?? "");
      if (normalizedActiveTag && !normalizedTags.includes(normalizedActiveTag)) {
        return null;
      }

      const normalizedName = normalizeSearchText(material.name);
      const normalizedSupplier = normalizeSearchText(material.supplier);
      const normalizedDescription = normalizeSearchText(material.description);
      const normalizedSku = normalizeSearchText(material.sku);
      const normalizedCategory = normalizeSearchText(material.budgetCategory);
      const nameTokens = tokenize(material.name);
      const supplierTokens = tokenize(material.supplier);
      const descriptionTokens = tokenize(material.description);
      const skuTokens = tokenize(material.sku);
      const tagTokens = normalizedTagBodies.flatMap((value) => tokenize(value));
      const matchLabels = new Set<string>();

      let score = 0;
      let hasExplicitMatch = normalizedQuery.length === 0;

      if (normalizedQuery && hasPhrase(normalizedName, normalizedQuery)) {
        score += 180;
        matchLabels.add("name");
        hasExplicitMatch = true;
      }

      for (const term of searchTerms) {
        const weight = term.weight;
        if (!term.value) {
          continue;
        }

        if (hasPhrase(normalizedName, term.value)) {
          score += 72 * weight;
          matchLabels.add("name");
          hasExplicitMatch = true;
          continue;
        }

        if (hasTokenPrefix(nameTokens, term.value)) {
          score += 42 * weight;
          matchLabels.add("name");
          hasExplicitMatch = true;
          continue;
        }

        if (
          normalizedTags.some((tag) => tag.includes(term.value.replace(/\s+/g, "_"))) ||
          normalizedTagBodies.some((tagBody) => hasPhrase(normalizeSearchText(tagBody), term.value)) ||
          hasTokenPrefix(tagTokens, term.value)
        ) {
          score += 30 * weight;
          matchLabels.add("tag");
          hasExplicitMatch = true;
          continue;
        }

        if (hasPhrase(normalizedCategory, term.value)) {
          score += 24 * weight;
          matchLabels.add("category");
          hasExplicitMatch = true;
          continue;
        }

        if (hasPhrase(normalizedSupplier, term.value) || hasTokenPrefix(supplierTokens, term.value)) {
          score += 16 * weight;
          matchLabels.add("supplier");
          hasExplicitMatch = true;
          continue;
        }

        if (hasPhrase(normalizedDescription, term.value) || hasTokenPrefix(descriptionTokens, term.value)) {
          score += 11 * weight;
          matchLabels.add("description");
          hasExplicitMatch = true;
          continue;
        }

        if (hasPhrase(normalizedSku, term.value) || hasTokenPrefix(skuTokens, term.value)) {
          score += 8 * weight;
          matchLabels.add("sku");
          hasExplicitMatch = true;
        }
      }

      if (!hasExplicitMatch) {
        return null;
      }

      if (preferredBudgetCategory && material.budgetCategory === preferredBudgetCategory) {
        score += 14;
        matchLabels.add("object fit");
      }

      const objectTokenHits = objectContextTokens.filter(
        (token) =>
          hasTokenPrefix(nameTokens, token) ||
          hasTokenPrefix(tagTokens, token) ||
          normalizedTags.some((tag) => tag.includes(token))
      ).length;
      if (objectTokenHits > 0) {
        score += Math.min(12, objectTokenHits * 3);
        matchLabels.add("object fit");
      }

      if (material.imageUrl) {
        score += 2;
      }
      if (material.price > 0) {
        score += 2;
      }

      return {
        ...material,
        tags: normalizedTags,
        searchMatchLabels: [...matchLabels].slice(0, 3),
        __score: score,
        __qualityScore: (material.imageUrl ? 1 : 0) + (material.price > 0 ? 1 : 0),
      };
    })
    .filter((material): material is RankedMaterial<T> => material !== null)
    .sort((a, b) => {
      if (b.__score !== a.__score) {
        return b.__score - a.__score;
      }
      if (b.__qualityScore !== a.__qualityScore) {
        return b.__qualityScore - a.__qualityScore;
      }
      const updatedAtA = Date.parse(a.updatedAt ?? "");
      const updatedAtB = Date.parse(b.updatedAt ?? "");
      if (!Number.isNaN(updatedAtA) && !Number.isNaN(updatedAtB) && updatedAtB !== updatedAtA) {
        return updatedAtB - updatedAtA;
      }
      return a.name.localeCompare(b.name);
    })
    .map((material) => {
      const { __score, __qualityScore, ...rest } = material;
      void __score;
      void __qualityScore;
      return rest as T;
    });

  if (typeof limit === "number" && Number.isFinite(limit) && limit > 0) {
    return ranked.slice(0, limit);
  }

  return ranked;
}
