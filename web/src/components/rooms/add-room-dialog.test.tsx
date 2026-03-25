import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { AddRoomDialog } from "./add-room-dialog";

describe("AddRoomDialog", () => {
  it("applies the starter template option by default", async () => {
    const user = userEvent.setup();
    const onCreateRoom = vi.fn();

    render(
      <AddRoomDialog
        open
        houseName="North Villa"
        onOpenChange={() => {}}
        onCreateRoom={onCreateRoom}
      />
    );

    expect(screen.getByText("Starter preview")).toBeTruthy();
    expect(screen.getByText("Sofa")).toBeTruthy();

    await user.click(screen.getByRole("button", { name: /create room/i }));

    expect(onCreateRoom).toHaveBeenCalledWith(
      expect.objectContaining({
        roomName: "Living Room",
        roomType: "living_room",
        useStarterTemplate: true,
      })
    );
  });

  it("keeps the blank option available", async () => {
    const user = userEvent.setup();
    const onCreateRoom = vi.fn();

    render(
      <AddRoomDialog
        open
        houseName="North Villa"
        onOpenChange={() => {}}
        onCreateRoom={onCreateRoom}
      />
    );

    await user.click(screen.getByRole("button", { name: /start blank/i }));
    await user.clear(screen.getByPlaceholderText("Enter room name"));
    await user.type(screen.getByPlaceholderText("Enter room name"), "Guest Bedroom");
    await user.click(screen.getByRole("button", { name: /create room/i }));

    expect(onCreateRoom).toHaveBeenCalledWith(
      expect.objectContaining({
        roomName: "Guest Bedroom",
        roomType: "living_room",
        useStarterTemplate: false,
      })
    );
  });
});
