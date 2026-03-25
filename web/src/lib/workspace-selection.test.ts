import { beforeEach, describe, expect, it } from "vitest";
import { loadWorkspaceSelection, resolveWorkspaceSelection, saveWorkspaceSelection } from "@/lib/workspace-selection";
import type { Project } from "@/types";

const project: Project = {
  id: "project-1",
  name: "Palm Heights",
  customer: "Client",
  location: "Bangkok",
  currency: "THB",
  houses: [
    {
      id: "house-1",
      projectId: "project-1",
      name: "North Villa",
      rooms: [
        {
          id: "room-1",
          houseId: "house-1",
          name: "Living Room",
          type: "living_room",
          objects: [{ id: "object-1", roomId: "room-1", name: "Sofa", category: "Furniture", quantity: 1, productOptions: [] }],
        },
      ],
    },
  ],
};

describe("workspace-selection", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("persists and reloads the selected room state", () => {
    saveWorkspaceSelection("project-1", { houseId: "house-1", roomId: "room-1", objectId: "object-1" });

    expect(loadWorkspaceSelection("project-1")).toEqual({
      houseId: "house-1",
      roomId: "room-1",
      objectId: "object-1",
    });
  });

  it("falls back cleanly when saved selection is stale", () => {
    const resolved = resolveWorkspaceSelection(project, {
      houseId: "missing-house",
      roomId: "missing-room",
      objectId: "missing-object",
    });

    expect(resolved).toEqual({
      houseId: "house-1",
      roomId: "room-1",
      objectId: "object-1",
    });
  });
});
