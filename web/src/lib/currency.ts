export function normalizeCurrencyCode(value?: string | null): string {
  const normalized = value?.trim().toUpperCase();
  return normalized || "USD";
}

export function formatCurrencyAmount(value: number | null | undefined, currency = "USD"): string {
  if (value === null || value === undefined) {
    return "Not set";
  }

  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: normalizeCurrencyCode(currency),
    maximumFractionDigits: 0,
  }).format(Math.round(value));
}

export function formatSignedCurrencyDelta(value: number, currency = "USD"): string {
  const rounded = Math.round(value);
  if (rounded === 0) {
    return `No change (${formatCurrencyAmount(0, currency)})`;
  }

  const sign = rounded > 0 ? "+" : "-";
  return `${sign}${formatCurrencyAmount(Math.abs(rounded), currency)}`;
}
