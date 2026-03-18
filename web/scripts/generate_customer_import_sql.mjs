import fs from "node:fs";
import path from "node:path";
import ExcelJS from "exceljs";

const MATRIX_WORKBOOK =
  "c:/Users/ofer.r.ARBE/OneDrive - ArbeRobotics/Documents 1/Personal/AI app/Limor data/Srithanu uper zone furnitur.xlsx";
const STRUCTURED_WORKBOOK = "c:/Workspace/Materia/villa-material-app/tmp_customer_srithanu.xlsx";
const OUTPUT_SQL =
  "c:/Workspace/Materia/villa-material-app/db/manual/20260316_import_srithanu_customer_project.sql";

const PROJECT_NAME = "Srithanu - Imported";
const OWNER_EMAIL = "karnoni@gmail.com";
const COLLAB_EMAIL = "raz.oferaz@gmail.com";
const PROJECT_CURRENCY = "THB";

const roomExactMap = new Map([
  ["חדר הורים", "Master Bedroom"],
  ["Parents room", "Master Bedroom"],
  ["חדרי ילדים", "Kids Bedroom"],
  ["פינת אוכל", "Dining Room"],
  ["מטבח", "Kitchen"],
  ["סלון", "Living Room"],
  ["חדר רחצה", "Bathroom"],
  ["שרותי אורחים", "Guest Bathroom"],
  ["ממ\"ד", "Safe Room"],
  ["ממד", "Safe Room"],
  ["חוץ", "Outdoor"],
  ["חצר", "Outdoor"],
  ["מרפסת", "Balcony"],
  ["כניסה", "Entry"],
  ["מסדרון", "Hallway"],
  ["חדר עבודה", "Office"],
  ["חדר כביסה", "Laundry"],
  ["בית צלקה", "Beit Tsalka"],
]);

const phraseMap = new Map([
  ["מיטת הורים", "Master Bed"],
  ["חדר הורים", "Master Bedroom"],
  ["חדרי ילדים", "Kids Bedroom"],
  ["פינת אוכל", "Dining Area"],
  ["שולחן אוכל", "Dining Table"],
  ["שולחן סלון", "Coffee Table"],
  ["שטיח", "Rug"],
  ["כורסא", "Armchair"],
  ["שידת טלויזיה", "TV Console"],
  ["כריות נוי", "Decorative Pillows"],
  ["מראת גוף", "Full Length Mirror"],
  ["גוף תאורה", "Light Fixture"],
  ["מקרר", "Refrigerator"],
  ["מדיח", "Dishwasher"],
  ["מיקרו", "Microwave"],
  ["תנור", "Oven"],
  ["כיריים", "Cooktop"],
  ["קומקום", "Kettle"],
  ["מתקן ייבוש כלים", "Dish Drying Rack"],
  ["ארון", "Cabinet"],
  ["ספה", "Sofa"],
  ["שולחן", "Table"],
  ["כסא", "Chair"],
  ["כיסאות", "Chairs"],
  ["טלויזיה", "TV"],
  ["זרוע לטלוויזיה", "TV Mount Arm"],
  ["עציץ", "Plant Pot"],
  ["קישוטים", "Decor"],
  ["בלון גז", "Gas Cylinder"],
  ["ציוד מטבח", "Kitchen Equipment"],
  ["חדר רחצה", "Bathroom"],
  ["שרותי אורחים", "Guest Bathroom"],
  ["מראה", "Mirror"],
  ["וילון", "Curtain"],
  ["מזרון", "Mattress"],
  ["מזרונים", "Mattresses"],
  ["שולחן איפור", "Vanity Table"],
  ["כסא איפור", "Vanity Chair"],
  ["שידה", "Dresser"],
]);

const wordMap = new Map([
  ["חדר", "Room"],
  ["הורים", "Parents"],
  ["ילדים", "Kids"],
  ["אורחים", "Guests"],
  ["סלון", "Living"],
  ["מטבח", "Kitchen"],
  ["פינת", "Area"],
  ["אוכל", "Dining"],
  ["שולחן", "Table"],
  ["כסא", "Chair"],
  ["כסאות", "Chairs"],
  ["כיסא", "Chair"],
  ["כיסאות", "Chairs"],
  ["ספה", "Sofa"],
  ["שטיח", "Rug"],
  ["כורסא", "Armchair"],
  ["ארון", "Cabinet"],
  ["שידה", "Dresser"],
  ["מראה", "Mirror"],
  ["וילון", "Curtain"],
  ["מיטה", "Bed"],
  ["מיטה", "Bed"],
  ["מזרון", "Mattress"],
  ["מזרונים", "Mattresses"],
  ["תאורה", "Lighting"],
  ["גוף", "Fixture"],
  ["תלוי", "Pendant"],
  ["קירי", "Wall"],
  ["מקרר", "Refrigerator"],
  ["מדיח", "Dishwasher"],
  ["תנור", "Oven"],
  ["מיקרו", "Microwave"],
  ["כיריים", "Cooktop"],
  ["קומקום", "Kettle"],
  ["טלויזיה", "TV"],
  ["לטלוויזיה", "For TV"],
  ["עציץ", "Planter"],
  ["גדול", "Large"],
  ["קטן", "Small"],
  ["ציוד", "Equipment"],
  ["מתקן", "Rack"],
  ["ייבוש", "Drying"],
  ["כלים", "Dishes"],
  ["מדף", "Shelf"],
  ["עץ", "Wood"],
  ["כניסה", "Entry"],
  ["מרפסת", "Balcony"],
  ["חצר", "Yard"],
  ["חוץ", "Outdoor"],
  ["ממד", "Safe Room"],
  ["שירותים", "Toilet"],
  ["שרותי", "Toilet"],
  ["רחצה", "Bath"],
]);

const hebrewCharMap = new Map([
  ["א", "a"],
  ["ב", "b"],
  ["ג", "g"],
  ["ד", "d"],
  ["ה", "h"],
  ["ו", "v"],
  ["ז", "z"],
  ["ח", "ch"],
  ["ט", "t"],
  ["י", "y"],
  ["כ", "k"],
  ["ך", "k"],
  ["ל", "l"],
  ["מ", "m"],
  ["ם", "m"],
  ["נ", "n"],
  ["ן", "n"],
  ["ס", "s"],
  ["ע", "a"],
  ["פ", "p"],
  ["ף", "p"],
  ["צ", "tz"],
  ["ץ", "tz"],
  ["ק", "k"],
  ["ר", "r"],
  ["ש", "sh"],
  ["ת", "t"],
]);

const canonicalHebrewCharMap = new Map([
  ["\u05d0", "a"],
  ["\u05d1", "b"],
  ["\u05d2", "g"],
  ["\u05d3", "d"],
  ["\u05d4", "h"],
  ["\u05d5", "v"],
  ["\u05d6", "z"],
  ["\u05d7", "ch"],
  ["\u05d8", "t"],
  ["\u05d9", "y"],
  ["\u05db", "k"],
  ["\u05da", "k"],
  ["\u05dc", "l"],
  ["\u05de", "m"],
  ["\u05dd", "m"],
  ["\u05e0", "n"],
  ["\u05df", "n"],
  ["\u05e1", "s"],
  ["\u05e2", "a"],
  ["\u05e4", "p"],
  ["\u05e3", "p"],
  ["\u05e6", "tz"],
  ["\u05e5", "tz"],
  ["\u05e7", "k"],
  ["\u05e8", "r"],
  ["\u05e9", "sh"],
  ["\u05ea", "t"],
]);

function decodeLikelyMojibake(text) {
  if (!text) {
    return "";
  }

  const source = String(text);
  if (!/[\u00D7\u00C3\u00E2]/.test(source)) {
    return source;
  }

  try {
    const decoded = Buffer.from(source, "latin1").toString("utf8");
    if (hasHebrew(decoded) || /[\u00C0-\u024F]/.test(decoded)) {
      return decoded;
    }
  } catch {
    return source;
  }

  return source;
}

function normalizeLookupKey(value) {
  return normalizeSpaces(decodeLikelyMojibake(String(value ?? "")));
}

function createNormalizedLookupMap(rawMap) {
  const lookupMap = new Map();
  for (const [rawKey, mappedValue] of rawMap.entries()) {
    const normalized = normalizeLookupKey(rawKey);
    if (normalized) {
      lookupMap.set(normalized, mappedValue);
      lookupMap.set(normalized.toLowerCase(), mappedValue);
    }
  }
  return lookupMap;
}

const normalizedRoomExactMap = createNormalizedLookupMap(roomExactMap);
const normalizedWordMap = createNormalizedLookupMap(wordMap);
const normalizedPhraseEntries = Array.from(createNormalizedLookupMap(phraseMap).entries()).sort(
  (left, right) => right[0].length - left[0].length
);

function unwrapCellValue(value) {
  if (value == null) {
    return null;
  }
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean" || value instanceof Date) {
    return value;
  }
  if (typeof value !== "object") {
    return String(value);
  }

  if (Array.isArray(value.richText)) {
    return value.richText.map((segment) => segment?.text ?? "").join("");
  }
  if (typeof value.hyperlink === "string" && value.hyperlink.trim()) {
    return value.hyperlink;
  }
  if (typeof value.text === "string" && value.text.trim()) {
    return value.text;
  }
  if (value.result != null) {
    return unwrapCellValue(value.result);
  }

  return null;
}

function readCellText(cell) {
  const rawValue = unwrapCellValue(cell?.value);
  if (typeof rawValue === "string") {
    return normalizeLookupKey(rawValue);
  }
  if (typeof rawValue === "number" || typeof rawValue === "boolean") {
    return String(rawValue);
  }
  if (rawValue instanceof Date) {
    return rawValue.toISOString();
  }

  const fallback = normalizeLookupKey(cell?.text ?? "");
  if (fallback && fallback !== "[object Object]") {
    return fallback;
  }

  return "";
}

function readCellNumber(cell) {
  const rawValue = unwrapCellValue(cell?.value);
  if (typeof rawValue === "number") {
    return parseNumber(rawValue);
  }
  if (typeof rawValue === "string") {
    return parseNumber(rawValue);
  }
  return parseNumber(readCellText(cell));
}

function readCellUrl(cell) {
  const rawValue = cell?.value;
  if (rawValue && typeof rawValue === "object" && typeof rawValue.hyperlink === "string") {
    return normalizeUrl(rawValue.hyperlink);
  }
  return normalizeUrl(readCellText(cell));
}

function sqlText(value) {
  if (value == null) {
    return "null";
  }
  const normalized = String(value).replace(/\u0000/g, "").trim();
  return `'${normalized.replace(/'/g, "''")}'`;
}

function sqlNumber(value) {
  if (value == null || Number.isNaN(value)) {
    return "null";
  }
  return String(value);
}

function hasHebrew(text) {
  return /[\u0590-\u05FF]/.test(text);
}

function normalizeSpaces(text) {
  return text.replace(/\s+/g, " ").trim();
}

function titleCaseWords(text) {
  return text
    .split(" ")
    .map((word) => {
      if (!word) return word;
      if (word.toUpperCase() === word) return word;
      return word.charAt(0).toUpperCase() + word.slice(1);
    })
    .join(" ");
}

function collapseRepeatedWords(text) {
  const words = normalizeSpaces(text).split(" ");
  const collapsed = [];
  for (const word of words) {
    if (!word) {
      continue;
    }
    const previous = collapsed[collapsed.length - 1];
    if (previous && previous.toLowerCase() === word.toLowerCase()) {
      continue;
    }
    collapsed.push(word);
  }
  return collapsed.join(" ");
}

function transliterateHebrew(text) {
  let output = "";
  for (const char of text) {
    if (canonicalHebrewCharMap.has(char)) {
      output += canonicalHebrewCharMap.get(char);
    } else if (hebrewCharMap.has(char)) {
      output += hebrewCharMap.get(char);
    } else {
      output += char;
    }
  }
  return output;
}

function translateText(input, { isRoom = false } = {}) {
  const text = normalizeLookupKey(input);
  if (!text) {
    return "";
  }

  const roomMapped = normalizedRoomExactMap.get(text) ?? normalizedRoomExactMap.get(text.toLowerCase());
  if (isRoom && roomMapped) {
    return roomMapped;
  }

  let out = text;
  for (const [sourcePhrase, translatedPhrase] of normalizedPhraseEntries) {
    out = out.replaceAll(sourcePhrase, translatedPhrase);
  }

  const tokens = out.split(/(\s+|[()\-/,.:;+|])/g);
  const mappedTokens = tokens.map((token) => {
    const trimmed = token.trim();
    if (!trimmed) {
      return token;
    }
    const mappedWord = normalizedWordMap.get(trimmed) ?? normalizedWordMap.get(trimmed.toLowerCase());
    if (mappedWord) {
      return token.replace(trimmed, mappedWord);
    }
    return token;
  });
  out = mappedTokens.join("");

  if (hasHebrew(out)) {
    out = transliterateHebrew(out);
  }

  out = normalizeSpaces(out);
  out = out.replace(/\s+([/,:;.\-)])/g, "$1");
  out = out.replace(/([(/-])\s+/g, "$1");
  out = collapseRepeatedWords(out);
  return titleCaseWords(out);
}

function parseNumber(value) {
  if (value == null) {
    return null;
  }
  if (typeof value === "number") {
    if (!Number.isFinite(value)) return null;
    return value;
  }
  const text = String(value).trim();
  if (!text) {
    return null;
  }
  const normalized = text.replace(/,/g, "").replace(/[^\d.-]/g, "");
  if (!normalized) {
    return null;
  }
  const parsed = Number(normalized);
  if (!Number.isFinite(parsed)) {
    return null;
  }
  return parsed;
}

function parseBoolean(value) {
  const text = String(value ?? "").trim().toLowerCase();
  if (!text) return false;
  return text.includes("\u2714") || text === "yes" || text === "true" || text === "1";
}

function inferRoomType(roomNameEn) {
  const text = roomNameEn.toLowerCase();
  if (text.includes("kitchen")) return "kitchen";
  if (text.includes("bath") || text.includes("toilet") || text.includes("wash")) return "bathroom";
  if (text.includes("bed") || text.includes("master") || text.includes("kids")) return "bedroom";
  if (text.includes("dining")) return "dining_room";
  if (text.includes("entry") || text.includes("hall")) return "entry";
  if (text.includes("laundry")) return "laundry";
  if (text.includes("outdoor") || text.includes("balcony") || text.includes("yard")) return "outdoor";
  if (text.includes("office") || text.includes("study")) return "office";
  return "living_room";
}

function inferBudgetCategory(itemNameEn, roomNameEn) {
  const text = `${itemNameEn} ${roomNameEn}`.toLowerCase();
  if (/(light|chandelier|lamp|fixture|led|sconce)/.test(text)) return "Lighting";
  if (/(tile|ceramic|porcelain|grout|cladding)/.test(text)) return "Tiles";
  if (/(bath|toilet|shower|sink|faucet|vanity)/.test(text)) return "Bathroom";
  if (/(kitchen|fridge|refrigerator|microwave|oven|dishwasher|cooktop|kettle)/.test(text)) return "Kitchen";
  if (/(decor|rug|curtain|pillow|art|mirror|plant|vase)/.test(text)) return "Decor";
  return "Furniture";
}

function choosePrice(actual, approx) {
  if (actual != null && actual > 0) return actual;
  if (approx != null && approx > 0) return approx;
  return null;
}

function normalizeQuantity(value) {
  const n = parseNumber(value);
  if (n == null || n <= 0) return 1;
  return Math.max(1, Math.round(n));
}

function normalizeUrl(text) {
  const t = normalizeSpaces(String(text ?? ""));
  if (!t) return "";
  if (t === "-" || t === "/") return "";
  return t;
}

async function parseMatrixWorkbook(records, seqStart) {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(MATRIX_WORKBOOK);
  const ws = workbook.worksheets[0];
  if (!ws) return seqStart;

  const houseGroups = [];
  const row1 = ws.getRow(1);
  const row2 = ws.getRow(2);
  const maxCol = ws.columnCount;

  for (let col = 1; col <= maxCol; col++) {
    const houseName = readCellText(row1.getCell(col));
    const sub = readCellText(row2.getCell(col)).toLowerCase();
    if (!houseName) continue;
    if (sub.includes("approximately")) {
      houseGroups.push({
        houseName: translateText(houseName, { isRoom: true }),
        approxCol: col,
        actualCol: col + 1,
        linkCol: col + 2,
        qtyCol: col + 3,
      });
    }
  }

  let currentRoomOriginal = "";
  let currentRoomEn = "";

  for (let rowIndex = 3; rowIndex <= ws.rowCount; rowIndex++) {
    const row = ws.getRow(rowIndex);
    const roomCell = readCellText(row.getCell(1));
    const itemOriginal = readCellText(row.getCell(2));

    if (roomCell) {
      currentRoomOriginal = roomCell;
      currentRoomEn = translateText(roomCell, { isRoom: true });
    }

    if (!itemOriginal) {
      continue;
    }

    const roomOriginal = currentRoomOriginal || "General";
    const roomEn = currentRoomEn || translateText(roomOriginal, { isRoom: true }) || "General";
    const itemEn = translateText(itemOriginal);

    for (const group of houseGroups) {
      const approx = readCellNumber(row.getCell(group.approxCol));
      const actual = readCellNumber(row.getCell(group.actualCol));
      const url = readCellUrl(row.getCell(group.linkCol));
      const qty = normalizeQuantity(readCellNumber(row.getCell(group.qtyCol)));
      const price = choosePrice(actual, approx);

      if (price == null && !url) {
        continue;
      }

      records.push({
        sourceSeq: seqStart++,
        sourceSheet: ws.name,
        houseName: group.houseName,
        roomNameOriginal: roomOriginal,
        roomNameEn: roomEn,
        roomType: inferRoomType(roomEn),
        itemNameOriginal: itemOriginal,
        itemNameEn: itemEn,
        objectCategory: inferBudgetCategory(itemEn, roomEn),
        budgetCategory: inferBudgetCategory(itemEn, roomEn),
        approxPrice: approx,
        actualPrice: actual,
        chosenPrice: price,
        quantity: qty,
        supplierName: "",
        sourceUrl: url,
        poApproved: false,
        isOrdered: false,
        isInstalled: false,
        notes: "",
      });
    }
  }

  return seqStart;
}

async function parseStructuredWorkbook(records, seqStart) {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(STRUCTURED_WORKBOOK);
  const ws = workbook.worksheets.find((sheet) => sheet.rowCount > 10 && sheet.columnCount > 10);
  if (!ws) return seqStart;

  const houseOriginal = normalizeLookupKey(ws.name || "Imported House");
  const houseNameEn = translateText(houseOriginal, { isRoom: true }) || "Beit Tsalka";
  let currentRoomOriginal = "";
  let currentRoomEn = "";

  for (let rowIndex = 2; rowIndex <= ws.rowCount; rowIndex++) {
    const row = ws.getRow(rowIndex);
    const roomCell = readCellText(row.getCell(1));
    const itemOriginal = readCellText(row.getCell(2));
    if (roomCell) {
      currentRoomOriginal = roomCell;
      currentRoomEn = translateText(roomCell, { isRoom: true });
    }
    if (!itemOriginal) {
      continue;
    }

    const roomOriginal = currentRoomOriginal || "General";
    const roomEn = currentRoomEn || translateText(roomOriginal, { isRoom: true }) || "General";
    const itemEn = translateText(itemOriginal);

    const approx = readCellNumber(row.getCell(4));
    const actual = readCellNumber(row.getCell(5));
    const qty = normalizeQuantity(readCellNumber(row.getCell(9)));
    const unitPrice = readCellNumber(row.getCell(10));
    const url = readCellUrl(row.getCell(11));
    const supplier = readCellText(row.getCell(12));
    const notes = readCellText(row.getCell(13));
    const poApproved = parseBoolean(readCellText(row.getCell(6)));
    const isOrdered = parseBoolean(readCellText(row.getCell(7)));
    const isInstalled = parseBoolean(readCellText(row.getCell(8)));

    let chosen = choosePrice(actual, approx);
    if (chosen == null && unitPrice != null && unitPrice > 0) {
      chosen = unitPrice;
    }

    if (chosen == null && !url) {
      continue;
    }

    records.push({
      sourceSeq: seqStart++,
      sourceSheet: ws.name,
      houseName: houseNameEn,
      roomNameOriginal: roomOriginal,
      roomNameEn: roomEn,
      roomType: inferRoomType(roomEn),
      itemNameOriginal: itemOriginal,
      itemNameEn: itemEn,
      objectCategory: inferBudgetCategory(itemEn, roomEn),
      budgetCategory: inferBudgetCategory(itemEn, roomEn),
      approxPrice: approx,
      actualPrice: actual,
      chosenPrice: chosen,
      quantity: qty,
      supplierName: supplier,
      sourceUrl: url,
      poApproved,
      isOrdered,
      isInstalled,
      notes,
    });
  }

  return seqStart;
}

function uniqueRecords(records) {
  const seen = new Set();
  const out = [];
  for (const rec of records) {
    const key = [
      rec.houseName.toLowerCase(),
      rec.roomNameEn.toLowerCase(),
      rec.itemNameEn.toLowerCase(),
      rec.sourceUrl.toLowerCase(),
      rec.chosenPrice ?? "",
      rec.quantity,
    ].join("||");
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    out.push(rec);
  }
  return out;
}

function buildSql(records) {
  const valuesSql = records
    .map((r) => {
      return `(
  ${sqlNumber(r.sourceSeq)},
  ${sqlText(r.sourceSheet)},
  ${sqlText(r.houseName)},
  ${sqlText(r.roomNameOriginal)},
  ${sqlText(r.roomNameEn)},
  ${sqlText(r.roomType)},
  ${sqlText(r.itemNameOriginal)},
  ${sqlText(r.itemNameEn)},
  ${sqlText(r.objectCategory)},
  ${sqlText(r.budgetCategory)},
  ${sqlNumber(r.approxPrice)},
  ${sqlNumber(r.actualPrice)},
  ${sqlNumber(r.chosenPrice)},
  ${sqlNumber(r.quantity)},
  ${sqlText(r.supplierName)},
  ${sqlText(r.sourceUrl)},
  ${r.poApproved ? "true" : "false"},
  ${r.isOrdered ? "true" : "false"},
  ${r.isInstalled ? "true" : "false"},
  ${sqlText(r.notes)}
)`;
    })
    .join(",\n");

  return `-- Generated by web/scripts/generate_customer_import_sql.mjs
-- Import source workbooks:
-- 1) ${MATRIX_WORKBOOK}
-- 2) ${STRUCTURED_WORKBOOK}

begin;

-- Allow project members to read materials selected inside their projects.
drop policy if exists "materials_project_member_select" on public.materials;
create policy "materials_project_member_select"
on public.materials
for select
using (
  owner_user_id = auth.uid()
  or exists (
    select 1
    from public.room_objects ro
    join public.rooms r on r.id = ro.room_id
    join public.houses h on h.id = r.house_id
    join public.project_members pm on pm.project_id = h.project_id
    where ro.selected_material_id = materials.id
      and pm.user_id = auth.uid()
  )
);

drop policy if exists "material_images_project_member_select" on public.material_images;
create policy "material_images_project_member_select"
on public.material_images
for select
using (
  exists (
    select 1
    from public.materials m
    where m.id = material_images.material_id
      and (
        m.owner_user_id = auth.uid()
        or exists (
          select 1
          from public.room_objects ro
          join public.rooms r on r.id = ro.room_id
          join public.houses h on h.id = r.house_id
          join public.project_members pm on pm.project_id = h.project_id
          where ro.selected_material_id = m.id
            and pm.user_id = auth.uid()
        )
      )
  )
);

do $$
declare
  v_owner_user_id uuid;
  v_collab_user_id uuid;
  v_project_id uuid;
begin
  select id into v_owner_user_id
  from auth.users
  where lower(email) = lower(${sqlText(OWNER_EMAIL)})
  limit 1;

  if v_owner_user_id is null then
    raise exception 'Owner user not found in auth.users for email: ${OWNER_EMAIL}';
  end if;

  select id into v_collab_user_id
  from auth.users
  where lower(email) = lower(${sqlText(COLLAB_EMAIL)})
  limit 1;

  if v_collab_user_id is null then
    raise exception 'Collaborator user not found in auth.users for email: ${COLLAB_EMAIL}';
  end if;

  insert into public.profiles (id)
  values (v_owner_user_id), (v_collab_user_id)
  on conflict (id) do nothing;

  select p.id
  into v_project_id
  from public.projects p
  where p.created_by = v_owner_user_id
    and lower(p.name) = lower(${sqlText(PROJECT_NAME)})
  order by p.created_at
  limit 1;

  if v_project_id is null then
    insert into public.projects (name, client_name, location, currency, created_by)
    values (${sqlText(PROJECT_NAME)}, ${sqlText("Imported Customer Data")}, ${sqlText("Thailand")}, ${sqlText(PROJECT_CURRENCY)}, v_owner_user_id)
    returning id into v_project_id;
  else
    update public.projects
    set
      client_name = ${sqlText("Imported Customer Data")},
      location = ${sqlText("Thailand")},
      currency = ${sqlText(PROJECT_CURRENCY)},
      updated_at = now()
    where id = v_project_id;
  end if;

  insert into public.project_members (project_id, user_id, role)
  values
    (v_project_id, v_owner_user_id, 'owner'),
    (v_project_id, v_collab_user_id, 'editor')
  on conflict (project_id, user_id) do update
    set role = excluded.role
    where public.project_members.role <> 'owner';

  -- Update-in-place rerun behavior:
  -- remove previously imported structure under this project before rebuilding.
  delete from public.houses
  where project_id = v_project_id;

  delete from public.project_budget_categories
  where project_id = v_project_id;

  insert into public.project_budgets (project_id, total_budget, currency)
  values (v_project_id, 0, ${sqlText(PROJECT_CURRENCY)})
  on conflict (project_id) do update
    set total_budget = excluded.total_budget,
        currency = excluded.currency,
        updated_at = now();

  create temporary table tmp_import_rows (
    source_seq integer not null,
    source_sheet text not null,
    house_name text not null,
    room_name_original text not null,
    room_name_en text not null,
    room_type text not null,
    item_name_original text not null,
    item_name_en text not null,
    object_category text not null,
    budget_category text not null,
    approx_price numeric(12,2),
    actual_price numeric(12,2),
    chosen_price numeric(12,2),
    quantity integer not null,
    supplier_name text,
    source_url text,
    po_approved boolean not null default false,
    is_ordered boolean not null default false,
    is_installed boolean not null default false,
    notes text
  ) on commit drop;

  insert into tmp_import_rows (
    source_seq, source_sheet, house_name, room_name_original, room_name_en, room_type,
    item_name_original, item_name_en, object_category, budget_category,
    approx_price, actual_price, chosen_price, quantity, supplier_name, source_url,
    po_approved, is_ordered, is_installed, notes
  )
  values
${valuesSql};

  with house_order as (
    select house_name, min(source_seq) as min_seq
    from tmp_import_rows
    group by house_name
  )
  insert into public.houses (project_id, name, sort_order)
  select v_project_id, ho.house_name, row_number() over (order by ho.min_seq) - 1
  from house_order ho
  order by ho.min_seq;

  with room_order as (
    select
      h.id as house_id,
      r.room_name_en as room_name_en,
      min(r.source_seq) as min_seq,
      (array_agg(r.room_type order by r.source_seq))[1] as room_type
    from tmp_import_rows r
    join public.houses h on h.project_id = v_project_id and h.name = r.house_name
    group by h.id, r.room_name_en
  )
  insert into public.rooms (house_id, name, room_type, sort_order)
  select
    ro.house_id,
    ro.room_name_en,
    ro.room_type,
    row_number() over (partition by ro.house_id order by ro.min_seq) - 1
  from room_order ro
  order by ro.house_id, ro.min_seq;

  create temporary table tmp_resolved_rows as
  select
    r.*,
    h.id as house_id,
    rm.id as room_id,
    ('SRI-' || v_project_id::text || '-' || r.source_seq::text) as import_sku
  from tmp_import_rows r
  join public.houses h
    on h.project_id = v_project_id
   and h.name = r.house_name
  join public.rooms rm
    on rm.house_id = h.id
   and rm.name = r.room_name_en;

  -- Preserve existing imported materials (and their fetched metadata/images) on rerun.
  -- Only backfill missing fields from the latest Excel rows.
  update public.materials m
  set
    supplier_name = coalesce(nullif(m.supplier_name, ''), nullif(rr.supplier_name, '')),
    description = coalesce(
      nullif(m.description, ''),
      nullif(
        trim(
          concat(
            'Original item: ', rr.item_name_original,
            case when rr.notes is not null and rr.notes <> '' then ' | Notes: ' || rr.notes else '' end
          )
        ),
        ''
      )
    ),
    price = case
      when coalesce(m.price, 0) <= 0 and rr.chosen_price is not null and rr.chosen_price > 0 then rr.chosen_price
      else m.price
    end,
    source_type = case
      when (m.source_url is null or m.source_url = '') and rr.source_url is not null and rr.source_url <> '' then 'link'
      else m.source_type
    end,
    source_url = coalesce(nullif(m.source_url, ''), nullif(rr.source_url, '')),
    is_private = false
  from tmp_resolved_rows rr
  where m.owner_user_id = v_owner_user_id
    and m.sku = rr.import_sku;

  insert into public.materials (
    owner_user_id,
    supplier_name,
    name,
    description,
    budget_category,
    price,
    currency,
    sku,
    source_type,
    source_url,
    is_private
  )
  select
    v_owner_user_id,
    nullif(supplier_name, ''),
    item_name_en,
    nullif(
      trim(
        concat(
          'Original item: ', item_name_original,
          case when notes is not null and notes <> '' then ' | Notes: ' || notes else '' end
        )
      ),
      ''
    ),
    budget_category,
    chosen_price,
    ${sqlText(PROJECT_CURRENCY)},
    import_sku,
    case when source_url is not null and source_url <> '' then 'link' else 'manual' end,
    nullif(source_url, ''),
    false
  from tmp_resolved_rows rr
  where not exists (
    select 1
    from public.materials m
    where m.owner_user_id = v_owner_user_id
      and m.sku = rr.import_sku
  );

  with object_rows as (
    select
      rr.*,
      m.id as material_id,
      row_number() over (partition by rr.room_id order by rr.source_seq) - 1 as sort_order
    from tmp_resolved_rows rr
    left join public.materials m
      on m.owner_user_id = v_owner_user_id
     and m.sku = rr.import_sku
  ),
  object_grouped as (
    select
      room_id,
      (array_agg(item_name_en order by source_seq))[1] as name,
      (array_agg(object_category order by source_seq))[1] as category,
      sum(greatest(1, quantity))::integer as quantity,
      (array_agg(material_id order by source_seq))[1] as material_id,
      bool_or(po_approved) as po_approved,
      bool_or(is_ordered) as is_ordered,
      bool_or(is_installed) as is_installed,
      min(sort_order) as sort_order
    from object_rows
    group by room_id, lower(item_name_en)
  )
  insert into public.room_objects (
    room_id,
    name,
    category,
    quantity,
    material_search_query,
    selected_material_id,
    po_approved,
    is_ordered,
    is_installed,
    sort_order
  )
  select
    room_id,
    name,
    category,
    greatest(1, quantity),
    lower(name),
    material_id,
    po_approved,
    is_ordered,
    is_installed,
    sort_order
  from object_grouped
  order by room_id, sort_order;

  raise notice 'Imported project % with % objects', v_project_id, (select count(*) from tmp_resolved_rows);
end;
$$;

commit;
`;
}

async function main() {
  const records = [];
  let seq = 1;
  seq = await parseMatrixWorkbook(records, seq);
  seq = await parseStructuredWorkbook(records, seq);

  const cleaned = uniqueRecords(records).filter((r) => r.itemNameEn && r.roomNameEn && r.houseName);
  cleaned.sort((a, b) => a.sourceSeq - b.sourceSeq);

  const sql = buildSql(cleaned);
  fs.mkdirSync(path.dirname(OUTPUT_SQL), { recursive: true });
  fs.writeFileSync(OUTPUT_SQL, sql, "utf8");

  const countsByHouse = cleaned.reduce((acc, row) => {
    acc[row.houseName] = (acc[row.houseName] || 0) + 1;
    return acc;
  }, {});

  console.log(`Generated SQL: ${OUTPUT_SQL}`);
  console.log(`Rows imported: ${cleaned.length}`);
  console.log("Rows by house:", countsByHouse);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});



