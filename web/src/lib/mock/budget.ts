import { BudgetCategory, BudgetCategoryName, Project, ProjectBudget } from "@/types";

export const budgetCategoryOrder: BudgetCategoryName[] = [
  "Furniture",
  "Lighting",
  "Tiles",
  "Bathroom",
  "Kitchen",
  "Decor",
];

export const defaultCategoryBudgets: Record<BudgetCategoryName, number> = {
  Furniture: 80000,
  Lighting: 20000,
  Tiles: 50000,
  Bathroom: 25000,
  Kitchen: 20000,
  Decor: 5000,
};

export const defaultProjectBudgetTotal = 200000;

export function createMockProjectBudget(): ProjectBudget {
  const categories: BudgetCategory[] = budgetCategoryOrder.map((name) => ({
    id: name.toLowerCase(),
    name,
    totalBudget: defaultCategoryBudgets[name],
    allocatedAmount: 0,
    remainingAmount: defaultCategoryBudgets[name],
  }));

  return {
    totalBudget: defaultProjectBudgetTotal,
    allocatedAmount: 0,
    remainingAmount: defaultProjectBudgetTotal,
    categories,
  };
}

function clampMoney(value: number): number {
  if (!Number.isFinite(value)) {
    return 0;
  }
  return Math.max(0, Math.round(value));
}

export function resolveBudgetCategory(objectName: string, objectCategory?: string): BudgetCategoryName {
  const text = `${objectName} ${objectCategory ?? ""}`.toLowerCase();

  if (/(light|lamp|sconce|pendant|lantern)/.test(text)) {
    return "Lighting";
  }
  if (/(tile|ceramic|porcelain|mosaic|marble|travertine|stone)/.test(text)) {
    return "Tiles";
  }
  if (/(vanity|toilet|shower|faucet|sink|mirror|bath)/.test(text)) {
    return "Bathroom";
  }
  if (/(cabinet|counter|appliance|stool|backsplash|kitchen)/.test(text)) {
    return "Kitchen";
  }
  if (/(rug|curtain|art|accessor|decor|planter|runner)/.test(text)) {
    return "Decor";
  }
  return "Furniture";
}

export function calculateProjectBudget(baseBudget: ProjectBudget, project?: Project): ProjectBudget {
  const allocationMap = budgetCategoryOrder.reduce<Record<BudgetCategoryName, number>>((acc, category) => {
    acc[category] = 0;
    return acc;
  }, {} as Record<BudgetCategoryName, number>);

  if (project) {
    for (const house of project.houses) {
      for (const room of house.rooms) {
        for (const objectItem of room.objects) {
          if (!objectItem.selectedProductId) {
            continue;
          }
          const selectedOption = objectItem.productOptions.find((option) => option.id === objectItem.selectedProductId);
          if (!selectedOption) {
            continue;
          }
          allocationMap[selectedOption.budgetCategory] += clampMoney(selectedOption.price);
        }
      }
    }
  }

  const categories = budgetCategoryOrder.map((categoryName) => {
    const sourceCategory = baseBudget.categories.find((item) => item.name === categoryName);
    const totalBudget = clampMoney(sourceCategory?.totalBudget ?? defaultCategoryBudgets[categoryName]);
    const allocatedAmount = clampMoney(allocationMap[categoryName]);
    return {
      id: sourceCategory?.id ?? categoryName.toLowerCase(),
      name: categoryName,
      totalBudget,
      allocatedAmount,
      remainingAmount: totalBudget - allocatedAmount,
    };
  });

  const allocatedAmount = categories.reduce((acc, item) => acc + item.allocatedAmount, 0);
  const totalBudget = clampMoney(baseBudget.totalBudget);

  return {
    totalBudget,
    allocatedAmount,
    remainingAmount: totalBudget - allocatedAmount,
    categories,
  };
}

export function buildCategoryBudgetMap(categories: BudgetCategory[]): Record<BudgetCategoryName, number> {
  return budgetCategoryOrder.reduce<Record<BudgetCategoryName, number>>((acc, categoryName) => {
    const category = categories.find((item) => item.name === categoryName);
    acc[categoryName] = clampMoney(category?.totalBudget ?? defaultCategoryBudgets[categoryName]);
    return acc;
  }, {} as Record<BudgetCategoryName, number>);
}
