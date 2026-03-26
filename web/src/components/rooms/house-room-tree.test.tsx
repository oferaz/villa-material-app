import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { HouseRoomTree } from "./house-room-tree";
import type { House } from "@/types";

const houses: House[] = [
  {
    id: "house-1",
    projectId: "project-1",
    name: "North Villa",
    rooms: [
      { id: "room-1", houseId: "house-1", name: "Living Room", type: "living_room", objects: [] },
      { id: "room-2", houseId: "house-1", name: "Kitchen", type: "kitchen", objects: [] },
    ],
  },
];

describe("HouseRoomTree", () => {
  it("shows the selected room clearly and calls room selection", async () => {
    const user = userEvent.setup();
    const onSelectRoom = vi.fn();

    render(
      <HouseRoomTree
        houses={houses}
        selectedHouseId="house-1"
        selectedRoomId="room-1"
        onSelectRoom={onSelectRoom}
        onRenameHouse={() => {}}
        onRenameRoom={() => {}}
        onAddHouse={() => {}}
        onDuplicateHouse={() => {}}
        onRequestAddRoom={() => {}}
        onReorderRoom={() => {}}
      />
    );

    expect(screen.getByText("Selected")).toBeTruthy();

    await user.click(screen.getByRole("button", { name: "Kitchen" }));

    expect(onSelectRoom).toHaveBeenCalledWith("house-1", "room-2");
  });

  it("reorders rooms through drag and drop without showing arrow controls", () => {
    const onReorderRoom = vi.fn();

    render(
      <HouseRoomTree
        houses={houses}
        selectedHouseId="house-1"
        selectedRoomId="room-1"
        onSelectRoom={() => {}}
        onRenameHouse={() => {}}
        onRenameRoom={() => {}}
        onAddHouse={() => {}}
        onDuplicateHouse={() => {}}
        onRequestAddRoom={() => {}}
        onReorderRoom={onReorderRoom}
      />
    );

    const livingRoomItem = document.querySelector('[data-room-id="room-1"]');
    const kitchenItem = document.querySelector('[data-room-id="room-2"]');

    expect(livingRoomItem).toBeTruthy();
    expect(kitchenItem).toBeTruthy();
    expect(screen.queryByLabelText(/move living room/i)).toBeNull();
    expect(screen.queryByLabelText(/move kitchen/i)).toBeNull();

    fireEvent.dragStart(livingRoomItem!);
    fireEvent.dragOver(kitchenItem!);
    fireEvent.drop(kitchenItem!);
    fireEvent.dragEnd(livingRoomItem!);

    expect(onReorderRoom).toHaveBeenCalledWith("house-1", ["room-2", "room-1"]);
    expect(screen.queryByText(/drag to reorder/i)).toBeNull();
  });
});
