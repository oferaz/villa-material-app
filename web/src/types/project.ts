import { BudgetCategoryName } from "./budget";

export type UUID = string;

export type RoomType =
  | "living_room"
  | "kitchen"
  | "bathroom"
  | "bedroom"
  | "dining_room"
  | "entry"
  | "office"
  | "laundry"
  | "outdoor";

export interface ProductOption {
  id: UUID;
  name: string;
  supplier: string;
  price: number;
  leadTimeDays: number;
  budgetCategory: BudgetCategoryName;
  sku?: string;
  imageUrl?: string;
  sourceType?: "catalog" | "link";
  sourceUrl?: string;
}

export type ObjectStatus = "selected" | "missing";

export interface RoomObject {
  id: UUID;
  roomId: UUID;
  name: string;
  category: string;
  quantity: number;
  selectedProductId?: UUID;
  poApproved?: boolean;
  ordered?: boolean;
  installed?: boolean;
  productOptions: ProductOption[];
}

export interface Room {
  id: UUID;
  houseId: UUID;
  name: string;
  sizeSqm?: number;
  type: RoomType;
  objects: RoomObject[];
}

export interface House {
  id: UUID;
  projectId: UUID;
  name: string;
  sizeSqm?: number;
  rooms: Room[];
}

export interface Project {
  id: UUID;
  name: string;
  customer: string;
  location: string;
  houses: House[];
}

export function getObjectStatus(roomObject: RoomObject): ObjectStatus {
  return roomObject.selectedProductId ? "selected" : "missing";
}

export type WorkflowStage =
  | "material_missing"
  | "material_assigned"
  | "po_approved"
  | "ordered"
  | "installed";

export function getObjectWorkflowStage(roomObject: RoomObject): WorkflowStage {
  if (!roomObject.selectedProductId) {
    return "material_missing";
  }
  if (roomObject.installed) {
    return "installed";
  }
  if (roomObject.ordered) {
    return "ordered";
  }
  if (roomObject.poApproved) {
    return "po_approved";
  }
  return "material_assigned";
}

export function getWorkflowStageLabel(stage: WorkflowStage): string {
  switch (stage) {
    case "material_missing":
      return "Material missing";
    case "material_assigned":
      return "Material assigned";
    case "po_approved":
      return "PO approved";
    case "ordered":
      return "Ordered";
    case "installed":
      return "Installed";
    default:
      return "Unknown";
  }
}

export function getWorkflowStageStep(stage: WorkflowStage): number {
  switch (stage) {
    case "material_missing":
      return 0;
    case "material_assigned":
      return 1;
    case "po_approved":
      return 2;
    case "ordered":
      return 3;
    case "installed":
      return 4;
    default:
      return 0;
  }
}

