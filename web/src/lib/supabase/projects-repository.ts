import { searchMockCatalogOptions } from "@/lib/mock/material-search";
import { mockProjects } from "@/lib/mock/projects";
import { resolveBudgetCategory } from "@/lib/mock/budget";
import { isSupabaseConfigured, supabase } from "@/lib/supabase/client";
import { BudgetCategoryName, House, ProductOption, Project, Room, RoomObject, RoomType } from "@/types";

interface ProjectRow {
  id: string;
  name: string;
  client_name: string | null;
  location: string | null;
}

interface HouseRow {
  id: string;
  project_id: string;
  name: string;
  sort_order: number | null;
}

interface RoomRow {
  id: string;
  house_id: string;
  name: string;
  room_type: string;
  sort_order: number | null;
}

interface RoomObjectRow {
  id: string;
  room_id: string;
  name: string;
  category: string;
  selected_material_id: string | null;
  sort_order: number | null;
}

interface MaterialRow {
  id: string;
  name: string;
  supplier_name: string | null;
  price: number | null;
  lead_time_days: number | null;
  budget_category: string;
  sku: string | null;
  source_type: string;
  source_url: string | null;
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

const budgetCategorySet = new Set<BudgetCategoryName>([
  "Furniture",
  "Lighting",
  "Tiles",
  "Bathroom",
  "Kitchen",
  "Decor",
]);

function cloneMockProjects(): Project[] {
  return structuredClone(mockProjects);
}

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

function toProductOptionFromMaterial(material: MaterialRow, objectName: string, objectCategory: string): ProductOption {
  return {
    id: material.id,
    name: material.name,
    supplier: material.supplier_name ?? "Private Material",
    price: Math.max(0, Math.round(material.price ?? 0)),
    leadTimeDays: Math.max(0, Math.round(material.lead_time_days ?? 0)),
    budgetCategory: normalizeBudgetCategory(material.budget_category, objectName, objectCategory),
    sku: material.sku ?? undefined,
    sourceType: material.source_type === "link" ? "link" : "catalog",
    sourceUrl: material.source_url ?? undefined,
  };
}

export async function loadProjectsForWorkspace(): Promise<Project[]> {
  if (!isSupabaseConfigured) {
    return cloneMockProjects();
  }

  try {
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session) {
      return [];
    }

    const { data: projectRows, error: projectError } = await supabase
      .from("projects")
      .select("id,name,client_name,location")
      .order("created_at", { ascending: true });

    if (projectError) {
      throw projectError;
    }

    if (!projectRows || projectRows.length === 0) {
      return [];
    }

    const projects = projectRows as ProjectRow[];
    const projectIds = projects.map((project) => project.id);

    const { data: houseRows, error: houseError } = await supabase
      .from("houses")
      .select("id,project_id,name,sort_order")
      .in("project_id", projectIds)
      .order("sort_order", { ascending: true });

    if (houseError) {
      throw houseError;
    }

    const houses = (houseRows ?? []) as HouseRow[];

    const houseIds = houses.map((house) => house.id);
    const roomsQuery = supabase
      .from("rooms")
      .select("id,house_id,name,room_type,sort_order")
      .order("sort_order", { ascending: true });
    const { data: roomRows, error: roomError } =
      houseIds.length > 0 ? await roomsQuery.in("house_id", houseIds) : await roomsQuery.limit(0);

    if (roomError) {
      throw roomError;
    }

    const rooms = (roomRows ?? []) as RoomRow[];

    const roomIds = rooms.map((room) => room.id);
    const roomObjectsQuery = supabase
      .from("room_objects")
      .select("id,room_id,name,category,selected_material_id,sort_order")
      .order("sort_order", { ascending: true });
    const { data: roomObjectRows, error: roomObjectError } =
      roomIds.length > 0 ? await roomObjectsQuery.in("room_id", roomIds) : await roomObjectsQuery.limit(0);

    if (roomObjectError) {
      throw roomObjectError;
    }

    const roomObjects = (roomObjectRows ?? []) as RoomObjectRow[];
    const selectedMaterialIds = roomObjects
      .map((objectItem) => objectItem.selected_material_id)
      .filter((item): item is string => Boolean(item));

    const uniqueSelectedMaterialIds = Array.from(new Set(selectedMaterialIds));
    let selectedMaterials: MaterialRow[] = [];

    if (uniqueSelectedMaterialIds.length > 0) {
      const { data: materialRows, error: materialError } = await supabase
        .from("materials")
        .select("id,name,supplier_name,price,lead_time_days,budget_category,sku,source_type,source_url")
        .in("id", uniqueSelectedMaterialIds);

      if (materialError) {
        throw materialError;
      }

      selectedMaterials = (materialRows ?? []) as MaterialRow[];
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
                  const catalogOptions = searchMockCatalogOptions(roomObject.name, roomObject.name);
                  const selectedMaterial = roomObject.selected_material_id
                    ? selectedMaterialMap.get(roomObject.selected_material_id)
                    : undefined;
                  const selectedOption = selectedMaterial
                    ? toProductOptionFromMaterial(selectedMaterial, roomObject.name, roomObject.category)
                    : undefined;

                  const options = selectedOption
                    ? [selectedOption, ...catalogOptions.filter((option) => option.id !== selectedOption.id)]
                    : catalogOptions;

                  return {
                    id: roomObject.id,
                    roomId: roomObject.room_id,
                    name: roomObject.name,
                    category: roomObject.category,
                    selectedProductId: selectedOption?.id,
                    productOptions: options,
                  };
                });

              return {
                id: room.id,
                houseId: room.house_id,
                name: room.name,
                type: normalizeRoomType(room.room_type),
                objects: mappedRoomObjects,
              };
            });

          return {
            id: house.id,
            projectId: house.project_id,
            name: house.name,
            rooms: mappedRooms,
          };
        });

      return {
        id: project.id,
        name: project.name,
        customer: project.client_name ?? "Unknown client",
        location: project.location ?? "Unknown location",
        houses: mappedHouses,
      };
    });

    return mappedProjects;
  } catch (error) {
    console.warn("Failed to load projects from Supabase.", error);
    return [];
  }
}
