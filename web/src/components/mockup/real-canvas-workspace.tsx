"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { isSupabaseConfigured, supabase } from "@/lib/supabase/client";
import {
  loadProjectBudgetsByProjectIds,
  loadProjectsForWorkspace,
} from "@/lib/supabase/projects-repository";
import { listMaterialsForCurrentUser, UserMaterial } from "@/lib/supabase/materials-repository";
import { calculateProjectBudget, createMockProjectBudget } from "@/lib/mock/budget";
import { getObjectWorkflowStage } from "@/types";
import type { Project, ProjectBudget, RoomObject } from "@/types";
import { CanvasWorkspace } from "./canvas-workspace";
import type { MockHouse, MockObject, MockProject, MockRoom, WorkflowStage } from "./mockup-data";

// ── Adapter: real Project → MockProject ───────────────────────────────────

function adaptWorkflowStage(obj: RoomObject): WorkflowStage {
  const stage = getObjectWorkflowStage(obj);
  switch (stage) {
    case "material_missing":  return "planned";
    case "material_assigned": return "sourcing";
    case "po_approved":       return "selected";
    case "ordered":           return "ordered";
    case "installed":         return "installed";
    default:                  return "planned";
  }
}

function adaptObject(obj: RoomObject): MockObject {
  const selectedProduct = obj.productOptions.find((o) => o.id === obj.selectedProductId) ?? obj.productOptions[0];
  return {
    id: obj.id,
    name: obj.name,
    qty: obj.quantity,
    budget: obj.budgetAllowance ?? null,
    spent: selectedProduct?.price ?? null,
    stage: adaptWorkflowStage(obj),
    selectedProduct: selectedProduct
      ? { name: selectedProduct.name, supplier: selectedProduct.supplier, price: selectedProduct.price }
      : undefined,
  };
}

function adaptRoom(room: Project["houses"][number]["rooms"][number]): MockRoom {
  const objects = room.objects.map(adaptObject);
  return {
    id: room.id,
    name: room.name,
    objects,
    plannedBudget: objects.reduce((sum, o) => sum + (o.budget ?? 0), 0),
  };
}

function adaptHouse(house: Project["houses"][number]): MockHouse {
  return {
    id: house.id,
    name: house.name,
    sizeSqm: house.sizeSqm ?? 0,
    rooms: house.rooms.map(adaptRoom),
  };
}

export function adaptProjectToMock(project: Project): MockProject {
  const houses = project.houses.map(adaptHouse);
  return {
    id: project.id,
    name: project.name,
    client: project.customer,
    location: project.location,
    currency: project.currency,
    totalBudget: houses.reduce(
      (sum, h) => sum + h.rooms.reduce((rs, r) => rs + r.plannedBudget, 0),
      0
    ),
    houses,
  };
}

// ── Component ──────────────────────────────────────────────────────────────

interface RealCanvasWorkspaceProps {
  projectId: string;
}

type LoadState =
  | { kind: "loading" }
  | { kind: "not_found" }
  | {
      kind: "ready";
      mockProject: MockProject;
      realProject: Project;
      budget: ProjectBudget;
      materials: UserMaterial[];
    };

export function RealCanvasWorkspace({ projectId }: RealCanvasWorkspaceProps) {
  const router = useRouter();
  const [state, setState] = useState<LoadState>({ kind: "loading" });

  useEffect(() => {
    let cancelled = false;

    async function load() {
      if (isSupabaseConfigured) {
        const { data: { session } } = await supabase.auth.getSession();
        if (cancelled) return;
        if (!session) { router.replace("/login"); return; }
      }

      const [projects, materials] = await Promise.all([
        loadProjectsForWorkspace(),
        listMaterialsForCurrentUser(),
      ]);
      if (cancelled) return;

      const project = projects.find((p) => p.id === projectId);
      if (!project) { setState({ kind: "not_found" }); return; }

      // Load budget (same pattern as ProjectWorkspace)
      let budget: ProjectBudget;
      if (isSupabaseConfigured) {
        const persistedBudgets = await loadProjectBudgetsByProjectIds([project]);
        if (cancelled) return;
        const base = persistedBudgets[project.id] ?? createMockProjectBudget(project);
        budget = calculateProjectBudget(base, project);
      } else {
        budget = calculateProjectBudget(createMockProjectBudget(project), project);
      }

      setState({
        kind: "ready",
        mockProject: adaptProjectToMock(project),
        realProject: project,
        budget,
        materials,
      });
    }

    void load();

    // Re-load on auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_IN" || event === "SIGNED_OUT") void load();
    });

    return () => {
      cancelled = true;
      subscription.unsubscribe();
    };
  }, [projectId, router]);

  if (state.kind === "loading") {
    return (
      <div className="flex h-screen items-center justify-center bg-slate-50">
        <div className="flex flex-col items-center gap-3 text-slate-500">
          <Loader2 className="h-8 w-8 animate-spin" />
          <p className="text-sm">Loading project…</p>
        </div>
      </div>
    );
  }

  if (state.kind === "not_found") {
    return (
      <div className="flex h-screen items-center justify-center bg-slate-50">
        <p className="text-sm text-slate-500">Project not found.</p>
      </div>
    );
  }

  return (
    <CanvasWorkspace
      project={state.mockProject}
      realProject={state.realProject}
      budget={state.budget}
      materials={state.materials}
    />
  );
}
