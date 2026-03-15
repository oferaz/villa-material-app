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

function normalizePositiveNumber(value: number | undefined): number | undefined {
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) {
    return undefined;
  }
  return value;
}

function resolveRoomAreaSqm(roomSizeSqm: number | undefined, houseSizeSqm: number | undefined, roomCount: number): number | undefined {
  const normalizedRoomSize = normalizePositiveNumber(roomSizeSqm);
  if (normalizedRoomSize) {
    return normalizedRoomSize;
  }

  const normalizedHouseSize = normalizePositiveNumber(houseSizeSqm);
  if (!normalizedHouseSize) {
    return undefined;
  }

  return normalizedHouseSize / Math.max(1, roomCount);
}

function isSizeSensitiveCategory(category: BudgetCategoryName): boolean {
  return category === "Tiles" || category === "Bathroom" || category === "Kitchen";
}

function getObjectGroupKey(objectName: string, objectCategory?: string): string {
  // Treat "Chair 1", "Chair 2", etc. as the same group for quantity rollup.
  const normalizedName = objectName.trim().toLowerCase().replace(/\s+\d+$/, "");
  const normalizedCategory = (objectCategory ?? "").trim().toLowerCase();
  return `${normalizedName}::${normalizedCategory}`;
}

export function resolveBudgetCategory(objectName: string, objectCategory?: string): BudgetCategoryName {
  const text = `${objectName} ${objectCategory ?? ""}`.toLowerCase();

  if (/\b(light|lighting|lamp|sconce|pendant|lantern|chandelier)\b/.test(text)) {
    return "Lighting";
  }
  if (/\b(tile|tiles|ceramic|porcelain|mosaic|marble|travertine|stone)\b/.test(text)) {
    return "Tiles";
  }
  if (/\b(vanity|toilet|shower|faucet|sink|mirror|bath|bathroom)\b/.test(text)) {
    return "Bathroom";
  }
  if (/\b(cabinet|counter|appliance|stool|backsplash|kitchen)\b/.test(text)) {
    return "Kitchen";
  }
  if (/\b(rug|curtain|curtains|art|accessory|accessories|decor|planter|runner|textile|textiles)\b/.test(text)) {
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
        const roomAreaSqm = resolveRoomAreaSqm(room.sizeSqm, house.sizeSqm, house.rooms.length);

        const groupStats = room.objects.reduce<Record<string, { totalUnits: number; selectedUnits: number }>>(
          (acc, objectItem) => {
            const groupKey = getObjectGroupKey(objectItem.name, objectItem.category);
            const normalizedUnits = Math.max(1, Math.round(objectItem.quantity || 1));
            const current = acc[groupKey] ?? { totalUnits: 0, selectedUnits: 0 };
            current.totalUnits += normalizedUnits;
            if (objectItem.selectedProductId) {
              current.selectedUnits += normalizedUnits;
            }
            acc[groupKey] = current;
            return acc;
          },
          {}
        );

        for (const objectItem of room.objects) {
          if (!objectItem.selectedProductId) {
            continue;
          }
          const selectedOption = objectItem.productOptions.find((option) => option.id === objectItem.selectedProductId);
          if (!selectedOption) {
            continue;
          }

          const normalizedQuantity = Math.max(1, Math.round(objectItem.quantity || 1));
          const groupKey = getObjectGroupKey(objectItem.name, objectItem.category);
          const group = groupStats[groupKey];
          const shouldFanOutToGroup =
            Boolean(group) && group.selectedUnits === normalizedQuantity && group.totalUnits > normalizedQuantity;
          const effectiveUnits = shouldFanOutToGroup ? group.totalUnits : normalizedQuantity;
          const areaMultiplier =
            isSizeSensitiveCategory(selectedOption.budgetCategory) && roomAreaSqm ? roomAreaSqm : 1;
          const estimatedCost = selectedOption.price * effectiveUnits * areaMultiplier;
          allocationMap[selectedOption.budgetCategory] += clampMoney(estimatedCost);
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
