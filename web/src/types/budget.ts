export type BudgetCategoryName =
  | "Furniture"
  | "Lighting"
  | "Tiles"
  | "Bathroom"
  | "Kitchen"
  | "Decor";

export interface BudgetCategory {
  id: string;
  name: BudgetCategoryName;
  totalBudget: number;
  allocatedAmount: number;
  remainingAmount: number;
}

export interface HouseBudget {
  id: string;
  houseId: string;
  houseName: string;
  totalBudget: number;
  allocatedAmount: number;
  remainingAmount: number;
}

export interface RoomBudget {
  id: string;
  roomId: string;
  roomName: string;
  houseId: string;
  houseName: string;
  totalBudget: number | null;
  allocatedAmount: number;
  remainingAmount: number | null;
}

export interface ProjectBudget {
  totalBudget: number;
  allocatedAmount: number;
  remainingAmount: number;
  categories: BudgetCategory[];
  houses: HouseBudget[];
  rooms: RoomBudget[];
}

export type BudgetFitTone = "good" | "warn" | "danger" | "neutral";

export type BudgetHealthStatus = "healthy" | "at_risk" | "over_budget" | "not_planned";

export type ObjectBudgetFitStatus =
  | "no_object_budget"
  | "under_object_budget"
  | "on_object_budget"
  | "over_object_budget";

export interface ProductOptionBudgetImpact {
  optionId: string;
  candidateCategory: BudgetCategoryName;
  candidateTotal: number;
  candidateLeadTimeDays: number;
  priceMissing: boolean;
  isCurrentSelection: boolean;
  currentSelectedTotal: number;
  deltaAmount: number;
  fitLabel: string;
  fitTone: BudgetFitTone;
  objectBudget: number | null;
  objectBudgetDelta: number | null;
  objectBudgetLabel: string | null;
  objectBudgetTone: BudgetFitTone | null;
  objectBudgetStatus: ObjectBudgetFitStatus;
  currentProjectRemaining: number;
  nextProjectRemaining: number;
  currentHouseRemaining: number | null;
  nextHouseRemaining: number | null;
  currentRoomRemaining: number | null;
  nextRoomRemaining: number | null;
  currentCategoryRemaining: number;
  nextCategoryRemaining: number;
  keepsProjectOnPlan: boolean;
  keepsHouseOnPlan: boolean;
  keepsRoomOnPlan: boolean;
  keepsCategoryOnPlan: boolean;
  recommendationScore: number;
  primaryReasonLabel: string;
  secondaryReasonLabel: string | null;
}

export interface ProductSelectionBudgetSummary {
  quantity: number;
  objectBudget: number | null;
  currentSelectedTotal: number;
  currentObjectBudgetDelta: number | null;
  objectBudgetStatus: ObjectBudgetFitStatus;
  currentProjectRemaining: number;
  currentHouseRemaining: number | null;
  currentRoomRemaining: number | null;
  currentCategoryName: BudgetCategoryName | null;
  currentCategoryRemaining: number | null;
  currentProjectHealth: BudgetHealthStatus;
  currentHouseHealth: BudgetHealthStatus;
  currentRoomHealth: BudgetHealthStatus;
  currentCategoryHealth: BudgetHealthStatus;
}

