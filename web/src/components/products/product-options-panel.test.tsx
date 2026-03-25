import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { ProductOptionsPanel } from "./product-options-panel";
import type { ProductOption, RoomObject } from "@/types";

function createRoomObject(overrides: Partial<RoomObject> = {}): RoomObject {
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

function createOption(overrides: Partial<ProductOption> = {}): ProductOption {
  return {
    id: "option-1",
    name: "Walnut dining table",
    supplier: "Lazada",
    price: 9900,
    leadTimeDays: 5,
    budgetCategory: "Furniture",
    sourceType: "link",
    ...overrides,
  };
}

describe("ProductOptionsPanel", () => {
  it("shows both search and paste-link paths before an object is selected", () => {
    render(
      <ProductOptionsPanel
        roomObject={undefined}
        projectCurrency="THB"
        materialLibraryVersion={1}
        onSelectProduct={() => {}}
        onApplyReusableProduct={() => {}}
        onSearchCatalog={() => {}}
        onAddFromLink={() => {}}
      />
    );

    expect(screen.getByText("Search products or paste a link")).toBeTruthy();
    expect(screen.getByText("Paste product link")).toBeTruthy();
    expect(screen.getByPlaceholderText("Select an object to search your library")).toBeTruthy();
    expect(screen.getByPlaceholderText("Select an object to paste a product link")).toBeTruthy();
  });

  it("renders both entry options and the guided empty state for a room object with no products", async () => {
    const onSearchCatalog = vi.fn();

    render(
      <ProductOptionsPanel
        roomObject={createRoomObject()}
        projectCurrency="THB"
        materialLibraryVersion={1}
        onSelectProduct={() => {}}
        onApplyReusableProduct={() => {}}
        onSearchCatalog={onSearchCatalog}
        onAddFromLink={() => {}}
      />
    );

    await waitFor(() => expect(onSearchCatalog).toHaveBeenCalledWith("object-1", "Dining table"));

    expect(screen.getByRole("button", { name: /search library/i })).toBeTruthy();
    expect(screen.getByRole("button", { name: /^add from link$/i })).toBeTruthy();
    expect(screen.getByText("Search is the main path. Paste a link as a fast secondary option when you already know the product.")).toBeTruthy();
  });

  it("keeps the search flow working", async () => {
    const user = userEvent.setup();
    const onSearchCatalog = vi.fn();

    render(
      <ProductOptionsPanel
        roomObject={createRoomObject()}
        projectCurrency="THB"
        materialLibraryVersion={1}
        onSelectProduct={() => {}}
        onApplyReusableProduct={() => {}}
        onSearchCatalog={onSearchCatalog}
        onAddFromLink={() => {}}
      />
    );

    const searchInput = await screen.findByDisplayValue("Dining table");
    onSearchCatalog.mockClear();

    await user.clear(searchInput);
    await user.type(searchInput, "walnut table");
    await user.click(screen.getByRole("button", { name: /search library/i }));

    await waitFor(() => expect(onSearchCatalog).toHaveBeenLastCalledWith("object-1", "walnut table"));
  });

  it("fetches a product preview and adds from link with the fetched price", async () => {
    const user = userEvent.setup();
    const onAddFromLink = vi.fn();
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        ok: true,
        name: "Stone basin",
        supplier: "Shopee",
        imageUrl: "https://example.com/basin.jpg",
        price: 8800,
        priceFound: true,
        imageFound: true,
      }),
    });

    vi.stubGlobal("fetch", fetchMock);

    render(
      <ProductOptionsPanel
        roomObject={createRoomObject()}
        projectCurrency="THB"
        materialLibraryVersion={1}
        onSelectProduct={() => {}}
        onApplyReusableProduct={() => {}}
        onSearchCatalog={() => {}}
        onAddFromLink={onAddFromLink}
      />
    );

    await user.type(screen.getByPlaceholderText("Paste product link"), "https://shopee.co.th/product");
    await user.click(screen.getByRole("button", { name: /fetch product/i }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(screen.getByText("Fetched product preview with image and price.")).toBeTruthy());
    expect(screen.getAllByText(/8,800/).length).toBeGreaterThan(0);

    await user.click(screen.getByRole("button", { name: /^add from link$/i }));

    await waitFor(() =>
      expect(onAddFromLink).toHaveBeenCalledWith(
        "object-1",
        expect.objectContaining({
          url: "https://shopee.co.th/product",
          name: "Stone basin",
          supplier: "Shopee",
          price: 8800,
          imageUrl: "https://example.com/basin.jpg",
        })
      )
    );

    vi.unstubAllGlobals();
  });

  it("highlights when price is not fetched so the user adds it manually", async () => {
    const user = userEvent.setup();
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        ok: true,
        name: "Stone basin",
        supplier: "Shopee",
        imageUrl: "https://example.com/basin.jpg",
        priceFound: false,
        imageFound: true,
        warning: "Could not extract price from link. Enter price manually.",
      }),
    });

    vi.stubGlobal("fetch", fetchMock);

    render(
      <ProductOptionsPanel
        roomObject={createRoomObject()}
        projectCurrency="THB"
        materialLibraryVersion={1}
        onSelectProduct={() => {}}
        onApplyReusableProduct={() => {}}
        onSearchCatalog={() => {}}
        onAddFromLink={() => {}}
      />
    );

    await user.type(screen.getByPlaceholderText("Paste product link"), "https://shopee.co.th/product");
    await user.click(screen.getByRole("button", { name: /fetch product/i }));

    await waitFor(() => expect(screen.getByText("Price missing")).toBeTruthy());
    expect(screen.getByText("Price was not fetched.")).toBeTruthy();
    expect(screen.getByText("Add the product price manually before clicking Add from link.")).toBeTruthy();
    expect(screen.getByPlaceholderText("Price").className).toContain("border-red-300");

    vi.unstubAllGlobals();
  });

  it("shows the selected product price and committed state once an item has been added", () => {
    render(
      <ProductOptionsPanel
        roomObject={createRoomObject({
          selectedProductId: "option-1",
          productOptions: [createOption()],
        })}
        projectCurrency="THB"
        materialLibraryVersion={1}
        selectionNotice="Walnut dining table added to Dining table."
        onSelectProduct={() => {}}
        onApplyReusableProduct={() => {}}
        onSearchCatalog={() => {}}
        onAddFromLink={() => {}}
      />
    );

    expect(screen.getAllByText(/9,900/).length).toBeGreaterThan(0);
    expect(screen.getByText("Walnut dining table added to Dining table.")).toBeTruthy();
    expect(screen.getByRole("button", { name: /added to room/i })).toBeTruthy();
  });

  it("lets the user reuse an existing workflow product quickly", async () => {
    const user = userEvent.setup();
    const onApplyReusableProduct = vi.fn();
    const reusableOption = createOption({ id: "reuse-1", name: "Quick reuse sofa", supplier: "Urban Foundry", price: 12000 });

    render(
      <ProductOptionsPanel
        roomObject={createRoomObject()}
        projectCurrency="THB"
        materialLibraryVersion={1}
        quickReuseOptions={[
          {
            id: "project-reuse-1",
            option: reusableOption,
            source: "project",
            label: "3 items using this product",
            usageCount: 3,
          },
        ]}
        onSelectProduct={() => {}}
        onApplyReusableProduct={onApplyReusableProduct}
        onSearchCatalog={() => {}}
        onAddFromLink={() => {}}
      />
    );

    expect(screen.getByText("Quick reuse")).toBeTruthy();
    expect(screen.getByText("3 items using this product")).toBeTruthy();

    await user.click(screen.getAllByRole("button", { name: /^add to room$/i })[0]);

    expect(onApplyReusableProduct).toHaveBeenCalledWith(reusableOption);
  });
});
