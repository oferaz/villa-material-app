import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const WEB_DIR = path.resolve(SCRIPT_DIR, "..");
const REPO_ROOT = path.resolve(WEB_DIR, "..");
const DEFAULT_INPUT_SQL = path.join(REPO_ROOT, "db", "manual", "20260316_import_srithanu_customer_project.sql");
const DEFAULT_OUTPUT_DIR = path.join(REPO_ROOT, "tmp");

const INPUT_SQL = path.resolve(process.argv[2] ?? DEFAULT_INPUT_SQL);
const OUTPUT_DIR = path.resolve(process.argv[3] ?? DEFAULT_OUTPUT_DIR);

const FIELDS = [
  "source_seq",
  "source_sheet",
  "house_name",
  "room_name_original",
  "room_name_en",
  "room_type",
  "item_name_original",
  "item_name_en",
  "object_category",
  "budget_category",
  "approx_price",
  "actual_price",
  "chosen_price",
  "quantity",
  "supplier_name",
  "source_url",
  "po_approved",
  "is_ordered",
  "is_installed",
  "notes",
];

const MAX_HTML_BYTES = 2 * 1024 * 1024;
const FETCH_TIMEOUT_MS = 15000;
const CONCURRENCY = 5;

function normalizeWhitespace(value) {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}

function parseAttributes(tag) {
  const attributes = {};
  const regex = /([a-zA-Z_:.-]+)\s*=\s*("([^"]*)"|'([^']*)'|([^\s>]+))/g;
  let match = regex.exec(tag);
  while (match) {
    const key = String(match[1] ?? "").toLowerCase();
    const value = String(match[3] ?? match[4] ?? match[5] ?? "").trim();
    attributes[key] = value;
    match = regex.exec(tag);
  }
  return attributes;
}

function extractMetaContent(html, keys) {
  const wanted = new Set(keys.map((key) => String(key).toLowerCase()));
  const metaTagRegex = /<meta\s+[^>]*>/gi;
  let match = metaTagRegex.exec(html);
  while (match) {
    const tag = match[0];
    const attributes = parseAttributes(tag);
    const key = attributes.property ?? attributes.name ?? attributes.itemprop;
    const content = attributes.content;
    if (key && content && wanted.has(String(key).toLowerCase())) {
      const normalized = normalizeWhitespace(content);
      if (normalized) {
        return normalized;
      }
    }
    match = metaTagRegex.exec(html);
  }
  return undefined;
}

function stripHtmlTags(value) {
  return normalizeWhitespace(String(value ?? "").replace(/<[^>]*>/g, " "));
}

function parseNumberLike(value) {
  const raw = String(value ?? "").trim();
  if (!raw) {
    return undefined;
  }
  const cleaned = raw.replace(/[^\d.,-]/g, "").trim();
  if (!cleaned) {
    return undefined;
  }
  const normalized =
    cleaned.includes(",") && !cleaned.includes(".")
      ? cleaned.replace(/,/g, ".")
      : cleaned.replace(/,/g, "");
  const parsed = Number(normalized);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return undefined;
  }
  return parsed;
}

function absoluteUrl(baseUrl, candidate) {
  if (!candidate) {
    return undefined;
  }
  try {
    return new URL(candidate, baseUrl).toString();
  } catch {
    return undefined;
  }
}

function extractJsonLdBlocks(html) {
  const blocks = [];
  const regex = /<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let match = regex.exec(html);
  while (match) {
    const raw = String(match[1] ?? "").trim();
    if (!raw) {
      match = regex.exec(html);
      continue;
    }
    try {
      blocks.push(JSON.parse(raw));
    } catch {
      // ignore invalid JSON
    }
    match = regex.exec(html);
  }
  return blocks;
}

function collectValues(node, key, output) {
  if (!node || typeof node !== "object") {
    return;
  }
  if (Array.isArray(node)) {
    for (const item of node) {
      collectValues(item, key, output);
    }
    return;
  }
  const record = node;
  for (const [k, value] of Object.entries(record)) {
    if (k === key) {
      output.push(value);
    }
    collectValues(value, key, output);
  }
}

function extractFromJsonLd(blocks, pageUrl) {
  let price;
  let imageUrl;
  let name;

  for (const block of blocks) {
    if (price === undefined) {
      const prices = [];
      collectValues(block, "price", prices);
      for (const candidate of prices) {
        const parsed = parseNumberLike(String(candidate ?? ""));
        if (parsed !== undefined) {
          price = parsed;
          break;
        }
      }
    }

    if (!imageUrl) {
      const images = [];
      collectValues(block, "image", images);
      for (const candidate of images) {
        if (typeof candidate === "string") {
          const resolved = absoluteUrl(pageUrl, candidate);
          if (resolved) {
            imageUrl = resolved;
            break;
          }
        } else if (Array.isArray(candidate)) {
          for (const nested of candidate) {
            if (typeof nested !== "string") {
              continue;
            }
            const resolved = absoluteUrl(pageUrl, nested);
            if (resolved) {
              imageUrl = resolved;
              break;
            }
          }
        }
        if (imageUrl) {
          break;
        }
      }
    }

    if (!name) {
      const names = [];
      collectValues(block, "name", names);
      const first = names.find((candidate) => typeof candidate === "string");
      if (first) {
        const normalized = normalizeWhitespace(first);
        if (normalized) {
          name = normalized;
        }
      }
    }

    if (price !== undefined && imageUrl && name) {
      break;
    }
  }

  return { price, imageUrl, name };
}

function deriveSupplierFromUrl(rawUrl) {
  try {
    const hostname = new URL(rawUrl).hostname.replace(/^www\./, "");
    const firstPart = hostname.split(".")[0] || "";
    if (!firstPart) {
      return undefined;
    }
    return firstPart
      .split("-")
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(" ");
  } catch {
    return undefined;
  }
}

function extractPriceFromText(html) {
  const text = stripHtmlTags(html);
  const patterns = [
    /\$\s?([0-9][0-9,]*(?:\.[0-9]{1,2})?)/,
    /USD\s?([0-9][0-9,]*(?:\.[0-9]{1,2})?)/i,
    /THB\s?([0-9][0-9,]*(?:\.[0-9]{1,2})?)/i,
    /฿\s?([0-9][0-9,]*(?:\.[0-9]{1,2})?)/,
  ];
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (!match?.[1]) {
      continue;
    }
    const parsed = parseNumberLike(match[1]);
    if (parsed !== undefined) {
      return parsed;
    }
  }
  return undefined;
}

async function fetchUrlMetadata(url) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const response = await fetch(url, {
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
      return {
        ok: false,
        error: `Failed to fetch URL (${response.status})`,
        status: response.status,
        finalUrl: response.url || url,
      };
    }

    let html = await response.text();
    if (html.length > MAX_HTML_BYTES) {
      html = html.slice(0, MAX_HTML_BYTES);
    }

    const jsonLdBlocks = extractJsonLdBlocks(html);
    const jsonLd = extractFromJsonLd(jsonLdBlocks, response.url || url);

    const name =
      jsonLd.name ||
      extractMetaContent(html, ["og:title", "twitter:title"]) ||
      (() => {
        const match = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
        return match?.[1] ? stripHtmlTags(match[1]) : undefined;
      })();

    const imageUrl =
      jsonLd.imageUrl ||
      absoluteUrl(
        response.url || url,
        extractMetaContent(html, ["og:image", "og:image:url", "twitter:image", "twitter:image:src", "image"])
      );

    const metaPrice =
      parseNumberLike(
        extractMetaContent(html, ["product:price:amount", "og:price:amount", "price", "twitter:data1"])
      ) ?? extractPriceFromText(html);

    const price = jsonLd.price ?? metaPrice;
    const supplier = deriveSupplierFromUrl(response.url || url);
    const warning = price === undefined ? "Could not extract price from page." : undefined;

    return {
      ok: true,
      finalUrl: response.url || url,
      status: response.status,
      name: name || undefined,
      supplier: supplier || undefined,
      imageUrl: imageUrl || undefined,
      price: price !== undefined ? Math.round(price) : undefined,
      warning,
    };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Unknown fetch error",
      status: undefined,
      finalUrl: url,
    };
  } finally {
    clearTimeout(timeout);
  }
}

function findImportInsertValues(sqlText) {
  const marker = "insert into tmp_import_rows";
  const start = sqlText.toLowerCase().indexOf(marker);
  if (start < 0) {
    throw new Error("Could not find insert into tmp_import_rows block.");
  }
  const valuesIndex = sqlText.toLowerCase().indexOf("values", start);
  if (valuesIndex < 0) {
    throw new Error("Could not find VALUES clause for tmp_import_rows.");
  }
  const semicolonIndex = sqlText.indexOf(";", valuesIndex);
  if (semicolonIndex < 0) {
    throw new Error("Could not find end of tmp_import_rows VALUES statement.");
  }
  return sqlText.slice(valuesIndex + "values".length, semicolonIndex);
}

function splitTupleValues(tupleText) {
  const values = [];
  let current = "";
  let inString = false;

  for (let i = 0; i < tupleText.length; i += 1) {
    const char = tupleText[i];
    if (inString) {
      current += char;
      if (char === "'") {
        if (tupleText[i + 1] === "'") {
          current += "'";
          i += 1;
        } else {
          inString = false;
        }
      }
      continue;
    }

    if (char === "'") {
      inString = true;
      current += char;
      continue;
    }

    if (char === ",") {
      values.push(current.trim());
      current = "";
      continue;
    }

    current += char;
  }

  if (current.trim() !== "") {
    values.push(current.trim());
  }
  return values;
}

function parseSqlAtom(raw) {
  const value = String(raw ?? "").trim();
  if (value === "") {
    return null;
  }
  if (/^null$/i.test(value)) {
    return null;
  }
  if (/^true$/i.test(value)) {
    return true;
  }
  if (/^false$/i.test(value)) {
    return false;
  }
  if (/^-?\d+(\.\d+)?$/.test(value)) {
    return Number(value);
  }
  if (value.startsWith("'") && value.endsWith("'")) {
    return value.slice(1, -1).replace(/''/g, "'");
  }
  return value;
}

function parseImportRows(sqlText) {
  const block = findImportInsertValues(sqlText);
  const tuples = [];
  let inString = false;
  let depth = 0;
  let current = "";

  for (let i = 0; i < block.length; i += 1) {
    const char = block[i];

    if (inString) {
      current += char;
      if (char === "'") {
        if (block[i + 1] === "'") {
          current += "'";
          i += 1;
        } else {
          inString = false;
        }
      }
      continue;
    }

    if (char === "'") {
      inString = true;
      current += char;
      continue;
    }

    if (char === "(") {
      depth += 1;
      if (depth === 1) {
        current = "";
        continue;
      }
    }

    if (char === ")") {
      depth -= 1;
      if (depth === 0) {
        tuples.push(current);
        current = "";
        continue;
      }
    }

    if (depth >= 1) {
      current += char;
    }
  }

  return tuples.map((tupleText, index) => {
    const tokens = splitTupleValues(tupleText);
    if (tokens.length !== FIELDS.length) {
      throw new Error(
        `Tuple ${index + 1} has ${tokens.length} columns but expected ${FIELDS.length}.`
      );
    }
    const record = {};
    for (let i = 0; i < FIELDS.length; i += 1) {
      record[FIELDS[i]] = parseSqlAtom(tokens[i]);
    }
    return record;
  });
}

function toCsv(rows) {
  const headers = [
    "source_seq",
    "house_name",
    "room_name_en",
    "item_name_en",
    "source_url",
    "final_url",
    "ok",
    "http_status",
    "name",
    "supplier",
    "price",
    "image_url",
    "warning",
    "error",
  ];
  const escape = (value) => {
    if (value == null) {
      return "";
    }
    const text = String(value);
    if (/[",\n]/.test(text)) {
      return `"${text.replace(/"/g, '""')}"`;
    }
    return text;
  };
  const lines = [headers.join(",")];
  for (const row of rows) {
    lines.push(headers.map((key) => escape(row[key])).join(","));
  }
  return `${lines.join("\n")}\n`;
}

async function mapWithConcurrency(items, concurrency, mapper) {
  const results = new Array(items.length);
  let nextIndex = 0;

  async function worker() {
    while (true) {
      const currentIndex = nextIndex;
      nextIndex += 1;
      if (currentIndex >= items.length) {
        return;
      }
      results[currentIndex] = await mapper(items[currentIndex], currentIndex);
    }
  }

  const workers = Array.from({ length: Math.min(concurrency, items.length) }, () => worker());
  await Promise.all(workers);
  return results;
}

async function main() {
  const startedAt = new Date();
  const sqlPath = path.resolve(INPUT_SQL);
  const outDir = path.resolve(OUTPUT_DIR);
  fs.mkdirSync(outDir, { recursive: true });

  const sql = fs.readFileSync(sqlPath, "utf8");
  const rows = parseImportRows(sql);
  const linkRows = rows.filter((row) => {
    const url = String(row.source_url ?? "").trim();
    return /^https?:\/\//i.test(url);
  });

  const uniqueUrls = Array.from(
    new Set(linkRows.map((row) => String(row.source_url).trim()))
  );

  console.log(`Parsed ${rows.length} rows from import file.`);
  console.log(`Found ${linkRows.length} rows with valid links (${uniqueUrls.length} unique URLs).`);

  const urlResultsArray = await mapWithConcurrency(uniqueUrls, CONCURRENCY, async (url, index) => {
    console.log(`[${index + 1}/${uniqueUrls.length}] Fetching ${url}`);
    const result = await fetchUrlMetadata(url);
    return { url, ...result };
  });

  const urlResults = new Map(urlResultsArray.map((result) => [result.url, result]));

  const expandedRows = linkRows.map((row) => {
    const url = String(row.source_url).trim();
    const fetched = urlResults.get(url) ?? {};
    return {
      source_seq: row.source_seq,
      house_name: row.house_name,
      room_name_en: row.room_name_en,
      item_name_en: row.item_name_en,
      source_url: url,
      final_url: fetched.finalUrl ?? "",
      ok: Boolean(fetched.ok),
      http_status: fetched.status ?? "",
      name: fetched.name ?? "",
      supplier: fetched.supplier ?? "",
      price: fetched.price ?? "",
      image_url: fetched.imageUrl ?? "",
      warning: fetched.warning ?? "",
      error: fetched.error ?? "",
    };
  });

  const successCount = urlResultsArray.filter((result) => result.ok).length;
  const withPriceCount = urlResultsArray.filter((result) => result.ok && result.price != null).length;
  const withImageCount = urlResultsArray.filter((result) => result.ok && result.imageUrl).length;

  const timestamp = startedAt.toISOString().replace(/[:.]/g, "-");
  const jsonPath = path.join(outDir, `import_link_metadata_${timestamp}.json`);
  const csvPath = path.join(outDir, `import_link_metadata_${timestamp}.csv`);

  const payload = {
    generated_at: new Date().toISOString(),
    input_sql: sqlPath,
    totals: {
      parsed_rows: rows.length,
      linked_rows: linkRows.length,
      unique_urls: uniqueUrls.length,
      fetch_success: successCount,
      with_price: withPriceCount,
      with_image: withImageCount,
    },
    url_results: urlResultsArray,
    expanded_rows: expandedRows,
  };

  fs.writeFileSync(jsonPath, JSON.stringify(payload, null, 2), "utf8");
  fs.writeFileSync(csvPath, toCsv(expandedRows), "utf8");

  console.log("");
  console.log("Done.");
  console.log(`JSON: ${jsonPath}`);
  console.log(`CSV:  ${csvPath}`);
  console.log(
    `Summary: success ${successCount}/${uniqueUrls.length}, with price ${withPriceCount}, with image ${withImageCount}`
  );
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});

