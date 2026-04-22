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
