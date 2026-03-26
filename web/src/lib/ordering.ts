export type MoveDirection = "up" | "down";

export function moveListItem<T>(items: T[], index: number, direction: MoveDirection): T[] {
  const offset = direction === "up" ? -1 : 1;
  const targetIndex = index + offset;

  if (index < 0 || index >= items.length || targetIndex < 0 || targetIndex >= items.length) {
    return items;
  }

  const nextItems = [...items];
  const [movedItem] = nextItems.splice(index, 1);
  nextItems.splice(targetIndex, 0, movedItem);
  return nextItems;
}

export function reorderListItem<T>(items: T[], sourceIndex: number, targetIndex: number): T[] {
  if (
    sourceIndex < 0 ||
    sourceIndex >= items.length ||
    targetIndex < 0 ||
    targetIndex >= items.length ||
    sourceIndex == targetIndex
  ) {
    return items;
  }

  const nextItems = [...items];
  const [movedItem] = nextItems.splice(sourceIndex, 1);
  nextItems.splice(targetIndex, 0, movedItem);
  return nextItems;
}
