const houseColorPalette = [
  {
    dot: "bg-blue-500",
    softBg: "bg-blue-50",
    softBorder: "border-blue-200",
    strongText: "text-blue-800",
    roomRail: "border-l-blue-500",
  },
  {
    dot: "bg-emerald-500",
    softBg: "bg-emerald-50",
    softBorder: "border-emerald-200",
    strongText: "text-emerald-800",
    roomRail: "border-l-emerald-500",
  },
  {
    dot: "bg-amber-500",
    softBg: "bg-amber-50",
    softBorder: "border-amber-200",
    strongText: "text-amber-800",
    roomRail: "border-l-amber-500",
  },
  {
    dot: "bg-rose-500",
    softBg: "bg-rose-50",
    softBorder: "border-rose-200",
    strongText: "text-rose-800",
    roomRail: "border-l-rose-500",
  },
  {
    dot: "bg-cyan-500",
    softBg: "bg-cyan-50",
    softBorder: "border-cyan-200",
    strongText: "text-cyan-800",
    roomRail: "border-l-cyan-500",
  },
  {
    dot: "bg-violet-500",
    softBg: "bg-violet-50",
    softBorder: "border-violet-200",
    strongText: "text-violet-800",
    roomRail: "border-l-violet-500",
  },
] as const;

function hashString(value: string): number {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash << 5) - hash + value.charCodeAt(index);
    hash |= 0;
  }
  return Math.abs(hash);
}

export function getHouseColor(houseId: string, fallbackIndex?: number) {
  const hasFallbackIndex = typeof fallbackIndex === "number" && Number.isFinite(fallbackIndex);
  const paletteIndex = hasFallbackIndex
    ? Math.abs(fallbackIndex as number) % houseColorPalette.length
    : hashString(houseId) % houseColorPalette.length;

  return houseColorPalette[paletteIndex];
}
