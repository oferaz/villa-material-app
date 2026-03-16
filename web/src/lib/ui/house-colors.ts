const houseColorPalette = [
  {
    dot: "bg-blue-500",
    softBg: "bg-blue-50",
    softBorder: "border-blue-200",
    strongText: "text-blue-800",
  },
  {
    dot: "bg-emerald-500",
    softBg: "bg-emerald-50",
    softBorder: "border-emerald-200",
    strongText: "text-emerald-800",
  },
  {
    dot: "bg-amber-500",
    softBg: "bg-amber-50",
    softBorder: "border-amber-200",
    strongText: "text-amber-800",
  },
  {
    dot: "bg-rose-500",
    softBg: "bg-rose-50",
    softBorder: "border-rose-200",
    strongText: "text-rose-800",
  },
  {
    dot: "bg-cyan-500",
    softBg: "bg-cyan-50",
    softBorder: "border-cyan-200",
    strongText: "text-cyan-800",
  },
  {
    dot: "bg-violet-500",
    softBg: "bg-violet-50",
    softBorder: "border-violet-200",
    strongText: "text-violet-800",
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

export function getHouseColor(houseId: string, fallbackIndex = 0) {
  const paletteIndex =
    houseId.trim().length > 0
      ? hashString(houseId) % houseColorPalette.length
      : Math.abs(fallbackIndex) % houseColorPalette.length;

  return houseColorPalette[paletteIndex];
}

