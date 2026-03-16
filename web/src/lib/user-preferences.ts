export interface UserPreferences {
  defaultCurrency: "USD" | "AED" | "EUR";
  areaUnit: "sqm" | "sqft";
  compactDensity: boolean;
  showWorkflowHints: boolean;
}

const STORAGE_KEY = "materia:user-preferences:v1";

export const defaultUserPreferences: UserPreferences = {
  defaultCurrency: "USD",
  areaUnit: "sqm",
  compactDensity: false,
  showWorkflowHints: true,
};

function isCurrency(value: unknown): value is UserPreferences["defaultCurrency"] {
  return value === "USD" || value === "AED" || value === "EUR";
}

function isAreaUnit(value: unknown): value is UserPreferences["areaUnit"] {
  return value === "sqm" || value === "sqft";
}

export function loadUserPreferences(): UserPreferences {
  if (typeof window === "undefined") {
    return defaultUserPreferences;
  }

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return defaultUserPreferences;
    }

    const parsed = JSON.parse(raw) as Partial<UserPreferences>;
    return {
      defaultCurrency: isCurrency(parsed.defaultCurrency)
        ? parsed.defaultCurrency
        : defaultUserPreferences.defaultCurrency,
      areaUnit: isAreaUnit(parsed.areaUnit) ? parsed.areaUnit : defaultUserPreferences.areaUnit,
      compactDensity:
        typeof parsed.compactDensity === "boolean" ? parsed.compactDensity : defaultUserPreferences.compactDensity,
      showWorkflowHints:
        typeof parsed.showWorkflowHints === "boolean"
          ? parsed.showWorkflowHints
          : defaultUserPreferences.showWorkflowHints,
    };
  } catch {
    return defaultUserPreferences;
  }
}

export function saveUserPreferences(preferences: UserPreferences): void {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(preferences));
}
