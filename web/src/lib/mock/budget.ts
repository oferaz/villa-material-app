import { BudgetCategory, BudgetCategoryName, HouseBudget, Project, ProjectBudget, RoomBudget } from "@/types";

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
  const normalizedName = objectName.trim().toLowerCase().replace(/\s+\d+$/, "");
  const normalizedCategory = (objectCategory ?? "").trim().toLowerCase();
  return `${normalizedName}::${normalizedCategory}`;
}

function getHouseWeight(house: Project["houses"][number]): number {
  return Math.max(1, house.rooms.length);
}

function buildDefaultHouseBudgets(project: Project | undefined, totalBudget: number): HouseBudget[] {
  if (!project) {
    return [];
  }

  const houses = project.houses;
  if (houses.length === 0) {
    return [];
  }

  const normalizedTotal = clampMoney(totalBudget);
  const totalWeight = houses.reduce((sum, house) => sum + getHouseWeight(house), 0);
  let allocatedSoFar = 0;

  return houses.map((house, index) => {
    const isLastHouse = index === houses.length - 1;
    const proportionalBudget = isLastHouse
      ? normalizedTotal - allocatedSoFar
      : Math.round((normalizedTotal * getHouseWeight(house)) / Math.max(1, totalWeight));
    const nextBudget = clampMoney(proportionalBudget);
    allocatedSoFar += nextBudget;

    return {
      id: `house-${house.id}`,
      houseId: house.id,
      houseName: house.name,
      totalBudget: nextBudget,
      allocatedAmount: 0,
      remainingAmount: nextBudget,
    };
  });
}

function buildDefaultRoomBudgets(project: Project | undefined): RoomBudget[] {
  if (!project) {
    return [];
  }

  return project.houses.flatMap((house) =>
    house.rooms.map((room) => ({
      id: `room-${room.id}`,
      roomId: room.id,
      roomName: room.name,
      houseId: house.id,
      houseName: house.name,
      totalBudget: null,
      allocatedAmount: 0,
      remainingAmount: null,
    }))
  );
}

export function createMockProjectBudget(project?: Project): ProjectBudget {
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
    houses: buildDefaultHouseBudgets(project, defaultProjectBudgetTotal),
    rooms: buildDefaultRoomBudgets(project),
  };
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
  const houseAllocationMap = new Map<string, number>();
  const roomAllocationMap = new Map<string, number>();

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
          const estimatedCost = clampMoney(selectedOption.price * effectiveUnits * areaMultiplier);

          allocationMap[selectedOption.budgetCategory] += estimatedCost;
          houseAllocationMap.set(house.id, (houseAllocationMap.get(house.id) ?? 0) + estimatedCost);
          roomAllocationMap.set(room.id, (roomAllocationMap.get(room.id) ?? 0) + estimatedCost);
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

  const totalBudget = clampMoney(baseBudget.totalBudget);
  const defaultHouseBudgets = buildDefaultHouseBudgets(project, totalBudget);
  const houses = project
    ? project.houses.map((house) => {
        const sourceHouse = baseBudget.houses.find((item) => item.houseId === house.id);
        const defaultHouse = defaultHouseBudgets.find((item) => item.houseId === house.id);
        const plannedBudget = clampMoney(sourceHouse?.totalBudget ?? defaultHouse?.totalBudget ?? 0);
        const allocatedAmount = clampMoney(houseAllocationMap.get(house.id) ?? 0);
        return {
          id: sourceHouse?.id ?? defaultHouse?.id ?? `house-${house.id}`,
          houseId: house.id,
          houseName: house.name,
          totalBudget: plannedBudget,
          allocatedAmount,
          remainingAmount: plannedBudget - allocatedAmount,
        };
      })
    : baseBudget.houses.map((house) => ({
        ...house,
        totalBudget: clampMoney(house.totalBudget),
        allocatedAmount: 0,
        remainingAmount: clampMoney(house.totalBudget),
      }));

  const rooms = project
    ? project.houses.flatMap((house) =>
        house.rooms.map((room) => {
          const sourceRoom = baseBudget.rooms.find((item) => item.roomId === room.id);
          const totalBudget = sourceRoom ? (sourceRoom.totalBudget === null ? null : clampMoney(sourceRoom.totalBudget)) : null;
          const allocatedAmount = clampMoney(roomAllocationMap.get(room.id) ?? 0);
          return {
            id: sourceRoom?.id ?? `room-${room.id}`,
            roomId: room.id,
            roomName: room.name,
            houseId: house.id,
            houseName: house.name,
            totalBudget,
            allocatedAmount,
            remainingAmount: totalBudget === null ? null : totalBudget - allocatedAmount,
          };
        })
      )
    : baseBudget.rooms.map((room) => ({
        ...room,
        totalBudget: room.totalBudget === null ? null : clampMoney(room.totalBudget),
        allocatedAmount: 0,
        remainingAmount: room.totalBudget === null ? null : clampMoney(room.totalBudget),
      }));

  const allocatedAmount = categories.reduce((acc, item) => acc + item.allocatedAmount, 0);

  return {
    totalBudget,
    allocatedAmount,
    remainingAmount: totalBudget - allocatedAmount,
    categories,
    houses,
    rooms,
  };
}

export function buildCategoryBudgetMap(categories: BudgetCategory[]): Record<BudgetCategoryName, number> {
  return budgetCategoryOrder.reduce<Record<BudgetCategoryName, number>>((acc, categoryName) => {
    const category = categories.find((item) => item.name === categoryName);
    acc[categoryName] = clampMoney(category?.totalBudget ?? defaultCategoryBudgets[categoryName]);
    return acc;
  }, {} as Record<BudgetCategoryName, number>);
}

