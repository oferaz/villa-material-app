import { describe, expect, it } from "vitest";
import type { ProductOption, RoomObject } from "@/types";
import { applyLinkProductOption, mergeObjectOptionsAfterSearch } from "./product-options-state";

function createOption(id: string, overrides: Partial<ProductOption> = {}): ProductOption {
  return {
    id,
    name: `Option ${id}`,
    supplier: "Supplier",
    price: 5000,
    leadTimeDays: 7,
    budgetCategory: "Furniture",
    sourceType: "catalog",
    ...overrides,
  };
}

function createObject(overrides: Partial<RoomObject> = {}): RoomObject {
  return {
    id: "object-1",
    roomId: "room-1",
    name: "Dining table",
    category: "Furniture",
    quantity: 1,
    productOptions: [],
    ...overrides,
  };
}

describe("product option state helpers", () => {
  it("preserves the current selection when fresh search results do not include it", () => {
    const selected = createOption("selected-1");
    const roomObject = createObject({
      selectedProductId: selected.id,
      productOptions: [selected, createOption("older-2")],
    });

    const nextOptions = mergeObjectOptionsAfterSearch(roomObject, [createOption("search-1"), createOption("search-2")]);

    expect(nextOptions[0]?.id).toBe(selected.id);
    expect(nextOptions.map((option) => option.id)).toEqual(["selected-1", "search-1", "search-2"]);
  });

  it("keeps imported link options alongside mock catalog search results when requested", () => {
    const linkOption = createOption("link-1", { sourceType: "link" });
    const roomObject = createObject({ productOptions: [linkOption] });

    const nextOptions = mergeObjectOptionsAfterSearch(roomObject, [createOption("search-1")], { preserveLinkOptions: true });

    expect(nextOptions.map((option) => option.id)).toEqual(["link-1", "search-1"]);
  });

  it("selects the imported link option immediately so price totals can update", () => {
    const existing = createOption("catalog-1");
    const linkOption = createOption("link-1", { sourceType: "link", price: 9900 });
    const roomObject = createObject({ productOptions: [existing] });

    const nextState = applyLinkProductOption(roomObject, linkOption);

    expect(nextState.selectedProductId).toBe(linkOption.id);
    expect(nextState.productOptions[0]?.id).toBe(linkOption.id);
    expect(nextState.productOptions).toHaveLength(2);
  });
});
