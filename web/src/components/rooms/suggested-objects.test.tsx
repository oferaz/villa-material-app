import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { SuggestedObjects } from "./suggested-objects";
import type { Room } from "@/types";

function createRoom(overrides: Partial<Room> = {}): Room {
  return {
    id: "room-1",
    houseId: "house-1",
    name: "Living Room",
    type: "living_room",
    objects: [],
    ...overrides,
  };
}

describe("SuggestedObjects", () => {
  it("starts expanded for a new empty room", () => {
    render(
      <SuggestedObjects
        room={createRoom()}
        onAddSuggestion={() => {}}
        onDecreaseSuggestion={() => {}}
        onOpenAddCustomObject={() => {}}
      />
    );

    expect(screen.getByText("Recommended for new room")).toBeTruthy();
    expect(screen.getByText("Starter ideas are ready for this new room.")).toBeTruthy();
    expect(screen.getByRole("button", { name: /collapse suggested objects/i })).toBeTruthy();
    expect(screen.getByText("Add custom object")).toBeTruthy();
  });

  it("stays visible but collapsed for rooms that already have objects and can be expanded", async () => {
    const user = userEvent.setup();

    render(
      <SuggestedObjects
        room={createRoom({
          objects: [
            {
              id: "object-1",
              roomId: "room-1",
              name: "Sofa",
              category: "Furniture",
              quantity: 1,
              productOptions: [],
            },
          ],
        })}
        onAddSuggestion={() => {}}
        onDecreaseSuggestion={() => {}}
        onOpenAddCustomObject={() => {}}
      />
    );

    expect(screen.getByText(/starter objects already used/i)).toBeTruthy();
    expect(screen.queryByText("Add custom object")).toBeNull();

    await user.click(screen.getByRole("button", { name: /expand suggested objects/i }));

    expect(screen.getByText("Add custom object")).toBeTruthy();
    expect(screen.getByRole("button", { name: /collapse suggested objects/i })).toBeTruthy();
  });
});
