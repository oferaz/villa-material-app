import {
  BudgetCategory,
  BudgetCategoryName,
  BudgetFitTone,
  BudgetHealthStatus,
  HouseBudget,
  ObjectBudgetFitStatus,
  ProductOptionBudgetImpact,
  Project,
  ProjectBudget,
  Room,
  RoomBudget,
  RoomObject,
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

function normalizeAllowance(value: number | null | undefined): number | null {
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) {
    return null;
  }
  return clampMoney(value);
}

export function getBudgetHealthStatus(
  totalBudget: number | null | undefined,
  remainingAmount: number | null | undefined
): BudgetHealthStatus {
  if (totalBudget === null || totalBudget === undefined || remainingAmount === null || remainingAmount === undefined) {
    return "not_planned";
  }
  if (remainingAmount < 0) {
    return "over_budget";
  }
  if (totalBudget <= 0) {
    return "at_risk";
  }
  return remainingAmount <= totalBudget * 0.1 ? "at_risk" : "healthy";
}

export function getBudgetHealthLabel(status: BudgetHealthStatus): string {
  switch (status) {
    case "healthy":
      return "Healthy";
    case "at_risk":
      return "At risk";
    case "over_budget":
      return "Over budget";
    case "not_planned":
      return "Not planned";
    default:
      return "Unknown";
  }
}

export function getBudgetHealthVariant(status: BudgetHealthStatus): "success" | "secondary" | "danger" | "outline" {
  switch (status) {
    case "healthy":
      return "success";
    case "at_risk":
      return "secondary";
    case "over_budget":
      return "danger";
    case "not_planned":
      return "outline";
    default:
      return "outline";
  }
}

export function getObjectBudgetFitStatus(
  candidateTotal: number,
  objectBudget: number | null | undefined
): ObjectBudgetFitStatus {
  if (objectBudget === null || objectBudget === undefined) {
    return "no_object_budget";
  }
  const delta = clampMoney(candidateTotal) - objectBudget;
  if (delta < 0) {
    return "under_object_budget";
  }
  if (delta > 0) {
    return "over_object_budget";
  }
  return "on_object_budget";
}

export function getObjectBudgetFitLabel(status: ObjectBudgetFitStatus): string {
  switch (status) {
    case "no_object_budget":
      return "No object budget";
    case "under_object_budget":
      return "Under object budget";
    case "on_object_budget":
      return "On object budget";
    case "over_object_budget":
      return "Over object budget";
    default:
      return "Unknown";
  }
}

export function getObjectBudgetFitVariant(
  status: ObjectBudgetFitStatus
): "success" | "secondary" | "danger" | "outline" {
  switch (status) {
    case "under_object_budget":
      return "success";
    case "on_object_budget":
      return "outline";
    case "over_object_budget":
      return "danger";
    case "no_object_budget":
      return "outline";
    default:
      return "outline";
  }
}

function isPlanKept(totalBudget: number | null | undefined, remainingAmount: number | null | undefined): boolean {
  if (totalBudget === null || totalBudget === undefined || remainingAmount === null || remainingAmount === undefined) {
    return true;
  }
  return remainingAmount >= 0;
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

function resolveObjectBudgetInfo(candidateTotal: number, objectBudget: number | null): {
  objectBudgetDelta: number | null;
  objectBudgetLabel: string | null;
  objectBudgetTone: BudgetFitTone | null;
  objectBudgetStatus: ObjectBudgetFitStatus;
} {
  const objectBudgetStatus = getObjectBudgetFitStatus(candidateTotal, objectBudget);
  switch (objectBudgetStatus) {
    case "no_object_budget":
      return {
        objectBudgetDelta: null,
        objectBudgetLabel: null,
        objectBudgetTone: null,
        objectBudgetStatus,
      };
    case "under_object_budget":
      return {
        objectBudgetDelta: clampMoney(candidateTotal) - (objectBudget ?? 0),
        objectBudgetLabel: getObjectBudgetFitLabel(objectBudgetStatus),
        objectBudgetTone: "good",
        objectBudgetStatus,
      };
    case "over_object_budget":
      return {
        objectBudgetDelta: clampMoney(candidateTotal) - (objectBudget ?? 0),
        objectBudgetLabel: getObjectBudgetFitLabel(objectBudgetStatus),
        objectBudgetTone: "danger",
        objectBudgetStatus,
      };
    case "on_object_budget":
    default:
      return {
        objectBudgetDelta: clampMoney(candidateTotal) - (objectBudget ?? 0),
        objectBudgetLabel: getObjectBudgetFitLabel(objectBudgetStatus),
        objectBudgetTone: "neutral",
        objectBudgetStatus,
      };
  }
}

export function calculateRoomObjectBudgetContributionMap(params: {
  room: Room;
  houseSizeSqm?: number;
  houseRoomCount?: number;
}): Map<string, number> {
  const { room, houseSizeSqm, houseRoomCount = 1 } = params;
  const roomAreaSqm = resolveRoomAreaSqm(room.sizeSqm, houseSizeSqm, houseRoomCount);

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

  const contributionMap = new Map<string, number>();
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
    const areaMultiplier = isSizeSensitiveCategory(selectedOption.budgetCategory) && roomAreaSqm ? roomAreaSqm : 1;

    contributionMap.set(objectItem.id, clampMoney(selectedOption.price * effectiveUnits * areaMultiplier));
  }

  return contributionMap;
}

function getSelectedProduct(roomObject: RoomObject) {
  if (!roomObject.selectedProductId) {
    return undefined;
  }
  return roomObject.productOptions.find((option) => option.id === roomObject.selectedProductId);
}

export function getRoomObjectSelectedLineCost(roomObject: RoomObject): number {
  const selectedProduct = getSelectedProduct(roomObject);
  const quantity = Math.max(1, Math.round(roomObject.quantity || 1));
  return clampMoney((selectedProduct?.price ?? 0) * quantity);
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
        const contributionMap = calculateRoomObjectBudgetContributionMap({
          room,
          houseSizeSqm: house.sizeSqm,
          houseRoomCount: house.rooms.length,
        });

        for (const objectItem of room.objects) {
          if (!objectItem.selectedProductId) {
            continue;
          }
          const selectedOption = objectItem.productOptions.find((option) => option.id === objectItem.selectedProductId);
          if (!selectedOption) {
            continue;
          }

          const estimatedCost = contributionMap.get(objectItem.id) ?? 0;
          if (estimatedCost <= 0) {
            continue;
          }

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

  const objectBudget = normalizeAllowance(roomObject.budgetAllowance ?? null);
  const objectBudgetInfo = resolveObjectBudgetInfo(candidateTotal, objectBudget);
  const keepsProjectOnPlan = isPlanKept(nextBudget.totalBudget, nextBudget.remainingAmount);
  const keepsHouseOnPlan = isPlanKept(nextHouseBudget?.totalBudget ?? null, nextHouseBudget?.remainingAmount ?? null);
  const keepsRoomOnPlan = isPlanKept(nextRoomBudget?.totalBudget ?? null, nextRoomBudget?.remainingAmount ?? null);
  const keepsCategoryOnPlan = isPlanKept(
    nextCategoryBudget?.totalBudget ?? null,
    nextCategoryBudget?.remainingAmount ?? null
  );

  return {
    optionId,
    candidateCategory: candidateOption.budgetCategory,
    candidateTotal,
    candidateLeadTimeDays: Math.max(0, candidateOption.leadTimeDays || 0),
    priceMissing: candidateOption.price <= 0,
    isCurrentSelection: roomObject.selectedProductId === optionId,
    currentSelectedTotal,
    deltaAmount,
    fitLabel: fit.fitLabel,
    fitTone: fit.fitTone,
    objectBudget,
    objectBudgetDelta: objectBudgetInfo.objectBudgetDelta,
    objectBudgetLabel: objectBudgetInfo.objectBudgetLabel,
    objectBudgetTone: objectBudgetInfo.objectBudgetTone,
    objectBudgetStatus: objectBudgetInfo.objectBudgetStatus,
    currentProjectRemaining: currentBudget.remainingAmount,
    nextProjectRemaining: nextBudget.remainingAmount,
    currentHouseRemaining: currentHouseBudget?.remainingAmount ?? null,
    nextHouseRemaining: nextHouseBudget?.remainingAmount ?? null,
    currentRoomRemaining: currentRoomBudget?.remainingAmount ?? null,
    nextRoomRemaining: nextRoomBudget?.remainingAmount ?? null,
    currentCategoryRemaining: currentCategoryBudget?.remainingAmount ?? 0,
    nextCategoryRemaining: nextCategoryBudget?.remainingAmount ?? 0,
    keepsProjectOnPlan,
    keepsHouseOnPlan,
    keepsRoomOnPlan,
    keepsCategoryOnPlan,
    recommendationScore: 0,
    primaryReasonLabel: fit.fitLabel,
    secondaryReasonLabel: objectBudgetInfo.objectBudgetLabel,
  };
}

function compareNullableDistance(a: number | null, b: number | null): number {
  if (a === null && b === null) {
    return 0;
  }
  if (a === null) {
    return 1;
  }
  if (b === null) {
    return -1;
  }
  return Math.abs(a) - Math.abs(b);
}

function getClosestObjectBudgetOptionId(impacts: ProductOptionBudgetImpact[]): string | null {
  const candidates = impacts.filter((impact) => impact.objectBudget !== null && impact.objectBudgetDelta !== null && !impact.priceMissing);
  if (candidates.length === 0) {
    return null;
  }

  candidates.sort((a, b) => compareNullableDistance(a.objectBudgetDelta, b.objectBudgetDelta));
  return candidates[0]?.optionId ?? null;
}

function buildRecommendationScore(
  impact: ProductOptionBudgetImpact,
  isClosestObjectBudgetOption: boolean
): number {
  let score = 0;

  if (impact.isCurrentSelection) {
    score += 1000000;
  }

  const keptPlansCount =
    Number(impact.keepsRoomOnPlan) +
    Number(impact.keepsHouseOnPlan) +
    Number(impact.keepsCategoryOnPlan) +
    Number(impact.keepsProjectOnPlan);
  score += keptPlansCount * 10000;

  if (impact.keepsRoomOnPlan && impact.keepsHouseOnPlan && impact.keepsCategoryOnPlan && impact.keepsProjectOnPlan) {
    score += 50000;
  }

  if (impact.objectBudget !== null) {
    if (impact.objectBudgetStatus === "on_object_budget") {
      score += 4000;
    } else if (impact.objectBudgetStatus === "under_object_budget") {
      score += 2500;
    } else if (impact.objectBudgetStatus === "over_object_budget") {
      score -= 2500;
    }

    if (isClosestObjectBudgetOption) {
      score += 3000;
    }

    score -= Math.abs(impact.objectBudgetDelta ?? 0);
  }

  if (impact.deltaAmount < 0) {
    score += 1000;
  }
  score -= Math.abs(impact.deltaAmount);
  score -= impact.candidateLeadTimeDays * 10;

  if (impact.priceMissing) {
    score -= 250000;
  }

  return score;
}

function buildPrimaryReasonLabel(
  impact: ProductOptionBudgetImpact,
  isClosestObjectBudgetOption: boolean
): string {
  const keepsAllPlans =
    impact.keepsRoomOnPlan &&
    impact.keepsHouseOnPlan &&
    impact.keepsCategoryOnPlan &&
    impact.keepsProjectOnPlan;

  if (impact.isCurrentSelection) {
    return "Current selection";
  }
  if (!impact.keepsRoomOnPlan) {
    return "Pushes room over plan";
  }
  if (!impact.keepsHouseOnPlan) {
    return "Pushes house over plan";
  }
  if (!impact.keepsCategoryOnPlan) {
    return "Pushes category over plan";
  }
  if (!impact.keepsProjectOnPlan) {
    return "Pushes project over plan";
  }
  if (impact.priceMissing) {
    return "Price missing";
  }
  if (keepsAllPlans && impact.objectBudget !== null && impact.objectBudgetStatus !== "over_object_budget") {
    return "Best fit";
  }
  if (isClosestObjectBudgetOption && impact.objectBudget !== null) {
    return "Closest to object budget";
  }
  if (impact.objectBudgetStatus === "over_object_budget") {
    return "Over object budget";
  }
  if (impact.objectBudgetStatus === "under_object_budget" || impact.objectBudgetStatus === "on_object_budget") {
    return "Within object budget";
  }
  return "Keeps room on plan";
}

function buildSecondaryReasonLabel(
  impact: ProductOptionBudgetImpact,
  isClosestObjectBudgetOption: boolean,
  primaryReasonLabel: string
): string | null {
  const keepsAllPlans =
    impact.keepsRoomOnPlan &&
    impact.keepsHouseOnPlan &&
    impact.keepsCategoryOnPlan &&
    impact.keepsProjectOnPlan;

  if (impact.priceMissing && primaryReasonLabel !== "Price missing") {
    return "Price missing";
  }
  if (isClosestObjectBudgetOption && impact.objectBudget !== null && primaryReasonLabel !== "Closest to object budget") {
    return "Closest to object budget";
  }
  if (keepsAllPlans && primaryReasonLabel !== "Best fit") {
    return "Keeps all plans";
  }
  if (impact.objectBudgetLabel && impact.objectBudgetLabel !== primaryReasonLabel) {
    return impact.objectBudgetLabel;
  }
  if (impact.keepsRoomOnPlan && primaryReasonLabel !== "Keeps room on plan") {
    return "Keeps room on plan";
  }
  return null;
}

export function annotateProductOptionBudgetImpacts(
  impacts: ProductOptionBudgetImpact[]
): ProductOptionBudgetImpact[] {
  const closestObjectBudgetOptionId = getClosestObjectBudgetOptionId(impacts);

  return impacts
    .map((impact) => {
      const isClosestObjectBudgetOption = closestObjectBudgetOptionId === impact.optionId;
      const recommendationScore = buildRecommendationScore(impact, isClosestObjectBudgetOption);
      const primaryReasonLabel = buildPrimaryReasonLabel(impact, isClosestObjectBudgetOption);
      const secondaryReasonLabel = buildSecondaryReasonLabel(
        impact,
        isClosestObjectBudgetOption,
        primaryReasonLabel
      );

      return {
        ...impact,
        recommendationScore,
        primaryReasonLabel,
        secondaryReasonLabel,
      };
    })
    .sort((a, b) => {
      if (b.recommendationScore !== a.recommendationScore) {
        return b.recommendationScore - a.recommendationScore;
      }
      return a.optionId.localeCompare(b.optionId);
    });
}

export function buildCategoryBudgetMap(categories: BudgetCategory[]): Record<BudgetCategoryName, number> {
  return budgetCategoryOrder.reduce<Record<BudgetCategoryName, number>>((acc, categoryName) => {
    const category = categories.find((item) => item.name === categoryName);
    acc[categoryName] = clampMoney(category?.totalBudget ?? defaultCategoryBudgets[categoryName]);
    return acc;
  }, {} as Record<BudgetCategoryName, number>);
}




