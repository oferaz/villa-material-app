import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";

interface LinkPreviewResponse {
  ok: boolean;
  name?: string;
  supplier?: string;
  imageUrl?: string;
  price?: number;
  priceFound: boolean;
  imageFound: boolean;
  warning?: string;
}

const MAX_HTML_BYTES = 1024 * 1024 * 2;
const MAX_EXCERPT_CHARS = 12000;

function deriveSupplierFromUrl(rawUrl: string): string | undefined {
  try {
    const hostname = new URL(rawUrl).hostname.replace(/^www\./, "");
    const firstPart = hostname.split(".")[0] || "";
    if (!firstPart) return undefined;
    return firstPart
      .split("-")
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(" ");
  } catch {
    return undefined;
  }
}

function isBlockedHostname(hostname: string): boolean {
  const lower = hostname.toLowerCase();
  if (lower === "localhost" || lower.endsWith(".localhost") || lower.endsWith(".local")) return true;
  if (lower === "::1" || lower === "[::1]") return true;
  if (/^127\./.test(lower) || /^10\./.test(lower) || /^192\.168\./.test(lower)) return true;
  if (/^172\.(1[6-9]|2\d|3[01])\./.test(lower)) return true;
  return false;
}

// --- Regex-based fallback (original approach) ---

function normalizeWhitespace(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function stripHtmlTags(value: string): string {
  return normalizeWhitespace(value.replace(/<[^>]*>/g, " "));
}

function parseAttributes(tag: string): Record<string, string> {
  const attributes: Record<string, string> = {};
  const regex = /([a-zA-Z_:.-]+)\s*=\s*("([^"]*)"|'([^']*)'|([^\s>]+))/g;
  let match: RegExpExecArray | null = regex.exec(tag);
  while (match) {
    const key = match[1].toLowerCase();
    const value = (match[3] ?? match[4] ?? match[5] ?? "").trim();
    attributes[key] = value;
    match = regex.exec(tag);
  }
  return attributes;
}

function extractMetaContent(html: string, keys: string[]): string | undefined {
  const wanted = new Set(keys.map((key) => key.toLowerCase()));
  const metaTagRegex = /<meta\s+[^>]*>/gi;
  let match: RegExpExecArray | null = metaTagRegex.exec(html);
  while (match) {
    const tag = match[0];
    const attributes = parseAttributes(tag);
    const key = attributes.property ?? attributes.name ?? attributes.itemprop;
    const content = attributes.content;
    if (key && content && wanted.has(key.toLowerCase())) {
      const normalized = normalizeWhitespace(content);
      if (normalized) return normalized;
    }
    match = metaTagRegex.exec(html);
  }
  return undefined;
}

function absoluteUrl(baseUrl: string, candidate: string | undefined): string | undefined {
  if (!candidate) return undefined;
  try {
    return new URL(candidate, baseUrl).toString();
  } catch {
    return undefined;
  }
}

function parseNumberLike(value: string | undefined): number | undefined {
  if (!value) return undefined;
  const cleaned = value.replace(/[^\d.,-]/g, "").trim();
  if (!cleaned) return undefined;
  const normalized =
    cleaned.includes(",") && !cleaned.includes(".")
      ? cleaned.replace(/,/g, ".")
      : cleaned.replace(/,/g, "");
  const parsed = Number(normalized);
  if (!Number.isFinite(parsed) || parsed <= 0) return undefined;
  return parsed;
}

function extractPriceFromText(html: string): number | undefined {
  const text = stripHtmlTags(html);
  const patterns = [
    /\$\s?([0-9][0-9,]*(?:\.[0-9]{1,2})?)/,
    /USD\s?([0-9][0-9,]*(?:\.[0-9]{1,2})?)/i,
    /AED\s?([0-9][0-9,]*(?:\.[0-9]{1,2})?)/i,
    /EUR\s?([0-9][0-9,]*(?:\.[0-9]{1,2})?)/i,
    /GBP\s?([0-9][0-9,]*(?:\.[0-9]{1,2})?)/i,
  ];
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (!match?.[1]) continue;
    const parsed = parseNumberLike(match[1]);
    if (parsed !== undefined) return parsed;
  }
  return undefined;
}

function extractTitle(html: string): string | undefined {
  const ogTitle = extractMetaContent(html, ["og:title", "twitter:title"]);
  if (ogTitle) return ogTitle;
  const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  if (titleMatch?.[1]) {
    const title = stripHtmlTags(titleMatch[1]);
    if (title) return title;
  }
  return undefined;
}

function extractImage(html: string, pageUrl: string): string | undefined {
  const metaImage = extractMetaContent(html, [
    "og:image",
    "og:image:url",
    "twitter:image",
    "twitter:image:src",
    "image",
  ]);
  return absoluteUrl(pageUrl, metaImage);
}

function extractJsonLdBlocks(html: string): unknown[] {
  const blocks: unknown[] = [];
  const regex =
    /<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let match: RegExpExecArray | null = regex.exec(html);
  while (match) {
    const raw = match[1].trim();
    if (!raw) { match = regex.exec(html); continue; }
    try { blocks.push(JSON.parse(raw)); } catch { /* ignore */ }
    match = regex.exec(html);
  }
  return blocks;
}

function collectValues(node: unknown, key: string, output: unknown[]): void {
  if (!node || typeof node !== "object") return;
  if (Array.isArray(node)) {
    for (const item of node) collectValues(item, key, output);
    return;
  }
  const record = node as Record<string, unknown>;
  for (const [k, value] of Object.entries(record)) {
    if (k === key) output.push(value);
    collectValues(value, key, output);
  }
}

function extractFromJsonLd(
  blocks: unknown[],
  pageUrl: string
): { price?: number; imageUrl?: string; name?: string } {
  let price: number | undefined;
  let imageUrl: string | undefined;
  let name: string | undefined;

  for (const block of blocks) {
    if (price === undefined) {
      const prices: unknown[] = [];
      collectValues(block, "price", prices);
      for (const c of prices) {
        const parsed = parseNumberLike(String(c));
        if (parsed !== undefined) { price = parsed; break; }
      }
    }
    if (!imageUrl) {
      const images: unknown[] = [];
      collectValues(block, "image", images);
      for (const c of images) {
        if (typeof c === "string") {
          const u = absoluteUrl(pageUrl, c);
          if (u) { imageUrl = u; break; }
        } else if (Array.isArray(c)) {
          for (const nested of c) {
            if (typeof nested === "string") {
              const u = absoluteUrl(pageUrl, nested);
              if (u) { imageUrl = u; break; }
            }
          }
        }
      }
    }
    if (!name) {
      const names: unknown[] = [];
      collectValues(block, "name", names);
      const first = names.find((c) => typeof c === "string") as string | undefined;
      if (first) {
        const n = normalizeWhitespace(first);
        if (n) name = n;
      }
    }
    if (price !== undefined && imageUrl && name) break;
  }
  return { price, imageUrl, name };
}

function regexExtract(
  html: string,
  pageUrl: string
): { name?: string; price?: number; imageUrl?: string } {
  const jsonLd = extractJsonLdBlocks(html);
  const fromLd = extractFromJsonLd(jsonLd, pageUrl);

  const metaPrice =
    parseNumberLike(
      extractMetaContent(html, [
        "product:price:amount",
        "og:price:amount",
        "price",
        "twitter:data1",
      ])
    ) ?? extractPriceFromText(html);

  return {
    name: fromLd.name ?? extractTitle(html),
    price: fromLd.price ?? metaPrice,
    imageUrl: fromLd.imageUrl ?? extractImage(html, pageUrl),
  };
}

// --- Claude-powered extraction (used when ANTHROPIC_API_KEY is set) ---

function buildExcerpt(html: string): string {
  const headMatch = html.match(/<head[\s\S]*?<\/head>/i);
  const headPart = headMatch ? headMatch[0] : "";
  const bodyStart = html.indexOf("<body");
  const bodyPart =
    bodyStart >= 0 ? html.slice(bodyStart, bodyStart + 4000) : html.slice(0, 4000);
  return (headPart + "\n" + bodyPart).slice(0, MAX_EXCERPT_CHARS);
}

async function claudeExtract(
  html: string,
  pageUrl: string
): Promise<{ name?: string; price?: number; imageUrl?: string }> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("no key");

  const client = new Anthropic({ apiKey });
  const excerpt = buildExcerpt(html);

  const message = await client.messages.create({
    model: "claude-haiku-4-5",
    max_tokens: 256,
    system:
      "You extract product information from HTML snippets for an interior design procurement tool. " +
      "Return ONLY a JSON object with these optional fields: " +
      '{"name": string, "price": number, "imageUrl": string}. ' +
      "Rules: name = product name (not the site name); price = numeric value in the page currency, no currency symbols; " +
      "imageUrl = the best product image URL (absolute). " +
      "Omit a field if you cannot find it with high confidence. Do NOT wrap in markdown.",
    messages: [
      { role: "user", content: `Page URL: ${pageUrl}\n\nHTML excerpt:\n${excerpt}` },
    ],
  });

  const text =
    message.content[0].type === "text" ? message.content[0].text.trim() : "";
  return JSON.parse(text) as { name?: string; price?: number; imageUrl?: string };
}

// --- Route handler ---

export async function POST(request: NextRequest) {
  let rawUrl = "";
  try {
    const body = (await request.json()) as { url?: string };
    rawUrl = (body.url ?? "").trim();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON body." }, { status: 400 });
  }

  if (!rawUrl) {
    return NextResponse.json({ ok: false, error: "URL is required." }, { status: 400 });
  }

  let parsedUrl: URL;
  try {
    parsedUrl = new URL(rawUrl);
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid URL." }, { status: 400 });
  }

  if (!["http:", "https:"].includes(parsedUrl.protocol)) {
    return NextResponse.json(
      { ok: false, error: "Only http/https URLs are supported." },
      { status: 400 }
    );
  }
  if (isBlockedHostname(parsedUrl.hostname)) {
    return NextResponse.json(
      { ok: false, error: "This hostname is not allowed." },
      { status: 400 }
    );
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10000);

  let html = "";
  try {
    const response = await fetch(parsedUrl.toString(), {
      method: "GET",
      redirect: "follow",
      signal: controller.signal,
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/127.0 Safari/537.36",
        Accept: "text/html,application/xhtml+xml",
      },
      cache: "no-store",
    });

    if (!response.ok) {
      return NextResponse.json(
        { ok: false, error: `Failed to fetch URL (${response.status}).` },
        { status: 502 }
      );
    }

    html = await response.text();
    if (html.length > MAX_HTML_BYTES) html = html.slice(0, MAX_HTML_BYTES);
  } catch {
    return NextResponse.json(
      { ok: false, error: "Failed to fetch URL content." },
      { status: 502 }
    );
  } finally {
    clearTimeout(timeout);
  }

  const pageUrl = parsedUrl.toString();
  let extracted: { name?: string; price?: number; imageUrl?: string };

  if (process.env.ANTHROPIC_API_KEY) {
    try {
      extracted = await claudeExtract(html, pageUrl);
    } catch {
      extracted = regexExtract(html, pageUrl);
    }
  } else {
    extracted = regexExtract(html, pageUrl);
  }

  const price =
    typeof extracted.price === "number" && extracted.price > 0
      ? Math.round(extracted.price)
      : undefined;

  const payload: LinkPreviewResponse = {
    ok: true,
    name: extracted.name,
    supplier: deriveSupplierFromUrl(pageUrl),
    imageUrl: extracted.imageUrl,
    price,
    priceFound: price !== undefined,
    imageFound: Boolean(extracted.imageUrl),
  };

  if (!payload.priceFound) {
    payload.warning = "Could not extract price from link. Enter price manually.";
  }

  return NextResponse.json(payload);
}
