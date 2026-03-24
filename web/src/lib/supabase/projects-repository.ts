import { normalizeCurrencyCode } from "@/lib/currency";
import { budgetCategoryOrder, createMockProjectBudget, resolveBudgetCategory } from "@/lib/mock/budget";
import { isSupabaseConfigured, supabase } from "@/lib/supabase/client";
import { BudgetCategoryName, House, ProductOption, Project, ProjectBudget, Room, RoomObject, RoomType } from "@/types";
import { ClientViewApplyResult, ClientViewDetail, ClientViewHouseOverview, ClientViewItem, ClientViewItemOption, ClientViewProjectOverview, ClientViewPublishInput, ClientViewResponse, ClientViewStatus, ClientViewSummary } from "@/types";

interface ProjectRow {
  id: string;
  name: string;
  client_name: string | null;
  location: string | null;
  currency: string | null;
}

interface HouseRow {
  id: string;
  project_id: string;
  name: string;
  size_sq_m: number | null;
  sort_order: number | null;
}

interface RoomRow {
  id: string;
  house_id: string;
  name: string;
  size_sq_m: number | null;
  room_type: string;
  sort_order: number | null;
}

interface CreateRoomInput {
  houseId: string;
  name: string;
  roomType: RoomType;
  sizeSqm?: number;
}

interface CreateRoomObjectInput {
  roomId: string;
  name: string;
  category: string;
  quantity: number;
}

interface CreateHouseInput {
  projectId: string;
  name: string;
  sizeSqm?: number;
}

interface DuplicateHouseInput {
  projectId: string;
  sourceHouse: House;
  name?: string;
}

interface InviteProjectCollaboratorInput {
  projectId: string;
  email: string;
  role?: "viewer" | "editor";
}

interface ProjectSnapshotRow {
  id: string;
  project_id: string;
  snapshot_name: string;
  created_at: string;
}

export interface ProjectSnapshotSummary {
  id: string;
  projectId: string;
  name: string;
  createdAt: string;
}

interface RoomObjectRow {
  id: string;
  room_id: string;
  name: string;
  category: string;
  quantity?: number | null;
  budget_allowance?: number | null;
  material_search_query?: string | null;
  selected_material_id: string | null;
  po_approved?: boolean | null;
  is_ordered?: boolean | null;
  is_installed?: boolean | null;
  sort_order: number | null;
}

interface MaterialRow {
  id: string;
  name: string;
  supplier_name: string | null;
  description?: string | null;
  price: number | null;
  lead_time_days: number | null;
  budget_category: string;
  sku: string | null;
  source_type: string;
  source_url: string | null;
  tags?: string[] | null;
  updated_at?: string | null;
}

interface ProjectBudgetRow {
  project_id: string;
  total_budget: number | null;
  currency: string | null;
}

interface ProjectBudgetCategoryRow {
  id: string;
  project_id: string;
  category_name: string;
  total_budget: number | null;
}

interface ProjectHouseBudgetRow {
  id: string;
  project_id: string;
  house_id: string;
  total_budget: number | null;
}

interface ProjectRoomBudgetRow {
  id: string;
  project_id: string;
  room_id: string;
  total_budget: number | null;
}

const roomTypeSet = new Set<RoomType>([
  "living_room",
  "kitchen",
  "bathroom",
  "bedroom",
  "dining_room",
  "entry",
  "office",
  "laundry",
  "outdoor",
]);

const defaultRoomBlueprint: Array<{ name: string; roomType: RoomType }> = [
  { name: "Entry", roomType: "entry" },
  { name: "Living Room", roomType: "living_room" },
  { name: "Kitchen", roomType: "kitchen" },
  { name: "Dining Room", roomType: "dining_room" },
  { name: "Bedroom", roomType: "bedroom" },
  { name: "Bathroom", roomType: "bathroom" },
];

const budgetCategorySet = new Set<BudgetCategoryName>([
  "Furniture",
  "Lighting",
  "Tiles",
  "Bathroom",
  "Kitchen",
  "Decor",
]);

function normalizeRoomType(value: string): RoomType {
  if (roomTypeSet.has(value as RoomType)) {
    return value as RoomType;
  }
  return "living_room";
}

function normalizeBudgetCategory(value: string, objectName: string, objectCategory: string): BudgetCategoryName {
  if (budgetCategorySet.has(value as BudgetCategoryName)) {
    return value as BudgetCategoryName;
  }
  return resolveBudgetCategory(objectName, objectCategory);
}

function normalizeSizeSqm(value: number | null): number | undefined {
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) {
    return undefined;
  }
  return Number(value);
}

function normalizeBudgetAllowance(value: number | null | undefined): number | null | undefined {
  if (value == null) {
    return null;
  }
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) {
    return undefined;
  }
  return Math.round(value);
}

function hasMissingWorkflowColumnsError(code?: string, message?: string): boolean {
  if (code === "42703" || code === "PGRST204") {
    return true;
  }
  const normalizedMessage = (message ?? "").toLowerCase();
  return (
    normalizedMessage.includes("po_approved") ||
    normalizedMessage.includes("is_ordered") ||
    normalizedMessage.includes("is_installed")
  );
}

function hasMissingQuantityColumnError(code?: string, message?: string): boolean {
  if (code === "42703" || code === "PGRST204") {
    return true;
  }
  const normalizedMessage = (message ?? "").toLowerCase();
  return normalizedMessage.includes("quantity");
}

function hasMissingBudgetAllowanceColumnError(code?: string, message?: string): boolean {
  if (code === "42703" || code === "PGRST204") {
    return true;
  }
  const normalizedMessage = (message ?? "").toLowerCase();
  return normalizedMessage.includes("budget_allowance");
}

function hasMissingMaterialSearchQueryColumnError(code?: string, message?: string): boolean {
  if (code === "42703" || code === "PGRST204") {
    return true;
  }
  const normalizedMessage = (message ?? "").toLowerCase();
  return normalizedMessage.includes("material_search_query");
}

function hasMissingMaterialTagsColumnError(code?: string, message?: string): boolean {
  if (code === "42703" || code === "PGRST204") {
    return true;
  }
  const normalizedMessage = (message ?? "").toLowerCase();
  return normalizedMessage.includes("tags");
}

function hasMissingRpcFunctionError(code?: string, message?: string, functionName?: string): boolean {
  if (code === "PGRST202" || code === "42883") {
    return true;
  }
  const normalizedMessage = (message ?? "").toLowerCase();
  if (!normalizedMessage.includes("function")) {
    return false;
  }
  if (!functionName) {
    return normalizedMessage.includes("does not exist");
  }
  return normalizedMessage.includes(functionName.toLowerCase());
}

function hasMissingSnapshotsSchemaError(code?: string, message?: string): boolean {
  if (code === "42P01" || code === "PGRST205") {
    return true;
  }
  const normalizedMessage = (message ?? "").toLowerCase();
  return normalizedMessage.includes("project_snapshots");
}

function hasMissingBudgetPlanningSchemaError(code?: string, message?: string): boolean {
  if (code === "42P01" || code === "PGRST205" || code === "PGRST204") {
    return true;
  }
  const normalizedMessage = (message ?? "").toLowerCase();
  return (
    normalizedMessage.includes("project_house_budgets") ||
    normalizedMessage.includes("project_room_budgets") ||
    normalizedMessage.includes("project_budget_categories") ||
    normalizedMessage.includes("project_budgets")
  );
}

function toProductOptionFromMaterial(material: MaterialRow, objectName: string, objectCategory: string): ProductOption {
  return {
    id: material.id,
    name: material.name,
    supplier: material.supplier_name ?? "Private Material",
    description: material.description ?? undefined,
    price: Math.max(0, Math.round(material.price ?? 0)),
    leadTimeDays: Math.max(0, Math.round(material.lead_time_days ?? 0)),
    budgetCategory: normalizeBudgetCategory(material.budget_category, objectName, objectCategory),
    sku: material.sku ?? undefined,
    sourceType: material.source_type === "link" ? "link" : "catalog",
    sourceUrl: material.source_url ?? undefined,
    tags: material.tags ?? undefined,
    updatedAt: material.updated_at ?? undefined,
  };
}

export async function loadProjectBudgetsByProjectIds(projects: Project[]): Promise<Record<string, ProjectBudget>> {
  if (!isSupabaseConfigured || projects.length === 0) {
    return {};
  }

  const projectIds = projects.map((project) => project.id);

  try {
    const [projectBudgetResult, categoryBudgetResult, houseBudgetResult, roomBudgetResult] = await Promise.all([
      supabase.from("project_budgets").select("project_id,total_budget,currency").in("project_id", projectIds),
      supabase.from("project_budget_categories").select("id,project_id,category_name,total_budget").in("project_id", projectIds),
      supabase.from("project_house_budgets").select("id,project_id,house_id,total_budget").in("project_id", projectIds),
      supabase.from("project_room_budgets").select("id,project_id,room_id,total_budget").in("project_id", projectIds),
    ]);

    const possibleErrors = [
      projectBudgetResult.error,
      categoryBudgetResult.error,
      houseBudgetResult.error,
      roomBudgetResult.error,
    ].filter(Boolean);
    const schemaError = possibleErrors.find((error) =>
      hasMissingBudgetPlanningSchemaError(error?.code, error?.message)
    );
    if (schemaError) {
      return {};
    }
    const firstError = possibleErrors[0];
    if (firstError) {
      throw firstError;
    }

    const projectBudgetRows = (projectBudgetResult.data ?? []) as unknown as ProjectBudgetRow[];
    const categoryBudgetRows = (categoryBudgetResult.data ?? []) as unknown as ProjectBudgetCategoryRow[];
    const houseBudgetRows = (houseBudgetResult.data ?? []) as unknown as ProjectHouseBudgetRow[];
    const roomBudgetRows = (roomBudgetResult.data ?? []) as unknown as ProjectRoomBudgetRow[];

    return projects.reduce<Record<string, ProjectBudget>>((acc, project) => {
      const baseBudget = createMockProjectBudget(project);
      const projectBudgetRow = projectBudgetRows.find((row) => row.project_id === project.id);
      const categoryRows = categoryBudgetRows.filter((row) => row.project_id === project.id);
      const houseRows = houseBudgetRows.filter((row) => row.project_id === project.id);
      const roomRows = roomBudgetRows.filter((row) => row.project_id === project.id);

      acc[project.id] = {
        ...baseBudget,
        totalBudget: Math.max(0, Math.round(projectBudgetRow?.total_budget ?? baseBudget.totalBudget)),
        remainingAmount: Math.max(0, Math.round(projectBudgetRow?.total_budget ?? baseBudget.totalBudget)),
        categories: budgetCategoryOrder.map((categoryName) => {
          const existing = baseBudget.categories.find((item) => item.name === categoryName);
          const row = categoryRows.find((item) => item.category_name === categoryName);
          const totalBudget = Math.max(0, Math.round(row?.total_budget ?? existing?.totalBudget ?? 0));
          return {
            id: row?.id ?? existing?.id ?? categoryName.toLowerCase(),
            name: categoryName,
            totalBudget,
            allocatedAmount: 0,
            remainingAmount: totalBudget,
          };
        }),
        houses: baseBudget.houses.map((house) => {
          const row = houseRows.find((item) => item.house_id === house.houseId);
          const totalBudget = Math.max(0, Math.round(row?.total_budget ?? house.totalBudget));
          return {
            ...house,
            id: row?.id ?? house.id,
            totalBudget,
            allocatedAmount: 0,
            remainingAmount: totalBudget,
          };
        }),
        rooms: baseBudget.rooms.map((room) => {
          const row = roomRows.find((item) => item.room_id === room.roomId);
          const totalBudget = typeof row?.total_budget === "number" ? Math.max(0, Math.round(row.total_budget)) : null;
          return {
            ...room,
            id: row?.id ?? room.id,
            totalBudget,
            allocatedAmount: 0,
            remainingAmount: totalBudget,
          };
        }),
      };
      return acc;
    }, {});
  } catch (error) {
    console.warn("Failed to load project budgets from Supabase.", error);
    return {};
  }
}

export async function saveProjectBudgetByProjectId(
  project: Project,
  payload: {
    totalBudget: number;
    categoryBudgets: Record<BudgetCategoryName, number>;
    houseBudgets: Record<string, number>;
    roomBudgets: Record<string, number | null>;
  }
): Promise<void> {
  if (!isSupabaseConfigured) {
    return;
  }

  const projectId = project.id.trim();
  if (!projectId) {
    throw new Error("Project ID is required.");
  }

  const normalizedTotalBudget = Math.max(0, Math.round(payload.totalBudget));
  const categoryRows = budgetCategoryOrder.map((categoryName) => ({
    project_id: projectId,
    category_name: categoryName,
    total_budget: Math.max(0, Math.round(payload.categoryBudgets[categoryName] ?? 0)),
  }));
  const houseRows = project.houses.map((house) => ({
    project_id: projectId,
    house_id: house.id,
    total_budget: Math.max(0, Math.round(payload.houseBudgets[house.id] ?? 0)),
  }));
  const roomRows = project.houses.flatMap((house) =>
    house.rooms
      .map((room) => {
        const totalBudget = payload.roomBudgets[room.id];
        if (typeof totalBudget !== "number") {
          return null;
        }
        return {
          project_id: projectId,
          room_id: room.id,
          total_budget: Math.max(0, Math.round(totalBudget)),
        };
      })
      .filter((row): row is { project_id: string; room_id: string; total_budget: number } => Boolean(row))
  );

  const { error: projectBudgetError } = await supabase.from("project_budgets").upsert(
    {
      project_id: projectId,
      total_budget: normalizedTotalBudget,
      currency: normalizeCurrencyCode(project.currency),
    },
    { onConflict: "project_id" }
  );
  if (projectBudgetError) {
    if (hasMissingBudgetPlanningSchemaError(projectBudgetError.code, projectBudgetError.message)) {
      throw new Error("Budget persistence tables are missing in DB. Apply the latest migrations and retry.");
    }
    throw new Error(projectBudgetError.message);
  }

  const { error: categoryError } = await supabase
    .from("project_budget_categories")
    .upsert(categoryRows, { onConflict: "project_id,category_name" });
  if (categoryError) {
    if (hasMissingBudgetPlanningSchemaError(categoryError.code, categoryError.message)) {
      throw new Error("Budget persistence tables are missing in DB. Apply the latest migrations and retry.");
    }
    throw new Error(categoryError.message);
  }

  const { error: houseError } = await supabase
    .from("project_house_budgets")
    .upsert(houseRows, { onConflict: "project_id,house_id" });
  if (houseError) {
    if (hasMissingBudgetPlanningSchemaError(houseError.code, houseError.message)) {
      throw new Error("Budget persistence tables are missing in DB. Apply the latest migrations and retry.");
    }
    throw new Error(houseError.message);
  }

  const currentRoomIds = project.houses.flatMap((house) => house.rooms.map((room) => room.id));
  if (currentRoomIds.length > 0) {
    const { error: deleteRoomError } = await supabase
      .from("project_room_budgets")
      .delete()
      .eq("project_id", projectId)
      .in("room_id", currentRoomIds);
    if (deleteRoomError) {
      if (hasMissingBudgetPlanningSchemaError(deleteRoomError.code, deleteRoomError.message)) {
        throw new Error("Budget persistence tables are missing in DB. Apply the latest migrations and retry.");
      }
      throw new Error(deleteRoomError.message);
    }
  }

  if (roomRows.length > 0) {
    const { error: roomError } = await supabase
      .from("project_room_budgets")
      .insert(roomRows);
    if (roomError) {
      if (hasMissingBudgetPlanningSchemaError(roomError.code, roomError.message)) {
        throw new Error("Budget persistence tables are missing in DB. Apply the latest migrations and retry.");
      }
      throw new Error(roomError.message);
    }
  }
}

export async function loadProjectsForWorkspace(): Promise<Project[]> {
  if (!isSupabaseConfigured) {
    return [];
  }

  try {
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session) {
      return [];
    }

    const { error: acceptInvitesError } = await supabase.rpc("accept_pending_project_invites");
    if (
      acceptInvitesError &&
      !hasMissingRpcFunctionError(
        acceptInvitesError.code,
        acceptInvitesError.message,
        "accept_pending_project_invites"
      )
    ) {
      throw acceptInvitesError;
    }

    const { data: projectRows, error: projectError } = await supabase
      .from("projects")
      .select("id,name,client_name,location,currency")
      .order("created_at", { ascending: true });

    if (projectError) {
      throw projectError;
    }

    if (!projectRows || projectRows.length === 0) {
      return [];
    }

    const projects = projectRows as unknown as ProjectRow[];
    const projectIds = projects.map((project) => project.id);

    const { data: houseRows, error: houseError } = await supabase
      .from("houses")
      .select("id,project_id,name,size_sq_m,sort_order")
      .in("project_id", projectIds)
      .order("sort_order", { ascending: true });

    if (houseError) {
      throw houseError;
    }

    const houses = (houseRows ?? []) as unknown as unknown as HouseRow[];

    const houseIds = houses.map((house) => house.id);
    const roomsQuery = supabase
      .from("rooms")
      .select("id,house_id,name,size_sq_m,room_type,sort_order")
      .order("sort_order", { ascending: true });
    const { data: roomRows, error: roomError } =
      houseIds.length > 0 ? await roomsQuery.in("house_id", houseIds) : await roomsQuery.limit(0);

    if (roomError) {
      throw roomError;
    }

    const rooms = (roomRows ?? []) as unknown as unknown as RoomRow[];

    const roomIds = rooms.map((room) => room.id);
    const roomObjectSelectCandidates = [
      "id,room_id,name,category,selected_material_id,sort_order,material_search_query,quantity,po_approved,is_ordered,is_installed,budget_allowance",
      "id,room_id,name,category,selected_material_id,sort_order,material_search_query,quantity,po_approved,is_ordered,is_installed",
      "id,room_id,name,category,selected_material_id,sort_order,material_search_query,quantity",
      "id,room_id,name,category,selected_material_id,sort_order,material_search_query",
      "id,room_id,name,category,selected_material_id,sort_order,quantity,po_approved,is_ordered,is_installed,budget_allowance",
      "id,room_id,name,category,selected_material_id,sort_order,quantity,po_approved,is_ordered,is_installed",
      "id,room_id,name,category,selected_material_id,sort_order,quantity",
      "id,room_id,name,category,selected_material_id,sort_order",
    ];

    let roomObjects: RoomObjectRow[] = [];
    if (roomIds.length > 0) {
      for (const selectClause of roomObjectSelectCandidates) {
        const { data: roomObjectRows, error: roomObjectError } = await supabase
          .from("room_objects")
          .select(selectClause)
          .in("room_id", roomIds)
          .order("sort_order", { ascending: true });

        if (!roomObjectError) {
          roomObjects = (roomObjectRows ?? []) as unknown as RoomObjectRow[];
          break;
        }

        const canFallback =
          hasMissingBudgetAllowanceColumnError(roomObjectError.code, roomObjectError.message) ||
          hasMissingWorkflowColumnsError(roomObjectError.code, roomObjectError.message) ||
          hasMissingQuantityColumnError(roomObjectError.code, roomObjectError.message) ||
          hasMissingMaterialSearchQueryColumnError(roomObjectError.code, roomObjectError.message);
        if (!canFallback || selectClause === roomObjectSelectCandidates[roomObjectSelectCandidates.length - 1]) {
          throw roomObjectError;
        }
      }
    }
    const selectedMaterialIds = roomObjects
      .map((objectItem) => objectItem.selected_material_id)
      .filter((item): item is string => Boolean(item));

    const uniqueSelectedMaterialIds = Array.from(new Set(selectedMaterialIds));
    let selectedMaterials: MaterialRow[] = [];

    if (uniqueSelectedMaterialIds.length > 0) {
      const materialSelect = "id,name,supplier_name,description,price,lead_time_days,budget_category,sku,source_type,source_url,updated_at,tags";
      const { data: materialRows, error: materialError } = await supabase
        .from("materials")
        .select(materialSelect)
        .in("id", uniqueSelectedMaterialIds);

      if (materialError && hasMissingMaterialTagsColumnError(materialError.code, materialError.message)) {
        const fallback = await supabase
          .from("materials")
          .select("id,name,supplier_name,description,price,lead_time_days,budget_category,sku,source_type,source_url,updated_at")
          .in("id", uniqueSelectedMaterialIds);
        if (fallback.error) {
          throw fallback.error;
        }
        selectedMaterials = (fallback.data ?? []) as unknown as MaterialRow[];
      } else if (materialError) {
        throw materialError;
      } else {
        selectedMaterials = (materialRows ?? []) as unknown as MaterialRow[];
      }
    }

    const selectedMaterialMap = new Map(selectedMaterials.map((material) => [material.id, material]));
    const roomsByHouseId = new Map<string, RoomRow[]>();
    const roomObjectsByRoomId = new Map<string, RoomObjectRow[]>();

    for (const room of rooms) {
      const current = roomsByHouseId.get(room.house_id) ?? [];
      current.push(room);
      roomsByHouseId.set(room.house_id, current);
    }

    for (const roomObject of roomObjects) {
      const current = roomObjectsByRoomId.get(roomObject.room_id) ?? [];
      current.push(roomObject);
      roomObjectsByRoomId.set(roomObject.room_id, current);
    }

    const mappedProjects: Project[] = projects.map((project) => {
      const mappedHouses: House[] = houses
        .filter((house) => house.project_id === project.id)
        .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
        .map((house) => {
          const mappedRooms: Room[] = (roomsByHouseId.get(house.id) ?? [])
            .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
            .map((room) => {
              const mappedRoomObjects: RoomObject[] = (roomObjectsByRoomId.get(room.id) ?? [])
                .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
                .map((roomObject) => {
                  const selectedMaterial = roomObject.selected_material_id
                    ? selectedMaterialMap.get(roomObject.selected_material_id)
                    : undefined;
                  const selectedOption = selectedMaterial
                    ? toProductOptionFromMaterial(selectedMaterial, roomObject.name, roomObject.category)
                    : undefined;

                  const options = selectedOption ? [selectedOption] : [];

                  return {
                    id: roomObject.id,
                    roomId: roomObject.room_id,
                    name: roomObject.name,
                    category: roomObject.category,
                    quantity: Math.max(1, Math.round(roomObject.quantity ?? 1)),
                    budgetAllowance: normalizeBudgetAllowance(roomObject.budget_allowance) ?? null,
                    materialSearchQuery: roomObject.material_search_query ?? undefined,
                    selectedProductId: roomObject.selected_material_id ?? undefined,
                    poApproved: Boolean(roomObject.po_approved),
                    ordered: Boolean(roomObject.is_ordered),
                    installed: Boolean(roomObject.is_installed),
                    productOptions: options,
                  };
                });

              return {
                id: room.id,
                houseId: room.house_id,
                name: room.name,
                sizeSqm: normalizeSizeSqm(room.size_sq_m),
                type: normalizeRoomType(room.room_type),
                objects: mappedRoomObjects,
              };
            });

          return {
            id: house.id,
            projectId: house.project_id,
            name: house.name,
            sizeSqm: normalizeSizeSqm(house.size_sq_m),
            rooms: mappedRooms,
          };
        });

      return {
        id: project.id,
        name: project.name,
        customer: project.client_name ?? "Unknown client",
        location: project.location ?? "Unknown location",
        currency: normalizeCurrencyCode(project.currency),
        houses: mappedHouses,
      };
    });

    return mappedProjects;
  } catch (error) {
    console.warn("Failed to load projects from Supabase.", error);
    return [];
  }
}

export async function deleteProjectById(projectId: string): Promise<void> {
  if (!isSupabaseConfigured) {
    return;
  }

  const normalizedProjectId = projectId.trim();
  if (!normalizedProjectId) {
    throw new Error("Project ID is required.");
  }

  const { error } = await supabase.from("projects").delete().eq("id", normalizedProjectId);
  if (error) {
    throw new Error(error.message);
  }
}

export async function createRoomForHouse({ houseId, name, roomType, sizeSqm }: CreateRoomInput): Promise<Room> {
  if (!isSupabaseConfigured) {
    throw new Error("Supabase is not configured.");
  }

  const normalizedHouseId = houseId.trim();
  const normalizedName = name.trim();
  if (!normalizedHouseId) {
    throw new Error("House ID is required.");
  }
  if (!normalizedName) {
    throw new Error("Room name is required.");
  }

  const normalizedSize =
    typeof sizeSqm === "number" && Number.isFinite(sizeSqm) && sizeSqm > 0
      ? Math.round(sizeSqm * 100) / 100
      : null;

  const { data: latestRoomRows, error: latestRoomError } = await supabase
    .from("rooms")
    .select("sort_order")
    .eq("house_id", normalizedHouseId)
    .order("sort_order", { ascending: false })
    .limit(1);

  if (latestRoomError) {
    throw new Error(latestRoomError.message);
  }

  const nextSortOrder = ((latestRoomRows?.[0]?.sort_order as number | null | undefined) ?? -1) + 1;

  const { data, error } = await supabase
    .from("rooms")
    .insert({
      house_id: normalizedHouseId,
      name: normalizedName,
      room_type: roomType,
      size_sq_m: normalizedSize,
      sort_order: nextSortOrder,
    })
    .select("id,house_id,name,size_sq_m,room_type,sort_order")
    .single();

  if (error) {
    throw new Error(error.message);
  }

  const row = data as RoomRow;
  return {
    id: row.id,
    houseId: row.house_id,
    name: row.name,
    sizeSqm: normalizeSizeSqm(row.size_sq_m),
    type: normalizeRoomType(row.room_type),
    objects: [],
  };
}

export async function renameRoomById(roomId: string, nextName: string): Promise<void> {
  if (!isSupabaseConfigured) {
    throw new Error("Supabase is not configured.");
  }

  const normalizedRoomId = roomId.trim();
  const normalizedName = nextName.trim();
  if (!normalizedRoomId) {
    throw new Error("Room ID is required.");
  }
  if (!normalizedName) {
    throw new Error("Room name is required.");
  }

  const { error } = await supabase
    .from("rooms")
    .update({
      name: normalizedName,
    })
    .eq("id", normalizedRoomId);

  if (error) {
    throw new Error(error.message);
  }
}

export async function renameHouseById(houseId: string, nextName: string): Promise<void> {
  if (!isSupabaseConfigured) {
    throw new Error("Supabase is not configured.");
  }

  const normalizedHouseId = houseId.trim();
  const normalizedName = nextName.trim();
  if (!normalizedHouseId) {
    throw new Error("House ID is required.");
  }
  if (!normalizedName) {
    throw new Error("House name is required.");
  }

  const { error } = await supabase
    .from("houses")
    .update({
      name: normalizedName,
    })
    .eq("id", normalizedHouseId);

  if (error) {
    throw new Error(error.message);
  }
}

export async function renameProjectById(projectId: string, nextName: string): Promise<void> {
  if (!isSupabaseConfigured) {
    throw new Error("Supabase is not configured.");
  }

  const normalizedProjectId = projectId.trim();
  const normalizedName = nextName.trim();
  if (!normalizedProjectId) {
    throw new Error("Project ID is required.");
  }
  if (!normalizedName) {
    throw new Error("Project name is required.");
  }

  const { error } = await supabase
    .from("projects")
    .update({
      name: normalizedName,
    })
    .eq("id", normalizedProjectId);

  if (error) {
    throw new Error(error.message);
  }
}

export async function inviteProjectCollaboratorByEmail({
  projectId,
  email,
  role = "viewer",
}: InviteProjectCollaboratorInput): Promise<void> {
  if (!isSupabaseConfigured) {
    throw new Error("Supabase is not configured.");
  }

  const normalizedProjectId = projectId.trim();
  const normalizedEmail = email.trim().toLowerCase();
  const normalizedRole = role === "editor" ? "editor" : "viewer";

  if (!normalizedProjectId) {
    throw new Error("Project ID is required.");
  }
  if (!normalizedEmail) {
    throw new Error("Collaborator email is required.");
  }

  const { error } = await supabase.rpc("invite_project_collaborator", {
    p_project_id: normalizedProjectId,
    p_email: normalizedEmail,
    p_role: normalizedRole,
  });

  if (error) {
    throw new Error(error.message);
  }
}

export async function listProjectSnapshotsByProjectId(projectId: string): Promise<ProjectSnapshotSummary[]> {
  if (!isSupabaseConfigured) {
    return [];
  }

  const normalizedProjectId = projectId.trim();
  if (!normalizedProjectId) {
    throw new Error("Project ID is required.");
  }

  const { data, error } = await supabase
    .from("project_snapshots")
    .select("id,project_id,snapshot_name,created_at")
    .eq("project_id", normalizedProjectId)
    .order("created_at", { ascending: false })
    .limit(50);

  if (error) {
    if (hasMissingSnapshotsSchemaError(error.code, error.message)) {
      return [];
    }
    throw new Error(error.message);
  }

  return ((data ?? []) as unknown as ProjectSnapshotRow[]).map((row) => ({
    id: row.id,
    projectId: row.project_id,
    name: row.snapshot_name,
    createdAt: row.created_at,
  }));
}

export async function createProjectSnapshotByProjectId(projectId: string, snapshotName?: string): Promise<string> {
  if (!isSupabaseConfigured) {
    throw new Error("Supabase is not configured.");
  }

  const normalizedProjectId = projectId.trim();
  const normalizedSnapshotName = snapshotName?.trim() || null;
  if (!normalizedProjectId) {
    throw new Error("Project ID is required.");
  }

  const { data, error } = await supabase.rpc("create_project_snapshot", {
    p_project_id: normalizedProjectId,
    p_snapshot_name: normalizedSnapshotName,
  });

  if (error) {
    if (hasMissingRpcFunctionError(error.code, error.message, "create_project_snapshot")) {
      throw new Error("Project snapshots are not available yet. Apply the latest database migrations and retry.");
    }
    throw new Error(error.message);
  }

  return String(data ?? "");
}

export async function restoreProjectSnapshotById(projectId: string, snapshotId: string): Promise<void> {
  if (!isSupabaseConfigured) {
    throw new Error("Supabase is not configured.");
  }

  const normalizedProjectId = projectId.trim();
  const normalizedSnapshotId = snapshotId.trim();
  if (!normalizedProjectId) {
    throw new Error("Project ID is required.");
  }
  if (!normalizedSnapshotId) {
    throw new Error("Snapshot ID is required.");
  }

  const { error } = await supabase.rpc("restore_project_snapshot", {
    p_project_id: normalizedProjectId,
    p_snapshot_id: normalizedSnapshotId,
  });

  if (error) {
    if (hasMissingRpcFunctionError(error.code, error.message, "restore_project_snapshot")) {
      throw new Error("Project snapshots are not available yet. Apply the latest database migrations and retry.");
    }
    throw new Error(error.message);
  }
}

function normalizePositiveSizeSqm(value: number | undefined): number | null {
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) {
    return null;
  }
  return Math.round(value * 100) / 100;
}

function buildRoomObjectFromSource(
  sourceObject: RoomObject,
  targetRoomId: string,
  objectIndex: number
): {
  room_id: string;
  name: string;
  category: string;
  quantity: number;
  budget_allowance: number | null;
  material_search_query: string | null;
  selected_material_id: string | null;
  po_approved: boolean;
  is_ordered: boolean;
  is_installed: boolean;
  sort_order: number;
} {
  const poApproved = Boolean(sourceObject.poApproved);
  const ordered = Boolean(sourceObject.ordered) && poApproved;
  const installed = Boolean(sourceObject.installed) && ordered;
  return {
    room_id: targetRoomId,
    name: sourceObject.name.trim() || "Object",
    category: sourceObject.category.trim() || "Custom",
    quantity: Math.max(1, Math.round(sourceObject.quantity || 1)),
    budget_allowance: normalizeBudgetAllowance(sourceObject.budgetAllowance) ?? null,
    material_search_query: sourceObject.materialSearchQuery?.trim() || null,
    selected_material_id: sourceObject.selectedProductId ?? null,
    po_approved: poApproved,
    is_ordered: ordered,
    is_installed: installed,
    sort_order: objectIndex,
  };
}

export async function createHouseForProject({ projectId, name, sizeSqm }: CreateHouseInput): Promise<House> {
  if (!isSupabaseConfigured) {
    throw new Error("Supabase is not configured.");
  }

  const normalizedProjectId = projectId.trim();
  const normalizedName = name.trim();
  if (!normalizedProjectId) {
    throw new Error("Project ID is required.");
  }
  if (!normalizedName) {
    throw new Error("House name is required.");
  }

  const normalizedSizeSqm = normalizePositiveSizeSqm(sizeSqm);

  const { data: latestHouseRows, error: latestHouseError } = await supabase
    .from("houses")
    .select("sort_order")
    .eq("project_id", normalizedProjectId)
    .order("sort_order", { ascending: false })
    .limit(1);
  if (latestHouseError) {
    throw new Error(latestHouseError.message);
  }

  const nextHouseSortOrder = ((latestHouseRows?.[0]?.sort_order as number | null | undefined) ?? -1) + 1;

  const { data: createdHouseRow, error: createHouseError } = await supabase
    .from("houses")
    .insert({
      project_id: normalizedProjectId,
      name: normalizedName,
      size_sq_m: normalizedSizeSqm,
      sort_order: nextHouseSortOrder,
    })
    .select("id,project_id,name,size_sq_m,sort_order")
    .single();

  if (createHouseError) {
    throw new Error(createHouseError.message);
  }

  const houseRow = createdHouseRow as unknown as HouseRow;
  const roomInsertPayload = defaultRoomBlueprint.map((room, index) => ({
    house_id: houseRow.id,
    name: room.name,
    room_type: room.roomType,
    sort_order: index,
  }));

  const { data: createdRoomRows, error: createRoomsError } = await supabase
    .from("rooms")
    .insert(roomInsertPayload)
    .select("id,house_id,name,size_sq_m,room_type,sort_order")
    .order("sort_order", { ascending: true });

  if (createRoomsError) {
    throw new Error(createRoomsError.message);
  }

  const mappedRooms: Room[] = ((createdRoomRows ?? []) as unknown as unknown as RoomRow[]).map((row) => ({
    id: row.id,
    houseId: row.house_id,
    name: row.name,
    sizeSqm: normalizeSizeSqm(row.size_sq_m),
    type: normalizeRoomType(row.room_type),
    objects: [],
  }));

  return {
    id: houseRow.id,
    projectId: houseRow.project_id,
    name: houseRow.name,
    sizeSqm: normalizeSizeSqm(houseRow.size_sq_m),
    rooms: mappedRooms,
  };
}

export async function duplicateHouseWithContents({
  projectId,
  sourceHouse,
  name,
}: DuplicateHouseInput): Promise<House> {
  if (!isSupabaseConfigured) {
    throw new Error("Supabase is not configured.");
  }

  const normalizedProjectId = projectId.trim();
  if (!normalizedProjectId) {
    throw new Error("Project ID is required.");
  }

  const normalizedName = (name?.trim() || `${sourceHouse.name} Copy`).trim();
  if (!normalizedName) {
    throw new Error("Duplicated house name is required.");
  }

  const { data: latestHouseRows, error: latestHouseError } = await supabase
    .from("houses")
    .select("sort_order")
    .eq("project_id", normalizedProjectId)
    .order("sort_order", { ascending: false })
    .limit(1);
  if (latestHouseError) {
    throw new Error(latestHouseError.message);
  }

  const nextHouseSortOrder = ((latestHouseRows?.[0]?.sort_order as number | null | undefined) ?? -1) + 1;

  const { data: createdHouseRow, error: createHouseError } = await supabase
    .from("houses")
    .insert({
      project_id: normalizedProjectId,
      name: normalizedName,
      size_sq_m: normalizePositiveSizeSqm(sourceHouse.sizeSqm),
      sort_order: nextHouseSortOrder,
    })
    .select("id,project_id,name,size_sq_m,sort_order")
    .single();
  if (createHouseError) {
    throw new Error(createHouseError.message);
  }

  const houseRow = createdHouseRow as unknown as HouseRow;
  const sourceRooms = [...sourceHouse.rooms];

  const roomInsertPayload = sourceRooms.map((room, roomIndex) => ({
    house_id: houseRow.id,
    name: room.name.trim() || `Room ${roomIndex + 1}`,
    size_sq_m: normalizePositiveSizeSqm(room.sizeSqm),
    room_type: room.type,
    sort_order: roomIndex,
  }));

  const { data: createdRoomRows, error: createRoomsError } = await supabase
    .from("rooms")
    .insert(roomInsertPayload)
    .select("id,house_id,name,size_sq_m,room_type,sort_order")
    .order("sort_order", { ascending: true });
  if (createRoomsError) {
    throw new Error(createRoomsError.message);
  }

  const duplicatedRooms = ((createdRoomRows ?? []) as unknown as unknown as RoomRow[]).sort(
    (a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0)
  );

  const objectInsertPayload = sourceRooms.flatMap((sourceRoom, roomIndex) => {
    const duplicatedRoom = duplicatedRooms[roomIndex];
    if (!duplicatedRoom) {
      return [];
    }
    return sourceRoom.objects.map((sourceObject, objectIndex) =>
      buildRoomObjectFromSource(sourceObject, duplicatedRoom.id, objectIndex)
    );
  });

  if (objectInsertPayload.length > 0) {
    let { error: createObjectsError } = await supabase.from("room_objects").insert(objectInsertPayload);
    if (
      createObjectsError &&
      (hasMissingBudgetAllowanceColumnError(createObjectsError.code, createObjectsError.message) ||
        hasMissingWorkflowColumnsError(createObjectsError.code, createObjectsError.message) ||
        hasMissingQuantityColumnError(createObjectsError.code, createObjectsError.message))
    ) {
      const fallbackPayload = objectInsertPayload.map((item) => ({
        room_id: item.room_id,
        name: item.name,
        category: item.category,
        quantity: item.quantity,
        selected_material_id: item.selected_material_id,
        sort_order: item.sort_order,
      }));
      const fallbackResult = await supabase.from("room_objects").insert(fallbackPayload);
      createObjectsError = fallbackResult.error;
      if (createObjectsError && hasMissingQuantityColumnError(createObjectsError.code, createObjectsError.message)) {
        const legacyFallback = fallbackPayload.map((item) => ({
          room_id: item.room_id,
          name: item.name,
          category: item.category,
          selected_material_id: item.selected_material_id,
          sort_order: item.sort_order,
        }));
        const legacyResult = await supabase.from("room_objects").insert(legacyFallback);
        createObjectsError = legacyResult.error;
      }
    }
    if (createObjectsError) {
      throw new Error(createObjectsError.message);
    }
  }

  const duplicatedRoomsById = new Map(
    duplicatedRooms.map((row) => [
      row.id,
      {
        id: row.id,
        houseId: row.house_id,
        name: row.name,
        sizeSqm: normalizeSizeSqm(row.size_sq_m),
        type: normalizeRoomType(row.room_type),
        objects: [] as RoomObject[],
      },
    ])
  );

  sourceRooms.forEach((sourceRoom, roomIndex) => {
    const duplicatedRoom = duplicatedRooms[roomIndex];
    if (!duplicatedRoom) {
      return;
    }
    const targetRoom = duplicatedRoomsById.get(duplicatedRoom.id);
    if (!targetRoom) {
      return;
    }
    targetRoom.objects = sourceRoom.objects.map((sourceObject, objectIndex) => ({
      ...sourceObject,
      id: `${duplicatedRoom.id}-object-${objectIndex}-${Date.now()}`,
      roomId: duplicatedRoom.id,
      quantity: Math.max(1, sourceObject.quantity),
      budgetAllowance: normalizeBudgetAllowance(sourceObject.budgetAllowance) ?? null,
      selectedProductId: sourceObject.selectedProductId,
      poApproved: Boolean(sourceObject.poApproved),
      ordered: Boolean(sourceObject.ordered),
      installed: Boolean(sourceObject.installed),
      productOptions: sourceObject.productOptions,
    }));
  });

  return {
    id: houseRow.id,
    projectId: houseRow.project_id,
    name: houseRow.name,
    sizeSqm: normalizeSizeSqm(houseRow.size_sq_m),
    rooms: duplicatedRooms.map((row) => duplicatedRoomsById.get(row.id)!).filter(Boolean),
  };
}

export async function updateRoomObjectSelectedMaterialById(
  roomObjectId: string,
  selectedMaterialId: string | null
): Promise<void> {
  if (!isSupabaseConfigured) {
    throw new Error("Supabase is not configured.");
  }

  const normalizedObjectId = roomObjectId.trim();
  if (!normalizedObjectId) {
    throw new Error("Room object ID is required.");
  }

  const normalizedMaterialId = selectedMaterialId?.trim() || null;

  const { error } = await supabase
    .from("room_objects")
    .update({
      selected_material_id: normalizedMaterialId,
    })
    .eq("id", normalizedObjectId);

  if (error) {
    throw new Error(error.message);
  }
}

export async function updateRoomObjectWorkflowById(
  roomObjectId: string,
  workflow: { poApproved: boolean; ordered: boolean; installed: boolean }
): Promise<void> {
  if (!isSupabaseConfigured) {
    throw new Error("Supabase is not configured.");
  }

  const normalizedObjectId = roomObjectId.trim();
  if (!normalizedObjectId) {
    throw new Error("Room object ID is required.");
  }

  const { error } = await supabase
    .from("room_objects")
    .update({
      po_approved: Boolean(workflow.poApproved),
      is_ordered: Boolean(workflow.ordered),
      is_installed: Boolean(workflow.installed),
    })
    .eq("id", normalizedObjectId);

  if (error) {
    if (hasMissingWorkflowColumnsError(error.code, error.message)) {
      throw new Error("Workflow columns are missing in DB. Apply latest migrations and retry.");
    }
    throw new Error(error.message);
  }
}

export async function createRoomObjectForRoom({
  roomId,
  name,
  category,
  quantity,
}: CreateRoomObjectInput): Promise<RoomObject> {
  if (!isSupabaseConfigured) {
    throw new Error("Supabase is not configured.");
  }

  const normalizedRoomId = roomId.trim();
  const normalizedName = name.trim();
  const normalizedCategory = category.trim() || "Custom";
  const normalizedQuantity = Math.max(1, Math.min(999, Math.round(quantity || 1)));

  if (!normalizedRoomId) {
    throw new Error("Room ID is required.");
  }
  if (!normalizedName) {
    throw new Error("Object name is required.");
  }

  const { data: latestRows, error: latestError } = await supabase
    .from("room_objects")
    .select("sort_order")
    .eq("room_id", normalizedRoomId)
    .order("sort_order", { ascending: false })
    .limit(1);
  if (latestError) {
    throw new Error(latestError.message);
  }
  const nextSortOrder = ((latestRows?.[0]?.sort_order as number | null | undefined) ?? -1) + 1;

  const payload = {
    room_id: normalizedRoomId,
    name: normalizedName,
    category: normalizedCategory,
    quantity: normalizedQuantity,
    selected_material_id: null,
    po_approved: false,
    is_ordered: false,
    is_installed: false,
    sort_order: nextSortOrder,
  };

  const insertWithWorkflow = await supabase
    .from("room_objects")
    .insert(payload)
    .select("id,room_id,name,category,quantity,selected_material_id,po_approved,is_ordered,is_installed,sort_order")
    .single();
  let data = insertWithWorkflow.data as unknown as RoomObjectRow | null;
  let error = insertWithWorkflow.error;

  if (error && hasMissingWorkflowColumnsError(error.code, error.message)) {
    const fallbackPayload = {
      room_id: normalizedRoomId,
      name: normalizedName,
      category: normalizedCategory,
      quantity: normalizedQuantity,
      selected_material_id: null,
      sort_order: nextSortOrder,
    };
    const fallback = await supabase
      .from("room_objects")
      .insert(fallbackPayload)
      .select("id,room_id,name,category,quantity,selected_material_id,sort_order")
      .single();
    data = fallback.data as unknown as RoomObjectRow | null;
    error = fallback.error;
  }

  if (error && hasMissingQuantityColumnError(error.code, error.message)) {
    const legacyPayload = {
      room_id: normalizedRoomId,
      name: normalizedName,
      category: normalizedCategory,
      selected_material_id: null,
      sort_order: nextSortOrder,
    };
    const legacy = await supabase
      .from("room_objects")
      .insert(legacyPayload)
      .select("id,room_id,name,category,selected_material_id,sort_order")
      .single();
    data = legacy.data as unknown as RoomObjectRow | null;
    error = legacy.error;
  }

  if (error) {
    throw new Error(error.message);
  }

  const row = data as RoomObjectRow;
  return {
    id: row.id,
    roomId: row.room_id,
    name: row.name,
    category: row.category,
    quantity: Math.max(1, Math.round(row.quantity ?? normalizedQuantity)),
    budgetAllowance: normalizeBudgetAllowance(row.budget_allowance) ?? null,
    materialSearchQuery: row.material_search_query ?? undefined,
    selectedProductId: row.selected_material_id ?? undefined,
    poApproved: Boolean(row.po_approved),
    ordered: Boolean(row.is_ordered),
    installed: Boolean(row.is_installed),
    productOptions: [],
  };
}

export async function updateRoomObjectQuantityById(roomObjectId: string, quantity: number): Promise<void> {
  if (!isSupabaseConfigured) {
    throw new Error("Supabase is not configured.");
  }

  const normalizedObjectId = roomObjectId.trim();
  const normalizedQuantity = Math.max(1, Math.min(999, Math.round(quantity || 1)));
  if (!normalizedObjectId) {
    throw new Error("Room object ID is required.");
  }

  const { error } = await supabase
    .from("room_objects")
    .update({
      quantity: normalizedQuantity,
    })
    .eq("id", normalizedObjectId);

  if (error) {
    if (hasMissingQuantityColumnError(error.code, error.message)) {
      throw new Error("Room object quantity column is missing in DB. Apply latest migrations and retry.");
    }
    throw new Error(error.message);
  }
}

export async function updateRoomObjectBudgetAllowanceById(
  roomObjectId: string,
  budgetAllowance: number | null
): Promise<void> {
  if (!isSupabaseConfigured) {
    throw new Error("Supabase is not configured.");
  }

  const normalizedObjectId = roomObjectId.trim();
  if (!normalizedObjectId) {
    throw new Error("Room object ID is required.");
  }

  const normalizedAllowance = normalizeBudgetAllowance(budgetAllowance) ?? null;

  const { error } = await supabase
    .from("room_objects")
    .update({
      budget_allowance: normalizedAllowance,
    })
    .eq("id", normalizedObjectId);

  if (error) {
    if (hasMissingBudgetAllowanceColumnError(error.code, error.message)) {
      throw new Error("Room object budget column is missing in DB. Apply latest migrations and retry.");
    }
    throw new Error(error.message);
  }
}

export async function updateRoomObjectMaterialSearchQueryById(
  roomObjectId: string,
  materialSearchQuery: string
): Promise<void> {
  if (!isSupabaseConfigured) {
    throw new Error("Supabase is not configured.");
  }

  const normalizedObjectId = roomObjectId.trim();
  if (!normalizedObjectId) {
    throw new Error("Room object ID is required.");
  }

  const normalizedQuery = materialSearchQuery.trim();

  const { error } = await supabase
    .from("room_objects")
    .update({
      material_search_query: normalizedQuery || null,
    })
    .eq("id", normalizedObjectId);

  if (error) {
    if (hasMissingMaterialSearchQueryColumnError(error.code, error.message)) {
      throw new Error("Room object material search query column is missing in DB. Apply latest migrations and retry.");
    }
    throw new Error(error.message);
  }
}

export async function deleteRoomObjectById(roomObjectId: string): Promise<void> {
  if (!isSupabaseConfigured) {
    throw new Error("Supabase is not configured.");
  }

  const normalizedObjectId = roomObjectId.trim();
  if (!normalizedObjectId) {
    throw new Error("Room object ID is required.");
  }

  const { error } = await supabase.from("room_objects").delete().eq("id", normalizedObjectId);
  if (error) {
    throw new Error(error.message);
  }
}





interface ClientViewRow {
  id: string;
  project_id: string;
  title: string;
  status: string;
  published_version: number | null;
  published_at: string | null;
  expires_at: string | null;
  show_project_overview?: boolean | null;
  show_house_overviews?: boolean | null;
  project_overview?: ClientViewProjectOverview | null;
  house_overviews?: ClientViewHouseOverview[] | null;
}

interface ClientViewRecipientRow {
  id: string;
  client_view_id: string;
  email: string;
}

interface ClientViewItemRow {
  id: string;
  client_view_id: string;
  published_version: number;
  room_object_id: string | null;
  house_name: string;
  room_name: string;
  object_name: string;
  object_category: string;
  quantity: number | null;
  card_mode: string;
  prompt_text: string | null;
  show_source_link: boolean | null;
  budget_allowance: number | null;
  current_selected_material_name: string | null;
  current_selected_price: number | null;
  sort_order: number | null;
}

interface ClientViewItemOptionRow {
  id: string;
  item_id: string;
  source_material_id: string | null;
  name: string;
  supplier_name: string | null;
  image_url: string | null;
  price: number | null;
  description: string | null;
  source_url: string | null;
  sort_order: number | null;
}

interface ClientViewResponseRow {
  id: string;
  client_view_id: string;
  item_id: string;
  published_version: number;
  recipient_email: string;
  selected_option_id: string | null;
  preferred_budget: number | null;
  scope_decision: string | null;
  comment: string | null;
  applied_at: string | null;
  updated_at: string;
}

function normalizeClientViewStatus(value: string | null | undefined): ClientViewStatus {
  switch (value) {
    case "published":
    case "closed":
    case "revoked":
    case "expired":
    case "draft":
      return value;
    default:
      return "draft";
  }
}

function toClientViewSummary(row: ClientViewRow): ClientViewSummary {
  return {
    id: row.id,
    projectId: row.project_id,
    title: row.title,
    status: normalizeClientViewStatus(row.status),
    publishedVersion: Math.max(0, Math.round(row.published_version ?? 0)),
    publishedAt: row.published_at,
    expiresAt: row.expires_at,
    showProjectOverview: Boolean(row.show_project_overview),
    showHouseOverviews: Boolean(row.show_house_overviews),
    projectOverview: row.project_overview ?? null,
    houseOverviews: row.house_overviews ?? [],
  };
}

function toClientViewItemOption(row: ClientViewItemOptionRow): ClientViewItemOption {
  return {
    id: row.id,
    sourceMaterialId: row.source_material_id ?? undefined,
    name: row.name,
    supplierName: row.supplier_name ?? undefined,
    imageUrl: row.image_url ?? undefined,
    price: row.price ?? null,
    description: row.description ?? undefined,
    sourceUrl: row.source_url ?? undefined,
    sortOrder: Math.max(0, Math.round(row.sort_order ?? 0)),
  };
}

function normalizeClientViewCardMode(value: string): ClientViewItem["cardMode"] {
  if (value === "budget_input" || value === "scope_confirmation") {
    return value;
  }
  return "material_choice";
}

function toClientViewItem(row: ClientViewItemRow, options: ClientViewItemOption[]): ClientViewItem {
  return {
    id: row.id,
    roomObjectId: row.room_object_id ?? undefined,
    houseName: row.house_name,
    roomName: row.room_name,
    objectName: row.object_name,
    objectCategory: row.object_category,
    quantity: Math.max(1, Math.round(row.quantity ?? 1)),
    cardMode: normalizeClientViewCardMode(row.card_mode),
    promptText: row.prompt_text ?? undefined,
    showSourceLink: Boolean(row.show_source_link),
    budgetAllowance: normalizeBudgetAllowance(row.budget_allowance) ?? null,
    currentSelectedMaterialName: row.current_selected_material_name ?? undefined,
    currentSelectedPrice: row.current_selected_price ?? null,
    options,
  };
}

async function loadClientViewRowsByProjectId(projectId: string): Promise<ClientViewDetail | null> {
  const normalizedProjectId = projectId.trim();
  if (!normalizedProjectId) {
    throw new Error("Project ID is required.");
  }

  const { data: clientViewRows, error: clientViewError } = await supabase
    .from("client_views")
    .select("id,project_id,title,status,published_version,published_at,expires_at,show_project_overview,show_house_overviews,project_overview,house_overviews")
    .eq("project_id", normalizedProjectId)
    .order("updated_at", { ascending: false })
    .limit(1);

  if (clientViewError) {
    throw new Error(clientViewError.message);
  }

  const clientViewRow = ((clientViewRows ?? []) as unknown as ClientViewRow[])[0];
  if (!clientViewRow) {
    return null;
  }

  const summary = toClientViewSummary(clientViewRow);

  const [recipientsResult, itemsResult] = await Promise.all([
    supabase
      .from("client_view_recipients")
      .select("id,client_view_id,email")
      .eq("client_view_id", clientViewRow.id)
      .order("email", { ascending: true }),
    supabase
      .from("client_view_items")
      .select(
        "id,client_view_id,published_version,room_object_id,house_name,room_name,object_name,object_category,quantity,card_mode,prompt_text,show_source_link,budget_allowance,current_selected_material_name,current_selected_price,sort_order"
      )
      .eq("client_view_id", clientViewRow.id)
      .eq("published_version", summary.publishedVersion)
      .order("sort_order", { ascending: true }),
  ]);

  if (recipientsResult.error) {
    throw new Error(recipientsResult.error.message);
  }
  if (itemsResult.error) {
    throw new Error(itemsResult.error.message);
  }

  const itemRows = (itemsResult.data ?? []) as unknown as ClientViewItemRow[];
  const itemIds = itemRows.map((item) => item.id);
  let optionRows: ClientViewItemOptionRow[] = [];
  if (itemIds.length > 0) {
    const { data, error } = await supabase
      .from("client_view_item_options")
      .select("id,item_id,source_material_id,name,supplier_name,image_url,price,description,source_url,sort_order")
      .in("item_id", itemIds)
      .order("sort_order", { ascending: true });
    if (error) {
      throw new Error(error.message);
    }
    optionRows = (data ?? []) as unknown as ClientViewItemOptionRow[];
  }

  const optionsByItemId = new Map<string, ClientViewItemOption[]>();
  optionRows.forEach((row) => {
    const current = optionsByItemId.get(row.item_id) ?? [];
    current.push(toClientViewItemOption(row));
    optionsByItemId.set(row.item_id, current);
  });

  return {
    ...summary,
    recipients: ((recipientsResult.data ?? []) as unknown as ClientViewRecipientRow[]).map((recipient) => ({
      id: recipient.id,
      email: recipient.email,
    })),
    items: itemRows.map((row) => toClientViewItem(row, optionsByItemId.get(row.id) ?? [])),
  };
}

export async function loadLatestClientViewByProjectId(projectId: string): Promise<ClientViewDetail | null> {
  if (!isSupabaseConfigured) {
    return null;
  }

  return loadClientViewRowsByProjectId(projectId);
}

export async function publishClientView(
  projectId: string,
  input: ClientViewPublishInput
): Promise<{ detail: ClientViewDetail; token: string }> {
  if (!isSupabaseConfigured) {
    throw new Error("Supabase is not configured.");
  }

  const normalizedProjectId = projectId.trim();
  if (!normalizedProjectId) {
    throw new Error("Project ID is required.");
  }

  const normalizedTitle = input.title.trim();
  const normalizedRecipientEmails = Array.from(
    new Set(
      input.recipientEmails
        .map((email) => email.trim().toLowerCase())
        .filter(Boolean)
    )
  );
  const normalizedItems = input.items
    .filter((item) => item.roomObjectId.trim())
    .map((item) => ({
      roomObjectId: item.roomObjectId.trim(),
      cardMode: item.cardMode,
      promptText: item.promptText?.trim() || null,
      showSourceLink: Boolean(item.showSourceLink),
      options: (item.optionMaterialIds ?? [])
        .map((materialId) => materialId.trim())
        .filter(Boolean)
        .slice(0, 3)
        .map((materialId) => ({ materialId })),
    }));

  const { data, error } = await supabase.rpc("publish_client_view", {
    p_project_id: normalizedProjectId,
    p_title: normalizedTitle || null,
    p_expires_at: input.expiresAt?.trim() || null,
    p_recipient_emails: normalizedRecipientEmails,
    p_items: normalizedItems,
    p_show_project_overview: Boolean(input.showProjectOverview),
    p_show_house_overviews: Boolean(input.showHouseOverviews),
  });

  if (error) {
    throw new Error(error.message);
  }

  const detail = await loadClientViewRowsByProjectId(normalizedProjectId);
  if (!detail) {
    throw new Error("Client view was published but could not be reloaded.");
  }

  return {
    detail,
    token: String((data as { token?: string } | null)?.token ?? ""),
  };
}

export async function updateClientViewStatusById(clientViewId: string, status: ClientViewStatus): Promise<void> {
  if (!isSupabaseConfigured) {
    throw new Error("Supabase is not configured.");
  }

  const normalizedClientViewId = clientViewId.trim();
  if (!normalizedClientViewId) {
    throw new Error("Client view ID is required.");
  }

  const { error } = await supabase
    .from("client_views")
    .update({ status })
    .eq("id", normalizedClientViewId);

  if (error) {
    throw new Error(error.message);
  }
}

export async function listClientViewResponses(clientViewId: string): Promise<ClientViewResponse[]> {
  if (!isSupabaseConfigured) {
    return [];
  }

  const normalizedClientViewId = clientViewId.trim();
  if (!normalizedClientViewId) {
    throw new Error("Client view ID is required.");
  }

  const { data: clientViewRows, error: clientViewError } = await supabase
    .from("client_views")
    .select("id,project_id,title,status,published_version,published_at,expires_at,show_project_overview,show_house_overviews,project_overview,house_overviews")
    .eq("id", normalizedClientViewId)
    .limit(1);

  if (clientViewError) {
    throw new Error(clientViewError.message);
  }

  const clientViewRow = ((clientViewRows ?? []) as unknown as ClientViewRow[])[0];
  if (!clientViewRow) {
    return [];
  }

  const publishedVersion = Math.max(0, Math.round(clientViewRow.published_version ?? 0));

  const [responsesResult, itemsResult] = await Promise.all([
    supabase
      .from("client_view_responses")
      .select("id,client_view_id,item_id,published_version,recipient_email,selected_option_id,preferred_budget,scope_decision,comment,applied_at,updated_at")
      .eq("client_view_id", normalizedClientViewId)
      .eq("published_version", publishedVersion)
      .order("updated_at", { ascending: false }),
    supabase
      .from("client_view_items")
      .select("id,object_name,room_name,published_version")
      .eq("client_view_id", normalizedClientViewId)
      .eq("published_version", publishedVersion),
  ]);

  if (responsesResult.error) {
    throw new Error(responsesResult.error.message);
  }
  if (itemsResult.error) {
    throw new Error(itemsResult.error.message);
  }

  const responses = (responsesResult.data ?? []) as unknown as ClientViewResponseRow[];
  const items = (itemsResult.data ?? []) as Array<{ id: string; object_name: string; room_name: string; published_version: number }>;
  const itemIds = items.map((item) => item.id);

  let options: ClientViewItemOptionRow[] = [];
  if (itemIds.length > 0) {
    const { data, error } = await supabase
      .from("client_view_item_options")
      .select("id,item_id,source_material_id,name,supplier_name,image_url,price,description,source_url,sort_order")
      .in("item_id", itemIds);
    if (error) {
      throw new Error(error.message);
    }
    options = (data ?? []) as unknown as ClientViewItemOptionRow[];
  }

  const itemLabelById = new Map(items.map((item) => [item.id, `${item.object_name} - ${item.room_name}`]));
  const optionNameById = new Map(options.map((option) => [option.id, option.name]));

  return responses.map((response) => ({
    id: response.id,
    itemId: response.item_id,
    publishedVersion: response.published_version,
    recipientEmail: response.recipient_email,
    selectedOptionId: response.selected_option_id,
    preferredBudget: response.preferred_budget,
    scopeDecision:
      response.scope_decision === "approved" ||
      response.scope_decision === "not_needed" ||
      response.scope_decision === "needs_revision"
        ? response.scope_decision
        : null,
    comment: response.comment ?? undefined,
    appliedAt: response.applied_at,
    updatedAt: response.updated_at,
    itemLabel: itemLabelById.get(response.item_id),
    selectedOptionName: response.selected_option_id ? optionNameById.get(response.selected_option_id) : undefined,
  }));
}

export async function applyClientViewResponseById(projectId: string, responseId: string): Promise<ClientViewApplyResult> {
  if (!isSupabaseConfigured) {
    throw new Error("Supabase is not configured.");
  }

  const normalizedProjectId = projectId.trim();
  const normalizedResponseId = responseId.trim();
  if (!normalizedProjectId || !normalizedResponseId) {
    throw new Error("Project ID and response ID are required.");
  }

  const { data, error } = await supabase.rpc("apply_client_view_response", {
    p_project_id: normalizedProjectId,
    p_response_id: normalizedResponseId,
  });

  if (error) {
    throw new Error(error.message);
  }

  const payload = (data ?? {}) as { responseId?: string; itemId?: string; action?: string; appliedAt?: string };
  return {
    responseId: String(payload.responseId ?? normalizedResponseId),
    itemId: String(payload.itemId ?? ""),
    action: String(payload.action ?? "none"),
    appliedAt: String(payload.appliedAt ?? new Date().toISOString()),
  };
}

