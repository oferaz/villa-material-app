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

export interface ProductOptionBudgetImpact {
  optionId: string;
  candidateCategory: BudgetCategoryName;
  candidateTotal: number;
  currentSelectedTotal: number;
  deltaAmount: number;
  fitLabel: string;
  fitTone: BudgetFitTone;
  objectAllowance: number | null;
  allowanceDelta: number | null;
  allowanceLabel: string | null;
  allowanceTone: BudgetFitTone | null;
  currentProjectRemaining: number;
  nextProjectRemaining: number;
  currentHouseRemaining: number | null;
  nextHouseRemaining: number | null;
  currentRoomRemaining: number | null;
  nextRoomRemaining: number | null;
  currentCategoryRemaining: number;
  nextCategoryRemaining: number;
}

export interface ProductSelectionBudgetSummary {
  quantity: number;
  objectAllowance: number | null;
  currentSelectedTotal: number;
  currentAllowanceDelta: number | null;
  currentProjectRemaining: number;
  currentHouseRemaining: number | null;
  currentRoomRemaining: number | null;
  currentCategoryName: BudgetCategoryName | null;
  currentCategoryRemaining: number | null;
}
