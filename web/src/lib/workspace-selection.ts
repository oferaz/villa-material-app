import { Project } from "@/types";

export interface WorkspaceSelection {
  houseId: string;
  roomId: string;
  objectId: string;
}

const STORAGE_KEY = "materia:workspace-selection:v1";

type WorkspaceSelectionMap = Record<string, WorkspaceSelection>;

function readSelectionMap(): WorkspaceSelectionMap {
  if (typeof window === "undefined") {
    return {};
  }

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return {};
    }
    const parsed = JSON.parse(raw) as WorkspaceSelectionMap;
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function writeSelectionMap(selectionMap: WorkspaceSelectionMap) {
  if (typeof window === "undefined") {
    return;
  }
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(selectionMap));
}

export function loadWorkspaceSelection(projectId: string): WorkspaceSelection | null {
  const normalizedProjectId = projectId.trim();
  if (!normalizedProjectId) {
    return null;
  }

  const selection = readSelectionMap()[normalizedProjectId];
  if (!selection) {
    return null;
  }

  return {
    houseId: String(selection.houseId ?? ""),
    roomId: String(selection.roomId ?? ""),
    objectId: String(selection.objectId ?? ""),
  };
}

export function saveWorkspaceSelection(projectId: string, selection: WorkspaceSelection) {
  const normalizedProjectId = projectId.trim();
  if (!normalizedProjectId) {
    return;
  }

  const selectionMap = readSelectionMap();
  selectionMap[normalizedProjectId] = {
    houseId: selection.houseId,
    roomId: selection.roomId,
    objectId: selection.objectId,
  };
  writeSelectionMap(selectionMap);
}

export function resolveWorkspaceSelection(
  project: Project,
  selection: WorkspaceSelection | null
): WorkspaceSelection | null {
  if (!project.houses.length) {
    return null;
  }

  const fallbackHouse = project.houses[0];
  const matchedHouse = project.houses.find((house) => house.id === selection?.houseId) ?? fallbackHouse;
  const matchedRoom = matchedHouse.rooms.find((room) => room.id === selection?.roomId) ?? matchedHouse.rooms[0];
  const matchedObject =
    matchedRoom?.objects.find((objectItem) => objectItem.id === selection?.objectId) ?? matchedRoom?.objects[0];

  return {
    houseId: matchedHouse.id,
    roomId: matchedRoom?.id ?? "",
    objectId: matchedObject?.id ?? "",
  };
}
