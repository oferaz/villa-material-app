import { describe, expect, it } from "vitest";
import { calculateProjectBudget, createMockProjectBudget } from "@/lib/mock/budget";
import type { Project } from "@/types";

function createProject(quantity = 1, selected = true): Project {
  return {
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
            objects: [
              {
                id: "object-1",
                roomId: "room-1",
                name: "Sofa",
                category: "Furniture",
                quantity,
                selectedProductId: selected ? "product-1" : undefined,
                productOptions: [
                  {
                    id: "product-1",
                    name: "Oak Sofa",
                    supplier: "Urban Foundry",
                    price: 12000,
                    leadTimeDays: 7,
                    budgetCategory: "Furniture",
                    sourceType: "catalog",
                  },
                ],
              },
            ],
          },
        ],
      },
    ],
  };
}

describe("calculateProjectBudget", () => {
  it("updates totals when a selected product quantity changes", () => {
    const project = createProject(2, true);
    const budget = calculateProjectBudget(createMockProjectBudget(project), project);

    expect(budget.allocatedAmount).toBe(24000);
    expect(budget.rooms[0]?.allocatedAmount).toBe(24000);
  });

  it("drops totals back to zero when the product is removed", () => {
    const project = createProject(1, false);
    const budget = calculateProjectBudget(createMockProjectBudget(project), project);

    expect(budget.allocatedAmount).toBe(0);
    expect(budget.rooms[0]?.allocatedAmount).toBe(0);
  });
});
