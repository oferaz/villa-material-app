import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { RoomObjectsList } from "./room-objects-list";
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

describe("RoomObjectsList", () => {
  it("renders the guided empty state for an empty room", () => {
    render(
      <RoomObjectsList
        room={createRoom()}
        selectedObjectId=""
        showWorkflowHints
        projectCurrency="THB"
        onSelectObject={() => {}}
        onDeleteObject={() => {}}
        onMoveObject={() => {}}
        onOpenAddCustomObject={() => {}}
        onUpdateBudgetAllowance={() => {}}
        onUpdateWorkflow={() => {}}
      />
    );

    expect(screen.getByText("This room is ready for its first item.")).toBeTruthy();
    expect(screen.getByText("Start by searching for products")).toBeTruthy();
    expect(screen.getByRole("button", { name: /add first item/i })).toBeTruthy();
  });

  it("shows supplier and price details for a selected product and exposes move controls", async () => {
    const user = userEvent.setup();
    const onMoveObject = vi.fn();
    const room = createRoom({
      objects: [
        {
          id: "object-1",
          roomId: "room-1",
          name: "Dining Table",
          category: "Furniture",
          quantity: 2,
          selectedProductId: "product-1",
          productOptions: [
            {
              id: "product-1",
              name: "Oak Table",
              supplier: "Urban Foundry",
              price: 8800,
              leadTimeDays: 7,
              budgetCategory: "Furniture",
              description: "Solid oak dining table",
              sourceType: "catalog",
              sourceUrl: "https://example.com/table",
            },
          ],
        },
        {
          id: "object-2",
          roomId: "room-1",
          name: "Accent Chair",
          category: "Furniture",
          quantity: 1,
          productOptions: [],
        },
      ],
    });

    render(
      <RoomObjectsList
        room={room}
        selectedObjectId="object-1"
        showWorkflowHints
        projectCurrency="THB"
        onSelectObject={() => {}}
        onDeleteObject={() => {}}
        onMoveObject={onMoveObject}
        onOpenAddCustomObject={() => {}}
        onUpdateBudgetAllowance={() => {}}
        onUpdateWorkflow={() => {}}
      />
    );

    expect(screen.getByText(/Supplier:/)).toBeTruthy();
    expect(screen.getByText(/Urban Foundry/)).toBeTruthy();
    expect(screen.getAllByText(/17,600/).length).toBeGreaterThan(0);
    expect(screen.getByText(/Solid oak dining table/)).toBeTruthy();

    await user.click(screen.getByRole("button", { name: /move dining table down/i }));

    expect(onMoveObject).toHaveBeenCalledWith("object-1", "down");
  });
});

