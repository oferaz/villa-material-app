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

export interface ProjectBudget {
  totalBudget: number;
  allocatedAmount: number;
  remainingAmount: number;
  categories: BudgetCategory[];
}
