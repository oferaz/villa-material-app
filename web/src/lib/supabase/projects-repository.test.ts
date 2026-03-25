import { beforeEach, describe, expect, it, vi } from "vitest";

const updates: Array<{ table: string; values: Record<string, unknown>; filters: Record<string, unknown> }> = [];

function createUpdateBuilder(table: string, values: Record<string, unknown>) {
  const filters: Record<string, unknown> = {};
  return {
    eq(column: string, value: unknown) {
      filters[column] = value;
      if (Object.keys(filters).length >= 2) {
        updates.push({ table, values, filters: { ...filters } });
        return Promise.resolve({ error: null });
      }
      return this;
    },
  };
}

vi.mock("@/lib/supabase/client", () => ({
  isSupabaseConfigured: true,
  supabase: {
    from(table: string) {
      return {
        update(values: Record<string, unknown>) {
          return createUpdateBuilder(table, values);
        },
      };
    },
  },
}));

describe("projects-repository reorder persistence", () => {
  beforeEach(() => {
    updates.length = 0;
  });

  it("persists room order deterministically", async () => {
    const { reorderRoomsInHouse } = await import("./projects-repository");

    await reorderRoomsInHouse("house-1", ["room-3", "room-1", "room-2"]);

    expect(updates).toEqual([
      { table: "rooms", values: { sort_order: 0 }, filters: { id: "room-3", house_id: "house-1" } },
      { table: "rooms", values: { sort_order: 1 }, filters: { id: "room-1", house_id: "house-1" } },
      { table: "rooms", values: { sort_order: 2 }, filters: { id: "room-2", house_id: "house-1" } },
    ]);
  });

  it("persists room object order deterministically", async () => {
    const { reorderRoomObjectsInRoom } = await import("./projects-repository");

    await reorderRoomObjectsInRoom("room-1", ["object-2", "object-1"]);

    expect(updates).toEqual([
      { table: "room_objects", values: { sort_order: 0 }, filters: { id: "object-2", room_id: "room-1" } },
      { table: "room_objects", values: { sort_order: 1 }, filters: { id: "object-1", room_id: "room-1" } },
    ]);
  });
});
