import {
  BudgetCategory,
  BudgetCategoryName,
  HouseBudget,
  ProductOptionBudgetImpact,
  Project,
  ProjectBudget,
  RoomBudget,
} from "@/types";

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

function findObjectContext(project: Project, roomObjectId: string) {
  for (const house of project.houses) {
    for (const room of house.rooms) {
      const roomObject = room.objects.find((item) => item.id === roomObjectId);
      if (roomObject) {
        return { house, room, roomObject };
      }
    }
  }

  return null;
}

function replaceObjectSelection(project: Project, roomObjectId: string, optionId: string): Project {
  return {
    ...project,
    houses: project.houses.map((house) => ({
      ...house,
      rooms: house.rooms.map((room) => ({
        ...room,
        objects: room.objects.map((roomObject) =>
          roomObject.id === roomObjectId
            ? {
                ...roomObject,
                selectedProductId: optionId,
              }
            : roomObject
        ),
      })),
    })),
  };
}

function resolveBudgetFit(params: {
  isCurrentSelection: boolean;
  nextProjectRemaining: number;
  nextProjectTotal: number;
  nextHouseRemaining: number | null;
  nextHouseTotal: number | null;
  nextRoomRemaining: number | null;
  nextRoomTotal: number | null;
  nextCategoryRemaining: number;
  nextCategoryTotal: number;
  deltaAmount: number;
}): Pick<ProductOptionBudgetImpact, "fitLabel" | "fitTone"> {
  const {
    isCurrentSelection,
    nextProjectRemaining,
    nextProjectTotal,
    nextHouseRemaining,
    nextHouseTotal,
    nextRoomRemaining,
    nextRoomTotal,
    nextCategoryRemaining,
    nextCategoryTotal,
    deltaAmount,
  } = params;

  if (isCurrentSelection) {
    return {
      fitLabel: "Current selection",
      fitTone: "neutral",
    };
  }

  if (nextRoomRemaining !== null && nextRoomRemaining < 0) {
    return {
      fitLabel: "Over room budget",
      fitTone: "danger",
    };
  }

  if (nextHouseRemaining !== null && nextHouseRemaining < 0) {
    return {
      fitLabel: "Over house budget",
      fitTone: "danger",
    };
  }

  if (nextCategoryRemaining < 0) {
    return {
      fitLabel: "Over material budget",
      fitTone: "danger",
    };
  }

  if (nextProjectRemaining < 0) {
    return {
      fitLabel: "Over project budget",
      fitTone: "danger",
    };
  }

  const isNearRoomLimit =
    nextRoomRemaining !== null && nextRoomTotal !== null && nextRoomTotal > 0 && nextRoomRemaining <= nextRoomTotal * 0.1;
  if (isNearRoomLimit) {
    return {
      fitLabel: "Near room limit",
      fitTone: "warn",
    };
  }

  const isNearHouseLimit =
    nextHouseRemaining !== null && nextHouseTotal !== null && nextHouseTotal > 0 && nextHouseRemaining <= nextHouseTotal * 0.1;
  if (isNearHouseLimit) {
    return {
      fitLabel: "Near house limit",
      fitTone: "warn",
    };
  }

  if (nextCategoryTotal > 0 && nextCategoryRemaining <= nextCategoryTotal * 0.1) {
    return {
      fitLabel: "Near material limit",
      fitTone: "warn",
    };
  }

  if (nextProjectTotal > 0 && nextProjectRemaining <= nextProjectTotal * 0.1) {
    return {
      fitLabel: "Near project limit",
      fitTone: "warn",
    };
  }

  if (deltaAmount < 0) {
    return {
      fitLabel: "Budget-friendly",
      fitTone: "good",
    };
  }

  if (deltaAmount === 0) {
    return {
      fitLabel: "Budget-neutral",
      fitTone: "neutral",
    };
  }

  return {
    fitLabel: "Within budget",
    fitTone: "good",
  };
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

export function calculateProductOptionBudgetImpact(
  baseBudget: ProjectBudget,
  currentBudget: ProjectBudget,
  project: Project | undefined,
  roomObjectId: string,
  optionId: string
): ProductOptionBudgetImpact | null {
  if (!project) {
    return null;
  }

  const context = findObjectContext(project, roomObjectId);
  if (!context) {
    return null;
  }

  const { house, room, roomObject } = context;
  const candidateOption = roomObject.productOptions.find((option) => option.id === optionId);
  if (!candidateOption) {
    return null;
  }

  const currentSelectedOption = roomObject.selectedProductId
    ? roomObject.productOptions.find((option) => option.id === roomObject.selectedProductId)
    : undefined;
  const quantity = Math.max(1, Math.round(roomObject.quantity || 1));
  const currentSelectedTotal = clampMoney((currentSelectedOption?.price ?? 0) * quantity);
  const candidateTotal = clampMoney(candidateOption.price * quantity);
  const nextProject = replaceObjectSelection(project, roomObjectId, optionId);
  const nextBudget = calculateProjectBudget(baseBudget, nextProject);

  const currentHouseBudget = currentBudget.houses.find((item) => item.houseId === house.id);
  const nextHouseBudget = nextBudget.houses.find((item) => item.houseId === house.id);
  const currentRoomBudget = currentBudget.rooms.find((item) => item.roomId === room.id);
  const nextRoomBudget = nextBudget.rooms.find((item) => item.roomId === room.id);
  const currentCategoryBudget = currentBudget.categories.find((item) => item.name === candidateOption.budgetCategory);
  const nextCategoryBudget = nextBudget.categories.find((item) => item.name === candidateOption.budgetCategory);

  const deltaAmount = nextBudget.allocatedAmount - currentBudget.allocatedAmount;
  const fit = resolveBudgetFit({
    isCurrentSelection: roomObject.selectedProductId === optionId,
    nextProjectRemaining: nextBudget.remainingAmount,
    nextProjectTotal: nextBudget.totalBudget,
    nextHouseRemaining: nextHouseBudget?.remainingAmount ?? null,
    nextHouseTotal: nextHouseBudget?.totalBudget ?? null,
    nextRoomRemaining: nextRoomBudget?.remainingAmount ?? null,
    nextRoomTotal: nextRoomBudget?.totalBudget ?? null,
    nextCategoryRemaining: nextCategoryBudget?.remainingAmount ?? 0,
    nextCategoryTotal: nextCategoryBudget?.totalBudget ?? 0,
    deltaAmount,
  });

  return {
    optionId,
    candidateCategory: candidateOption.budgetCategory,
    candidateTotal,
    currentSelectedTotal,
    deltaAmount,
    fitLabel: fit.fitLabel,
    fitTone: fit.fitTone,
    currentProjectRemaining: currentBudget.remainingAmount,
    nextProjectRemaining: nextBudget.remainingAmount,
    currentHouseRemaining: currentHouseBudget?.remainingAmount ?? null,
    nextHouseRemaining: nextHouseBudget?.remainingAmount ?? null,
    currentRoomRemaining: currentRoomBudget?.remainingAmount ?? null,
    nextRoomRemaining: nextRoomBudget?.remainingAmount ?? null,
    currentCategoryRemaining: currentCategoryBudget?.remainingAmount ?? 0,
    nextCategoryRemaining: nextCategoryBudget?.remainingAmount ?? 0,
  };
}

export function buildCategoryBudgetMap(categories: BudgetCategory[]): Record<BudgetCategoryName, number> {
  return budgetCategoryOrder.reduce<Record<BudgetCategoryName, number>>((acc, categoryName) => {
    const category = categories.find((item) => item.name === categoryName);
    acc[categoryName] = clampMoney(category?.totalBudget ?? defaultCategoryBudgets[categoryName]);
    return acc;
  }, {} as Record<BudgetCategoryName, number>);
}
