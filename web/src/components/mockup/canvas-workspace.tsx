"use client";

import { useMemo, useState } from "react";
import {
  ChevronDown,
  ChevronRight,
  Grid3x3,
  Home,
  LayoutGrid,
  Link as LinkIcon,
  Plus,
  Search,
  Share2,
  Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
  SAMPLE_PROJECT,
  WORKFLOW_STAGE_META,
  formatMoney,
  houseTotals,
  projectTotals,
  roomTotals,
  type MockHouse,
  type MockObject,
  type MockProject,
  type MockRoom,
} from "./mockup-data";

type Mode = "canvas" | "spreadsheet" | "client";

type Selection =
  | { kind: "project" }
  | { kind: "house"; houseId: string }
  | { kind: "room"; houseId: string; roomId: string }
  | { kind: "object"; houseId: string; roomId: string; objectId: string };

export function CanvasWorkspace() {
  const project = SAMPLE_PROJECT;
  const [mode, setMode] = useState<Mode>("canvas");
  const [selection, setSelection] = useState<Selection>({ kind: "project" });
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});

  function toggleHouse(houseId: string) {
    setCollapsed((prev) => ({ ...prev, [houseId]: !prev[houseId] }));
  }

  return (
    <div className="flex h-screen flex-col bg-slate-50 text-slate-900">
      {/* ───── Top Bar ───── */}
      <header className="flex shrink-0 items-center justify-between gap-4 border-b border-slate-200 bg-white/95 px-5 py-3 backdrop-blur">
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-md bg-gradient-to-br from-blue-600 to-violet-600 text-white">
            <Sparkles className="h-4 w-4" />
          </div>
          <div>
            <p className="text-xs uppercase tracking-wide text-slate-400">Mockup — Canvas + Inspector</p>
            <p className="text-sm font-semibold text-slate-900">
              {project.name}
              <span className="ml-2 text-xs font-normal text-slate-500">
                · {project.client} · {project.location}
              </span>
            </p>
          </div>
        </div>

        <div className="relative w-full max-w-md">
          <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
          <Input placeholder="Search rooms, objects, products…" className="h-9 rounded-full bg-slate-100 pl-9 text-sm" />
        </div>

        <div className="flex items-center gap-2">
          {/* Mode toggle replaces tabs */}
          <div className="flex items-center gap-0.5 rounded-lg border border-slate-200 bg-slate-50 p-0.5">
            <ModeButton active={mode === "canvas"} onClick={() => setMode("canvas")} icon={<LayoutGrid className="h-3.5 w-3.5" />} label="Canvas" />
            <ModeButton active={mode === "spreadsheet"} onClick={() => setMode("spreadsheet")} icon={<Grid3x3 className="h-3.5 w-3.5" />} label="Sheet" />
            <ModeButton active={mode === "client"} onClick={() => setMode("client")} icon={<Share2 className="h-3.5 w-3.5" />} label="Client" />
          </div>
          <Button size="sm" className="h-8 bg-blue-600 hover:bg-blue-700">
            <Plus className="h-3.5 w-3.5" /> Add
          </Button>
        </div>
      </header>

      {/* ───── 3-pane body ───── */}
      <div className="grid min-h-0 flex-1 grid-cols-[240px_minmax(0,1fr)_360px]">
        {/* Outline */}
        <Outline
          project={project}
          selection={selection}
          collapsed={collapsed}
          onToggleHouse={toggleHouse}
          onSelect={setSelection}
        />

        {/* Canvas */}
        <main className="min-w-0 overflow-y-auto">
          {mode === "canvas" ? (
            <Canvas project={project} selection={selection} onSelect={setSelection} />
          ) : mode === "spreadsheet" ? (
            <ModePlaceholder title="Spreadsheet mode" description="Tabular view of every object across the project — edit in-place, sort, and bulk-assign." />
          ) : (
            <ModePlaceholder title="Client view mode" description="Same project, presented as a curated read-only share for the client. Price visibility is togglable." />
          )}
        </main>

        {/* Inspector */}
        <Inspector project={project} selection={selection} />
      </div>
    </div>
  );
}

/* ─────────────────────────── Sub-components ─────────────────────────── */

function ModeButton({ active, onClick, icon, label }: { active: boolean; onClick: () => void; icon: React.ReactNode; label: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium transition",
        active ? "bg-white text-slate-900 shadow-sm" : "text-slate-600 hover:text-slate-900"
      )}
    >
      {icon}
      {label}
    </button>
  );
}

function Outline({
  project,
  selection,
  collapsed,
  onToggleHouse,
  onSelect,
}: {
  project: MockProject;
  selection: Selection;
  collapsed: Record<string, boolean>;
  onToggleHouse: (id: string) => void;
  onSelect: (s: Selection) => void;
}) {
  const isProjectSelected = selection.kind === "project";
  return (
    <aside className="flex min-h-0 flex-col border-r border-slate-200 bg-white">
      <div className="shrink-0 border-b border-slate-200 px-3 py-3">
        <button
          type="button"
          onClick={() => onSelect({ kind: "project" })}
          className={cn(
            "w-full rounded-md px-2 py-1.5 text-left text-sm font-semibold transition",
            isProjectSelected ? "bg-blue-50 text-blue-700" : "text-slate-800 hover:bg-slate-50"
          )}
        >
          {project.name}
        </button>
      </div>
      <div className="flex-1 overflow-y-auto px-2 py-2">
        {project.houses.map((house) => {
          const isCollapsed = collapsed[house.id] ?? false;
          const houseSelected = selection.kind === "house" && selection.houseId === house.id;
          return (
            <div key={house.id} className="mb-1">
              <div className="flex items-center">
                <button type="button" onClick={() => onToggleHouse(house.id)} className="flex h-7 w-5 items-center justify-center text-slate-400 hover:text-slate-700">
                  {isCollapsed ? <ChevronRight className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                </button>
                <button
                  type="button"
                  onClick={() => onSelect({ kind: "house", houseId: house.id })}
                  className={cn(
                    "flex flex-1 items-center gap-1.5 rounded-md px-1.5 py-1 text-left text-xs font-medium transition",
                    houseSelected ? "bg-blue-50 text-blue-700" : "text-slate-700 hover:bg-slate-50"
                  )}
                >
                  <Home className="h-3.5 w-3.5 text-slate-400" />
                  <span className="truncate">{house.name}</span>
                </button>
              </div>
              {!isCollapsed ? (
                <ul className="ml-6 mt-0.5 space-y-0.5">
                  {house.rooms.map((room) => {
                    const active = selection.kind === "room" && selection.roomId === room.id;
                    return (
                      <li key={room.id}>
                        <button
                          type="button"
                          onClick={() => onSelect({ kind: "room", houseId: house.id, roomId: room.id })}
                          className={cn(
                            "flex w-full items-center justify-between rounded-md px-2 py-1 text-left text-xs transition",
                            active ? "bg-blue-50 text-blue-700" : "text-slate-600 hover:bg-slate-50"
                          )}
                        >
                          <span className="truncate">{room.name}</span>
                          <span className="text-[10px] text-slate-400">{room.objects.length}</span>
                        </button>
                      </li>
                    );
                  })}
                  <li>
                    <button type="button" className="flex w-full items-center gap-1 rounded-md px-2 py-1 text-left text-[11px] text-slate-400 hover:bg-slate-50 hover:text-slate-700">
                      <Plus className="h-3 w-3" /> Add room
                    </button>
                  </li>
                </ul>
              ) : null}
            </div>
          );
        })}
        <button type="button" className="mt-2 flex w-full items-center gap-1.5 rounded-md border border-dashed border-slate-200 px-2 py-2 text-xs font-medium text-slate-500 hover:border-blue-300 hover:bg-blue-50 hover:text-blue-700">
          <Plus className="h-3.5 w-3.5" /> Add house
        </button>
      </div>
    </aside>
  );
}

function Canvas({ project, selection, onSelect }: { project: MockProject; selection: Selection; onSelect: (s: Selection) => void }) {
  const totals = projectTotals(project);
  return (
    <div className="mx-auto max-w-4xl space-y-5 px-6 py-6">
      {/* Project header card */}
      <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-xl font-semibold text-slate-900">{project.name}</h1>
            <p className="mt-0.5 text-xs text-slate-500">
              {totals.houseCount} houses · {totals.roomCount} rooms · {totals.objectCount} objects
            </p>
          </div>
          <div className="text-right">
            <p className="text-xs uppercase tracking-wide text-slate-400">Total budget</p>
            <p className="text-lg font-semibold text-slate-900">{formatMoney(project.totalBudget, project.currency)}</p>
          </div>
        </div>
        <BudgetBar pct={totals.pct} spent={totals.spent} budget={totals.budget} currency={project.currency} />
      </section>

      {/* Houses */}
      {project.houses.map((house) => (
        <HouseCard key={house.id} house={house} project={project} selection={selection} onSelect={onSelect} />
      ))}
    </div>
  );
}

function HouseCard({
  house,
  project,
  selection,
  onSelect,
}: {
  house: MockHouse;
  project: MockProject;
  selection: Selection;
  onSelect: (s: Selection) => void;
}) {
  const totals = houseTotals(house);
  return (
    <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
      <button
        type="button"
        onClick={() => onSelect({ kind: "house", houseId: house.id })}
        className="flex w-full items-center justify-between gap-3 border-b border-slate-100 px-5 py-3 text-left hover:bg-slate-50"
      >
        <div className="flex items-center gap-2">
          <Home className="h-4 w-4 text-slate-500" />
          <h2 className="text-base font-semibold text-slate-900">{house.name}</h2>
          <span className="text-xs text-slate-400">· {house.sizeSqm} m²</span>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs text-slate-500">{formatMoney(totals.spent, project.currency)} / {formatMoney(totals.budget, project.currency)}</span>
          <div className="h-1.5 w-32 overflow-hidden rounded-full bg-slate-100">
            <div className={cn("h-full", totals.pct < 85 ? "bg-emerald-500" : totals.pct < 100 ? "bg-amber-500" : "bg-red-500")} style={{ width: `${totals.pct}%` }} />
          </div>
        </div>
      </button>

      <div className="divide-y divide-slate-100">
        {house.rooms.map((room) => (
          <RoomRow key={room.id} room={room} houseId={house.id} project={project} selection={selection} onSelect={onSelect} />
        ))}
      </div>
    </section>
  );
}

function RoomRow({
  room,
  houseId,
  project,
  selection,
  onSelect,
}: {
  room: MockRoom;
  houseId: string;
  project: MockProject;
  selection: Selection;
  onSelect: (s: Selection) => void;
}) {
  const totals = roomTotals(room);
  const isRoomSelected = selection.kind === "room" && selection.roomId === room.id;
  const healthBar = totals.health === "ok" ? "bg-emerald-500" : totals.health === "warn" ? "bg-amber-500" : "bg-red-500";

  return (
    <div className={cn("px-5 py-3 transition", isRoomSelected ? "bg-blue-50/40" : "")}>
      <button
        type="button"
        onClick={() => onSelect({ kind: "room", houseId, roomId: room.id })}
        className="flex w-full items-center justify-between gap-3 text-left"
      >
        <div className="flex min-w-0 items-center gap-2">
          <span className={cn("h-2 w-2 shrink-0 rounded-full", healthBar)} />
          <h3 className="truncate text-sm font-semibold text-slate-800">{room.name}</h3>
          <span className="text-xs text-slate-400">· {room.objects.length} objects</span>
        </div>
        <div className="flex shrink-0 items-center gap-2 text-xs text-slate-500">
          <span>{formatMoney(totals.spent, project.currency)} / {formatMoney(totals.budget, project.currency)}</span>
          <div className="h-1 w-20 overflow-hidden rounded-full bg-slate-100">
            <div className={cn("h-full", healthBar)} style={{ width: `${totals.pct}%` }} />
          </div>
        </div>
      </button>

      {/* Objects inline */}
      <ul className="mt-2 space-y-1">
        {room.objects.map((object) => (
          <ObjectRow
            key={object.id}
            object={object}
            isSelected={selection.kind === "object" && selection.objectId === object.id}
            currency={project.currency}
            onSelect={() => onSelect({ kind: "object", houseId, roomId: room.id, objectId: object.id })}
          />
        ))}
        <li>
          <button type="button" className="flex w-full items-center gap-1.5 rounded-md px-2 py-1.5 text-left text-[11px] text-slate-400 hover:bg-slate-50 hover:text-slate-700">
            <Plus className="h-3 w-3" /> Add object
          </button>
        </li>
      </ul>
    </div>
  );
}

function ObjectRow({
  object,
  isSelected,
  currency,
  onSelect,
}: {
  object: MockObject;
  isSelected: boolean;
  currency: string;
  onSelect: () => void;
}) {
  const stage = WORKFLOW_STAGE_META[object.stage];
  const overBudget = object.spent !== null && object.budget !== null && object.spent > object.budget;
  return (
    <li>
      <button
        type="button"
        onClick={onSelect}
        className={cn(
          "flex w-full items-center gap-3 rounded-md border px-2.5 py-1.5 text-left text-xs transition",
          isSelected ? "border-blue-300 bg-white shadow-sm" : "border-transparent hover:border-slate-200 hover:bg-white"
        )}
      >
        <span className={cn("h-1.5 w-1.5 shrink-0 rounded-full", stage.dot)} />
        <span className="min-w-0 flex-1 truncate font-medium text-slate-800">
          {object.name}
          {object.qty > 1 ? <span className="ml-1 text-slate-400">×{object.qty}</span> : null}
        </span>
        <span className="max-w-[160px] truncate text-[11px] text-slate-500">
          {object.selectedProduct ? object.selectedProduct.name : "—"}
        </span>
        <span className={cn("shrink-0 tabular-nums", overBudget ? "text-red-600" : "text-slate-500")}>
          {formatMoney(object.spent, currency)}
        </span>
        <span className={cn("inline-flex shrink-0 items-center rounded-full border px-1.5 py-0.5 text-[10px] font-medium", stage.color)}>
          {stage.label}
        </span>
      </button>
    </li>
  );
}

function BudgetBar({ pct, spent, budget, currency }: { pct: number; spent: number; budget: number; currency: string }) {
  const color = pct < 85 ? "bg-emerald-500" : pct < 100 ? "bg-amber-500" : "bg-red-500";
  return (
    <div className="mt-4">
      <div className="mb-1 flex items-baseline justify-between text-xs">
        <span className="font-medium text-slate-700">{formatMoney(spent, currency)} spent</span>
        <span className="text-slate-400">{pct}% of {formatMoney(budget, currency)}</span>
      </div>
      <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
        <div className={cn("h-full transition-all", color)} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

/* ───────────────────────── Inspector (contextual right panel) ───────────────────────── */

function Inspector({ project, selection }: { project: MockProject; selection: Selection }) {
  return (
    <aside className="flex min-h-0 flex-col border-l border-slate-200 bg-white">
      <div className="shrink-0 border-b border-slate-200 px-4 py-3">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Inspector</p>
        <p className="mt-0.5 text-sm font-medium text-slate-900">
          {selection.kind === "project" && "Project overview"}
          {selection.kind === "house" && "House"}
          {selection.kind === "room" && "Room"}
          {selection.kind === "object" && "Object"}
        </p>
      </div>
      <div className="flex-1 overflow-y-auto p-4">
        {selection.kind === "project" && <ProjectInspector project={project} />}
        {selection.kind === "house" && <HouseInspector project={project} houseId={selection.houseId} />}
        {selection.kind === "room" && <RoomInspector project={project} roomId={selection.roomId} />}
        {selection.kind === "object" && <ObjectInspector project={project} objectId={selection.objectId} />}
      </div>
    </aside>
  );
}

function ProjectInspector({ project }: { project: MockProject }) {
  const t = projectTotals(project);
  return (
    <div className="space-y-4">
      <div>
        <p className="text-xs uppercase tracking-wide text-slate-400">Client</p>
        <p className="text-sm font-medium text-slate-900">{project.client}</p>
      </div>
      <div>
        <p className="text-xs uppercase tracking-wide text-slate-400">Location</p>
        <p className="text-sm font-medium text-slate-900">{project.location}</p>
      </div>
      <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
        <p className="text-xs uppercase tracking-wide text-slate-400">Progress</p>
        <BudgetBar pct={t.pct} spent={t.spent} budget={t.budget} currency={project.currency} />
        <div className="mt-3 grid grid-cols-3 gap-2 text-center text-xs">
          <Stat label="Houses" value={t.houseCount} />
          <Stat label="Rooms" value={t.roomCount} />
          <Stat label="Objects" value={t.objectCount} />
        </div>
      </div>
      <div className="rounded-lg border border-slate-200 p-3">
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Quick actions</p>
        <div className="space-y-1.5">
          <Button variant="outline" size="sm" className="w-full justify-start"><Plus className="h-3.5 w-3.5" /> Add house</Button>
          <Button variant="outline" size="sm" className="w-full justify-start"><Share2 className="h-3.5 w-3.5" /> Share client view</Button>
        </div>
      </div>
    </div>
  );
}

function HouseInspector({ project, houseId }: { project: MockProject; houseId: string }) {
  const house = project.houses.find((h) => h.id === houseId);
  if (!house) return null;
  const t = houseTotals(house);
  return (
    <div className="space-y-4">
      <div>
        <p className="text-xs uppercase tracking-wide text-slate-400">House</p>
        <p className="text-sm font-semibold text-slate-900">{house.name}</p>
        <p className="text-xs text-slate-500">{house.sizeSqm} m²</p>
      </div>
      <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
        <BudgetBar pct={t.pct} spent={t.spent} budget={t.budget} currency={project.currency} />
        <div className="mt-3 grid grid-cols-2 gap-2 text-center text-xs">
          <Stat label="Rooms" value={house.rooms.length} />
          <Stat label="Objects" value={t.objectCount} />
        </div>
      </div>
    </div>
  );
}

function RoomInspector({ project, roomId }: { project: MockProject; roomId: string }) {
  const found = useMemo(() => {
    for (const h of project.houses) {
      const room = h.rooms.find((r) => r.id === roomId);
      if (room) return { house: h, room };
    }
    return null;
  }, [project, roomId]);
  if (!found) return null;
  const t = roomTotals(found.room);
  return (
    <div className="space-y-4">
      <div>
        <p className="text-xs uppercase tracking-wide text-slate-400">Room</p>
        <p className="text-sm font-semibold text-slate-900">{found.room.name}</p>
        <p className="text-xs text-slate-500">{found.house.name}</p>
      </div>
      <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
        <BudgetBar pct={t.pct} spent={t.spent} budget={t.budget} currency={project.currency} />
        <p className="mt-2 text-[11px] text-slate-500">{found.room.objects.length} objects · {found.room.objects.filter((o) => o.stage === "installed").length} installed</p>
      </div>
      <div className="rounded-lg border border-slate-200 p-3">
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Stage breakdown</p>
        <div className="space-y-1.5">
          {(Object.keys(WORKFLOW_STAGE_META) as Array<keyof typeof WORKFLOW_STAGE_META>).map((stage) => {
            const count = found.room.objects.filter((o) => o.stage === stage).length;
            const meta = WORKFLOW_STAGE_META[stage];
            return (
              <div key={stage} className="flex items-center justify-between text-xs">
                <span className="flex items-center gap-2">
                  <span className={cn("h-1.5 w-1.5 rounded-full", meta.dot)} />
                  {meta.label}
                </span>
                <span className="tabular-nums text-slate-500">{count}</span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function ObjectInspector({ project, objectId }: { project: MockProject; objectId: string }) {
  const found = useMemo(() => {
    for (const h of project.houses) {
      for (const r of h.rooms) {
        const obj = r.objects.find((o) => o.id === objectId);
        if (obj) return { house: h, room: r, object: obj };
      }
    }
    return null;
  }, [project, objectId]);
  if (!found) return null;
  const { object } = found;
  const meta = WORKFLOW_STAGE_META[object.stage];
  const pct = object.budget && object.spent ? Math.min(100, Math.round((object.spent / object.budget) * 100)) : 0;

  return (
    <div className="space-y-4">
      <div>
        <p className="text-xs uppercase tracking-wide text-slate-400">
          {found.house.name} › {found.room.name}
        </p>
        <p className="text-sm font-semibold text-slate-900">
          {object.name} {object.qty > 1 ? <span className="text-slate-400">×{object.qty}</span> : null}
        </p>
        <span className={cn("mt-1 inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-medium", meta.color)}>
          <span className={cn("h-1 w-1 rounded-full", meta.dot)} />
          {meta.label}
        </span>
      </div>

      {/* Smart search/link input (new merged pattern) */}
      <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Find a product</p>
        <div className="relative">
          <Search className="pointer-events-none absolute left-2.5 top-2.5 h-4 w-4 text-slate-400" />
          <Input placeholder="Search products or paste a link…" className="h-9 bg-white pl-8 text-sm" />
        </div>
        <p className="mt-1.5 text-[11px] text-slate-400">Paste a URL to auto-import from supplier.</p>
      </div>

      {/* Current selection */}
      {object.selectedProduct ? (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50/60 p-3">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-emerald-700">Selected</p>
          <p className="text-sm font-medium text-slate-900">{object.selectedProduct.name}</p>
          <p className="text-xs text-slate-500">{object.selectedProduct.supplier}</p>
          <p className="mt-2 text-sm font-semibold tabular-nums text-slate-900">
            {formatMoney(object.selectedProduct.price, project.currency)}
          </p>
          <a href="#" className="mt-1 inline-flex items-center gap-1 text-[11px] text-blue-600 hover:underline">
            <LinkIcon className="h-3 w-3" /> View source
          </a>
        </div>
      ) : (
        <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50 p-3 text-center">
          <p className="text-xs text-slate-500">No product selected yet.</p>
        </div>
      )}

      {/* Budget fit — compact */}
      <div className="rounded-lg border border-slate-200 bg-white p-3">
        <div className="flex items-baseline justify-between">
          <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Budget fit</span>
          <span className="text-xs text-slate-400">{pct}%</span>
        </div>
        <div className="mt-2 flex items-baseline gap-2">
          <span className="text-sm font-semibold text-slate-900">{formatMoney(object.spent, project.currency)}</span>
          <span className="text-xs text-slate-500">of {formatMoney(object.budget, project.currency)}</span>
        </div>
        {object.budget ? (
          <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
            <div className={cn("h-full", pct <= 100 ? "bg-emerald-500" : "bg-red-500")} style={{ width: `${Math.min(100, pct)}%` }} />
          </div>
        ) : null}
        <div className="mt-3 flex gap-1">
          <Badge variant="outline" title="Ranked by plan safety, fit, delta, lead time.">Top picks</Badge>
          <Badge variant="outline">Fit</Badge>
          <Badge variant="outline">Room</Badge>
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number | string }) {
  return (
    <div>
      <p className="text-base font-semibold text-slate-900">{value}</p>
      <p className="text-[11px] uppercase tracking-wide text-slate-400">{label}</p>
    </div>
  );
}

function ModePlaceholder({ title, description }: { title: string; description: string }) {
  return (
    <div className="flex h-full items-center justify-center p-10">
      <div className="max-w-sm rounded-xl border border-dashed border-slate-300 bg-white p-6 text-center shadow-sm">
        <p className="text-sm font-semibold text-slate-900">{title}</p>
        <p className="mt-2 text-xs text-slate-500">{description}</p>
        <p className="mt-4 text-[11px] uppercase tracking-wide text-slate-400">Mockup placeholder</p>
      </div>
    </div>
  );
}
