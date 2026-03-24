import { ProductOption, RoomObject } from "@/types";

function dedupeOptions(options: ProductOption[]): ProductOption[] {
  return options.filter((option, index, collection) => collection.findIndex((candidate) => candidate.id === option.id) === index);
}

export function isLinkProductOption(option: ProductOption): boolean {
  return option.sourceType === "link";
}

export function mergeObjectOptionsAfterSearch(
  objectItem: RoomObject,
  searchResults: ProductOption[],
  options?: { preserveLinkOptions?: boolean }
): ProductOption[] {
  const selectedOption = objectItem.selectedProductId
    ? objectItem.productOptions.find((option) => option.id === objectItem.selectedProductId)
    : undefined;
  const preservedLinkOptions = options?.preserveLinkOptions ? objectItem.productOptions.filter(isLinkProductOption) : [];
  const mergedOptions = dedupeOptions([...preservedLinkOptions, ...searchResults]);

  if (selectedOption && !mergedOptions.some((option) => option.id === selectedOption.id)) {
    return [selectedOption, ...mergedOptions];
  }

  return mergedOptions;
}

export function applyLinkProductOption(
  objectItem: RoomObject,
  linkOption: ProductOption
): Pick<RoomObject, "productOptions" | "selectedProductId"> {
  return {
    productOptions: [linkOption, ...objectItem.productOptions.filter((option) => option.id !== linkOption.id)],
    selectedProductId: linkOption.id,
  };
}
