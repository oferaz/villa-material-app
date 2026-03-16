import { House, Project, Room, RoomObject, getObjectWorkflowStage, getWorkflowStageStep } from "@/types";

export interface WorkflowSummary {
  totalItems: number;
  stages: {
    materialMissing: number;
    materialAssigned: number;
    poApproved: number;
    ordered: number;
    installed: number;
  };
  actionsCompleted: number;
  actionsTotal: number;
  actionsRemaining: number;
  completionPercent: number;
}

function countItemQuantity(objectItem: RoomObject): number {
  return Math.max(1, objectItem.quantity);
}

export function summarizeWorkflowForObjects(objects: RoomObject[]): WorkflowSummary {
  let totalItems = 0;
  let materialMissing = 0;
  let materialAssigned = 0;
  let poApproved = 0;
  let ordered = 0;
  let installed = 0;
  let actionsCompleted = 0;

  for (const objectItem of objects) {
    const quantity = countItemQuantity(objectItem);
    totalItems += quantity;

    const stage = getObjectWorkflowStage(objectItem);
    if (stage === "material_missing") {
      materialMissing += quantity;
    } else if (stage === "material_assigned") {
      materialAssigned += quantity;
    } else if (stage === "po_approved") {
      poApproved += quantity;
    } else if (stage === "ordered") {
      ordered += quantity;
    } else if (stage === "installed") {
      installed += quantity;
    }

    actionsCompleted += getWorkflowStageStep(stage) * quantity;
  }

  const actionsTotal = totalItems * 4;
  const actionsRemaining = Math.max(0, actionsTotal - actionsCompleted);
  const completionPercent = actionsTotal > 0 ? Math.round((actionsCompleted / actionsTotal) * 100) : 0;

  return {
    totalItems,
    stages: {
      materialMissing,
      materialAssigned,
      poApproved,
      ordered,
      installed,
    },
    actionsCompleted,
    actionsTotal,
    actionsRemaining,
    completionPercent,
  };
}

export function summarizeWorkflowForRoom(room: Room): WorkflowSummary {
  return summarizeWorkflowForObjects(room.objects);
}

export function summarizeWorkflowForHouse(house: House): WorkflowSummary {
  const allObjects = house.rooms.flatMap((room) => room.objects);
  return summarizeWorkflowForObjects(allObjects);
}

export function summarizeWorkflowForProject(project: Project): WorkflowSummary {
  const allObjects = project.houses.flatMap((house) => house.rooms.flatMap((room) => room.objects));
  return summarizeWorkflowForObjects(allObjects);
}

