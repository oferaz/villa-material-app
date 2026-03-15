import { isSupabaseConfigured, supabase } from "@/lib/supabase/client";

export interface CreateProjectWizardInput {
  name: string;
  clientName?: string;
  location?: string;
  houseNames: string[];
  houseSizesSqm?: number[];
}

export async function createProjectWithWizard(input: CreateProjectWizardInput): Promise<string> {
  if (!isSupabaseConfigured) {
    throw new Error("Supabase is not configured.");
  }

  const projectName = input.name.trim();
  if (!projectName) {
    throw new Error("Project name is required.");
  }

  const houseNames = input.houseNames.map((house) => house.trim()).filter((house) => house.length > 0);
  if (houseNames.length === 0) {
    throw new Error("Add at least one house.");
  }

  const houseSizesSqm = houseNames.map((_, index) => {
    const rawValue = input.houseSizesSqm?.[index];
    if (typeof rawValue !== "number" || !Number.isFinite(rawValue) || rawValue <= 0) {
      return 0;
    }
    return Math.round(rawValue * 100) / 100;
  });

  let { data, error } = await supabase.rpc("create_project_with_owner_membership", {
    p_name: projectName,
    p_client_name: input.clientName?.trim() || null,
    p_location: input.location?.trim() || null,
    p_currency: "USD",
    p_house_names: houseNames,
    p_house_sizes: houseSizesSqm,
  });

  if (error?.code === "42883") {
    // Fallback for environments where the size-aware wizard migration is not applied yet.
    const fallback = await supabase.rpc("create_project_with_owner_membership", {
      p_name: projectName,
      p_client_name: input.clientName?.trim() || null,
      p_location: input.location?.trim() || null,
      p_currency: "USD",
      p_house_names: houseNames,
    });
    data = fallback.data;
    error = fallback.error;
  }

  if (error) {
    if (error.code === "42883") {
      throw new Error("Database wizard function is missing. Apply the latest migrations and retry.");
    }
    throw new Error(error.message);
  }

  if (!data || typeof data !== "string") {
    throw new Error("Project creation failed: invalid response.");
  }

  return data;
}
