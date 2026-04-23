// Hardcoded sample data for the Canvas + Inspector mockup.
// This is purely presentational — no Supabase, no mutations.

export type WorkflowStage = "planned" | "sourcing" | "selected" | "ordered" | "installed";

export interface MockObject {
  id: string;
  name: string;
  qty: number;
  budget: number | null;
  spent: number | null;
  stage: WorkflowStage;
  selectedProduct?: { name: string; supplier: string; price: number };
}

export interface MockRoom {
  id: string;
  name: string;
  objects: MockObject[];
  plannedBudget: number;
}

export interface MockHouse {
  id: string;
  name: string;
  rooms: MockRoom[];
  sizeSqm: number;
}

export interface MockProject {
  id: string;
  name: string;
  client: string;
  location: string;
  currency: string;
  totalBudget: number;
  houses: MockHouse[];
}

export const SAMPLE_PROJECT: MockProject = {
  id: "palm-heights",
  name: "Palm Heights",
  client: "Haddad Family",
  location: "Abu Dhabi",
  currency: "USD",
  totalBudget: 420000,
  houses: [
    {
      id: "main-villa",
      name: "Main Villa",
      sizeSqm: 360,
      rooms: [
        {
          id: "kitchen",
          name: "Kitchen",
          plannedBudget: 28000,
          objects: [
            {
              id: "o-sink",
              name: "Sink",
              qty: 1,
              budget: 900,
              spent: 820,
              stage: "selected",
              selectedProduct: { name: "Grohe K7 Undermount", supplier: "Grohe", price: 820 },
            },
            {
              id: "o-faucet",
              name: "Faucet",
              qty: 1,
              budget: 600,
              spent: null,
              stage: "sourcing",
            },
            {
              id: "o-backsplash",
              name: "Backsplash",
              qty: 1,
              budget: 1800,
              spent: 2100,
              stage: "selected",
              selectedProduct: { name: "Calacatta Marble 60×120", supplier: "Stone Gallery", price: 2100 },
            },
            {
              id: "o-cabinets",
              name: "Cabinets",
              qty: 12,
              budget: 14000,
              spent: 13200,
              stage: "ordered",
              selectedProduct: { name: "Shaker White Oak", supplier: "Muji Atelier", price: 1100 },
            },
            {
              id: "o-pulls",
              name: "Cabinet pulls",
              qty: 24,
              budget: 480,
              spent: null,
              stage: "planned",
            },
          ],
        },
        {
          id: "bath-master",
          name: "Master Bathroom",
          plannedBudget: 18000,
          objects: [
            {
              id: "o-vanity",
              name: "Vanity",
              qty: 1,
              budget: 4200,
              spent: 4200,
              stage: "installed",
              selectedProduct: { name: "Duravit L-Cube 120", supplier: "Duravit", price: 4200 },
            },
            {
              id: "o-mirror",
              name: "Mirror",
              qty: 1,
              budget: 600,
              spent: null,
              stage: "sourcing",
            },
            {
              id: "o-shower",
              name: "Shower set",
              qty: 1,
              budget: 1800,
              spent: 1650,
              stage: "selected",
              selectedProduct: { name: "Hansgrohe Raindance", supplier: "Hansgrohe", price: 1650 },
            },
          ],
        },
        {
          id: "living",
          name: "Living Room",
          plannedBudget: 45000,
          objects: [
            { id: "o-sofa", name: "Sofa", qty: 1, budget: 6500, spent: null, stage: "sourcing" },
            { id: "o-rug", name: "Rug", qty: 1, budget: 3200, spent: null, stage: "planned" },
            { id: "o-coffee", name: "Coffee table", qty: 1, budget: 1200, spent: null, stage: "planned" },
          ],
        },
      ],
    },
    {
      id: "guest-house",
      name: "Guest House",
      sizeSqm: 120,
      rooms: [
        {
          id: "guest-bed",
          name: "Guest Bedroom",
          plannedBudget: 8000,
          objects: [
            { id: "o-bed", name: "Bed frame", qty: 1, budget: 1800, spent: null, stage: "planned" },
            { id: "o-wardrobe", name: "Wardrobe", qty: 1, budget: 2200, spent: null, stage: "planned" },
          ],
        },
        {
          id: "guest-bath",
          name: "Guest Bathroom",
          plannedBudget: 6000,
          objects: [
            { id: "o-g-vanity", name: "Vanity", qty: 1, budget: 1800, spent: null, stage: "planned" },
          ],
        },
      ],
    },
  ],
};

export const WORKFLOW_STAGE_META: Record<WorkflowStage, { label: string; color: string; dot: string }> = {
  planned: { label: "Planned", color: "border-slate-200 bg-slate-50 text-slate-600", dot: "bg-slate-400" },
  sourcing: { label: "Sourcing", color: "border-blue-200 bg-blue-50 text-blue-700", dot: "bg-blue-500" },
  selected: { label: "Selected", color: "border-violet-200 bg-violet-50 text-violet-700", dot: "bg-violet-500" },
  ordered: { label: "Ordered", color: "border-amber-200 bg-amber-50 text-amber-700", dot: "bg-amber-500" },
  installed: { label: "Installed", color: "border-emerald-200 bg-emerald-50 text-emerald-700", dot: "bg-emerald-500" },
};

export function formatMoney(n: number | null | undefined, currency = "USD") {
  if (n === null || n === undefined) return "—";
  return new Intl.NumberFormat("en-US", { style: "currency", currency, maximumFractionDigits: 0 }).format(n);
}

export function sumSpent(objects: MockObject[]): number {
  return objects.reduce((acc, o) => acc + (o.spent ?? 0), 0);
}

export function sumBudget(objects: MockObject[]): number {
  return objects.reduce((acc, o) => acc + (o.budget ?? 0), 0);
}

export function roomTotals(room: MockRoom) {
  const spent = sumSpent(room.objects);
  const budget = room.plannedBudget;
  const pct = budget > 0 ? Math.min(100, Math.round((spent / budget) * 100)) : 0;
  const health: "ok" | "warn" | "over" = pct < 85 ? "ok" : pct < 100 ? "warn" : "over";
  return { spent, budget, pct, health };
}

export function houseTotals(house: MockHouse) {
  const all = house.rooms.flatMap((r) => r.objects);
  const spent = sumSpent(all);
  const budget = house.rooms.reduce((acc, r) => acc + r.plannedBudget, 0);
  const pct = budget > 0 ? Math.min(100, Math.round((spent / budget) * 100)) : 0;
  return { spent, budget, pct, objectCount: all.length };
}

export function projectTotals(project: MockProject) {
  const spent = project.houses.reduce((acc, h) => acc + houseTotals(h).spent, 0);
  const budget = project.totalBudget;
  const pct = budget > 0 ? Math.min(100, Math.round((spent / budget) * 100)) : 0;
  const objectCount = project.houses.reduce((acc, h) => acc + houseTotals(h).objectCount, 0);
  const roomCount = project.houses.reduce((acc, h) => acc + h.rooms.length, 0);
  return { spent, budget, pct, objectCount, roomCount, houseCount: project.houses.length };
}

/* ─────────────────────────── Library types & data ─────────────────────────── */

export type ProductCategory =
  | "Flooring"
  | "Wall finish"
  | "Bathroom"
  | "Kitchen"
  | "Lighting"
  | "Furniture"
  | "Hardware"
  | "Outdoor";

export type ProductStyle = "Modern" | "Classic" | "Industrial" | "Coastal" | "Japandi";

export interface LibraryProduct {
  id: string;
  name: string;
  supplier: string;
  category: ProductCategory;
  roomTypes: string[];
  style: ProductStyle;
  priceUsd: number;
  imageColor: string;
  tags: string[];
  inShortlists?: string[];
}

export interface Shortlist {
  id: string;
  name: string;
  productIds: string[];
}

export const SAMPLE_LIBRARY: LibraryProduct[] = [
  // Flooring — Modern
  {
    id: "lib-001",
    name: "Chevron White Oak Engineered",
    supplier: "Boen",
    category: "Flooring",
    roomTypes: ["Living Room", "Bedroom", "Hallway"],
    style: "Modern",
    priceUsd: 120,
    imageColor: "bg-amber-100",
    tags: ["oak", "engineered", "chevron", "wood"],
  },
  // Flooring — Japandi
  {
    id: "lib-002",
    name: "Smoked Ash Wide Plank",
    supplier: "Dinesen",
    category: "Flooring",
    roomTypes: ["Living Room", "Bedroom"],
    style: "Japandi",
    priceUsd: 185,
    imageColor: "bg-stone-300",
    tags: ["ash", "smoked", "wide plank", "wood"],
  },
  // Flooring — Coastal
  {
    id: "lib-003",
    name: "Limewash Travertine 60×60",
    supplier: "Stone Gallery",
    category: "Flooring",
    roomTypes: ["Kitchen", "Bathroom", "Outdoor"],
    style: "Coastal",
    priceUsd: 95,
    imageColor: "bg-stone-200",
    tags: ["travertine", "stone", "natural", "tile"],
  },
  // Wall finish — Classic
  {
    id: "lib-004",
    name: "Veneziano Stucco Plaster",
    supplier: "Oikos",
    category: "Wall finish",
    roomTypes: ["Living Room", "Bedroom", "Hallway"],
    style: "Classic",
    priceUsd: 48,
    imageColor: "bg-yellow-50",
    tags: ["stucco", "plaster", "venetian", "finish"],
  },
  // Wall finish — Industrial
  {
    id: "lib-005",
    name: "Micro-Cement Graphite",
    supplier: "Topciment",
    category: "Wall finish",
    roomTypes: ["Kitchen", "Bathroom", "Living Room"],
    style: "Industrial",
    priceUsd: 62,
    imageColor: "bg-slate-500",
    tags: ["micro-cement", "graphite", "seamless", "finish"],
  },
  // Wall finish — Japandi
  {
    id: "lib-006",
    name: "Wabi-Sabi Clay Wash",
    supplier: "Clayworks",
    category: "Wall finish",
    roomTypes: ["Bedroom", "Living Room"],
    style: "Japandi",
    priceUsd: 55,
    imageColor: "bg-stone-400",
    tags: ["clay", "natural", "texture", "matte"],
  },
  // Bathroom — Modern
  {
    id: "lib-007",
    name: "Axor Starck Thermostatic Shower",
    supplier: "Hansgrohe",
    category: "Bathroom",
    roomTypes: ["Bathroom"],
    style: "Modern",
    priceUsd: 2400,
    imageColor: "bg-slate-200",
    tags: ["shower", "thermostatic", "chrome", "wall-mounted"],
  },
  // Bathroom — Classic
  {
    id: "lib-008",
    name: "Perrin & Rowe Edwardian Freestanding Tub Filler",
    supplier: "Perrin & Rowe",
    category: "Bathroom",
    roomTypes: ["Bathroom"],
    style: "Classic",
    priceUsd: 1850,
    imageColor: "bg-amber-200",
    tags: ["faucet", "freestanding", "brass", "classic"],
  },
  // Bathroom — Coastal
  {
    id: "lib-009",
    name: "Duravit White Tulip Bathtub",
    supplier: "Duravit",
    category: "Bathroom",
    roomTypes: ["Bathroom"],
    style: "Coastal",
    priceUsd: 3200,
    imageColor: "bg-sky-100",
    tags: ["bathtub", "freestanding", "white", "acrylic"],
  },
  // Kitchen — Modern
  {
    id: "lib-010",
    name: "Bora Classic Induction Cooktop",
    supplier: "Bora",
    category: "Kitchen",
    roomTypes: ["Kitchen"],
    style: "Modern",
    priceUsd: 2900,
    imageColor: "bg-slate-700",
    tags: ["cooktop", "induction", "ventilation", "flush"],
  },
  // Kitchen — Industrial
  {
    id: "lib-011",
    name: "La Cornue CornuFe 110 Range",
    supplier: "La Cornue",
    category: "Kitchen",
    roomTypes: ["Kitchen"],
    style: "Industrial",
    priceUsd: 8500,
    imageColor: "bg-rose-700",
    tags: ["range", "gas", "french", "statement"],
  },
  // Kitchen — Japandi
  {
    id: "lib-012",
    name: "Grohe K7 Semi-Pro Faucet",
    supplier: "Grohe",
    category: "Kitchen",
    roomTypes: ["Kitchen"],
    style: "Japandi",
    priceUsd: 620,
    imageColor: "bg-teal-600",
    tags: ["faucet", "pull-down", "semi-pro", "stainless"],
  },
  // Lighting — Modern
  {
    id: "lib-013",
    name: "Vibia Wireflow Linear Pendant",
    supplier: "Vibia",
    category: "Lighting",
    roomTypes: ["Living Room", "Kitchen", "Dining"],
    style: "Modern",
    priceUsd: 1200,
    imageColor: "bg-zinc-800",
    tags: ["pendant", "linear", "LED", "suspension"],
  },
  // Lighting — Classic
  {
    id: "lib-014",
    name: "Vaughan Designs Tole Chandelier",
    supplier: "Vaughan Designs",
    category: "Lighting",
    roomTypes: ["Living Room", "Dining", "Hallway"],
    style: "Classic",
    priceUsd: 3400,
    imageColor: "bg-amber-300",
    tags: ["chandelier", "tole", "brass", "antique"],
  },
  // Lighting — Coastal
  {
    id: "lib-015",
    name: "Articolo Float Pendant",
    supplier: "Articolo",
    category: "Lighting",
    roomTypes: ["Bedroom", "Living Room"],
    style: "Coastal",
    priceUsd: 980,
    imageColor: "bg-sky-200",
    tags: ["pendant", "glass", "blown", "sculptural"],
  },
  // Furniture — Modern
  {
    id: "lib-016",
    name: "Minotti Rodriguez Sectional",
    supplier: "Minotti",
    category: "Furniture",
    roomTypes: ["Living Room"],
    style: "Modern",
    priceUsd: 18500,
    imageColor: "bg-stone-600",
    tags: ["sofa", "sectional", "modular", "linen"],
  },
  // Furniture — Japandi
  {
    id: "lib-017",
    name: "Karimoku New Standard Castor Lounge Chair",
    supplier: "Karimoku",
    category: "Furniture",
    roomTypes: ["Living Room", "Bedroom"],
    style: "Japandi",
    priceUsd: 4200,
    imageColor: "bg-amber-700",
    tags: ["lounge chair", "oak", "fabric", "japanese"],
  },
  // Furniture — Coastal
  {
    id: "lib-018",
    name: "Tribu Tosca Outdoor Dining Table",
    supplier: "Tribu",
    category: "Furniture",
    roomTypes: ["Outdoor", "Dining"],
    style: "Coastal",
    priceUsd: 5800,
    imageColor: "bg-teal-200",
    tags: ["dining table", "teak", "outdoor", "extendable"],
  },
  // Hardware — Modern
  {
    id: "lib-019",
    name: "Valli & Valli H1024 Lever Handle",
    supplier: "Valli & Valli",
    category: "Hardware",
    roomTypes: ["All"],
    style: "Modern",
    priceUsd: 380,
    imageColor: "bg-slate-400",
    tags: ["door handle", "lever", "stainless", "brushed"],
  },
  // Hardware — Classic
  {
    id: "lib-020",
    name: "Turnstyle Designs Amalfitana Pull",
    supplier: "Turnstyle Designs",
    category: "Hardware",
    roomTypes: ["Kitchen", "Bathroom"],
    style: "Classic",
    priceUsd: 145,
    imageColor: "bg-yellow-700",
    tags: ["cabinet pull", "brass", "rope", "artisan"],
  },
  // Hardware — Industrial
  {
    id: "lib-021",
    name: "Formani BASICS Matte Black Pull",
    supplier: "Formani",
    category: "Hardware",
    roomTypes: ["Kitchen", "Bathroom", "Bedroom"],
    style: "Industrial",
    priceUsd: 88,
    imageColor: "bg-zinc-900",
    tags: ["cabinet pull", "matte black", "minimal", "bar"],
  },
  // Outdoor — Coastal
  {
    id: "lib-022",
    name: "Dedon Mbrace Hanging Chair",
    supplier: "Dedon",
    category: "Outdoor",
    roomTypes: ["Outdoor"],
    style: "Coastal",
    priceUsd: 6200,
    imageColor: "bg-teal-500",
    tags: ["hanging chair", "wicker", "outdoor", "lounge"],
  },
  // Outdoor — Modern
  {
    id: "lib-023",
    name: "Gandia Blasco Flat Daybed",
    supplier: "Gandia Blasco",
    category: "Outdoor",
    roomTypes: ["Outdoor"],
    style: "Modern",
    priceUsd: 4800,
    imageColor: "bg-rose-200",
    tags: ["daybed", "outdoor", "sunbed", "pool"],
  },
  // Outdoor — Industrial
  {
    id: "lib-024",
    name: "Corten Steel Planter Box 120cm",
    supplier: "Atelier Vierkant",
    category: "Outdoor",
    roomTypes: ["Outdoor"],
    style: "Industrial",
    priceUsd: 1100,
    imageColor: "bg-orange-700",
    tags: ["planter", "corten", "steel", "outdoor"],
  },
];

export const SAMPLE_SHORTLISTS: Shortlist[] = [
  {
    id: "warm-minimal",
    name: "Warm minimal palette",
    productIds: ["lib-001", "lib-006", "lib-017", "lib-019", "lib-004", "lib-013"],
  },
  {
    id: "coastal-bath",
    name: "Coastal bathroom ideas",
    productIds: ["lib-009", "lib-003", "lib-015", "lib-022", "lib-008"],
  },
  {
    id: "haddad-kitchen",
    name: "Kitchen – Haddad",
    productIds: ["lib-010", "lib-012", "lib-020", "lib-005", "lib-013", "lib-021"],
  },
];

export function filterLibrary(
  products: LibraryProduct[],
  opts: {
    search?: string;
    category?: ProductCategory | null;
    style?: ProductStyle | null;
    shortlistId?: string | null;
    shortlists?: Shortlist[];
    maxPriceUsd?: number | null;
    minPriceUsd?: number | null;
  }
): LibraryProduct[] {
  let result = products;
  if (opts.shortlistId && opts.shortlists) {
    const list = opts.shortlists.find((s) => s.id === opts.shortlistId);
    if (list) result = result.filter((p) => list.productIds.includes(p.id));
  }
  if (opts.category) result = result.filter((p) => p.category === opts.category);
  if (opts.style) result = result.filter((p) => p.style === opts.style);
  if (opts.minPriceUsd != null) result = result.filter((p) => p.priceUsd >= opts.minPriceUsd!);
  if (opts.maxPriceUsd != null) result = result.filter((p) => p.priceUsd <= opts.maxPriceUsd!);
  if (opts.search) {
    const q = opts.search.toLowerCase();
    result = result.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        p.supplier.toLowerCase().includes(q) ||
        p.tags.some((t) => t.toLowerCase().includes(q))
    );
  }
  return result;
}
