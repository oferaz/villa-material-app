"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { isSupabaseConfigured, supabase } from "@/lib/supabase/client";
import { loadProjectsForWorkspace } from "@/lib/supabase/projects-repository";
import { getObjectWorkflowStage } from "@/types";
import type { Project, RoomObject } from "@/types";
import { CanvasWorkspace } from "./canvas-workspace";
import type { MockHouse, MockObject, MockProject, MockRoom, WorkflowStage } from "./mockup-data";

// ── Adapter ────────────────────────────────────────────────────────────────

function adaptWorkflowStage(obj: RoomObject): WorkflowStage {
  const stage = getObjectWorkflowStage(obj);
  switch (stage) {
    case "material_missing":
      return "planned";
    case "material_assigned":
      return "sourcing";
    case "po_approved":
      return "selected";
    case "ordered":
      return "ordered";
    case "installed":
      return "installed";
    default:
      return "planned";
  }
}

function adaptObject(obj: RoomObject): MockObject {
  const selectedProduct = obj.productOptions[0];
  return {
    id: obj.id,
    name: obj.name,
    qty: obj.quantity,
    budget: obj.budgetAllowance ?? null,
    spent: selectedProduct ? selectedProduct.price : null,
    stage: adaptWorkflowStage(obj),
    selectedProduct: selectedProduct
      ? {
          name: selectedProduct.name,
          supplier: selectedProduct.supplier,
          price: selectedProduct.price,
        }
      : undefined,
  };
}

function adaptRoom(room: { id: string; name: string; objects: RoomObject[] }): MockRoom {
  const objects = room.objects.map(adaptObject);
  const plannedBudget = objects.reduce((sum, o) => sum + (o.budget ?? 0), 0);
  return {
    id: room.id,
    name: room.name,
    objects,
    plannedBudget,
  };
}

function adaptHouse(house: { id: string; name: string; sizeSqm?: number; rooms: Array<{ id: string; name: string; objects: RoomObject[] }> }): MockHouse {
  return {
    id: house.id,
    name: house.name,
    sizeSqm: house.sizeSqm ?? 0,
    rooms: house.rooms.map(adaptRoom),
  };
}

export function adaptProjectToMock(project: Project): MockProject {
  const houses = project.houses.map(adaptHouse);
  const totalBudget = houses.reduce(
    (sum, h) => sum + h.rooms.reduce((rSum, r) => rSum + r.plannedBudget, 0),
    0
  );
  return {
    id: project.id,
    name: project.name,
    client: project.customer,
    location: project.location,
    currency: project.currency,
    totalBudget,
    houses,
  };
}

// ── Component ──────────────────────────────────────────────────────────────

interface RealCanvasWorkspaceProps {
  projectId: string;
}

type LoadState =
  | { kind: "loading" }
  | { kind: "unauthenticated" }
  | { kind: "not_found" }
  | { kind: "ready"; mockProject: MockProject };

export function RealCanvasWorkspace({ projectId }: RealCanvasWorkspaceProps) {
  const router = useRouter();
  const [state, setState] = useState<LoadState>({ kind: "loading" });

  useEffect(() => {
    let cancelled = false;

    async function load() {
      if (isSupabaseConfigured) {
        const {
          data: { session },
        } = await supabase.auth.getSession();

        if (cancelled) return;

        if (!session) {
          router.replace("/login");
          return;
        }
      }

      const projects = await loadProjectsForWorkspace();
      if (cancelled) return;

      const project = projects.find((p) => p.id === projectId);
      if (!project) {
        setState({ kind: "not_found" });
        return;
      }

      setState({ kind: "ready", mockProject: adaptProjectToMock(project) });
    }

    void load();
    return () => {
      cancelled = true;
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

  if (state.kind === "unauthenticated") {
    return null;
  }

  if (state.kind === "not_found") {
    return (
      <div className="flex h-screen items-center justify-center bg-slate-50">
        <p className="text-sm text-slate-500">Project not found.</p>
      </div>
    );
  }

  return <CanvasWorkspace project={state.mockProject} />;
}
