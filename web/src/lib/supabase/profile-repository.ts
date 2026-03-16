import { isSupabaseConfigured, supabase } from "@/lib/supabase/client";

export interface UserProfileRecord {
  id: string;
  email: string;
  fullName: string;
  companyName: string;
}

interface ProfileRow {
  id: string;
  full_name: string | null;
  company_name: string | null;
}

function isPermissionError(code?: string, message?: string): boolean {
  if (code === "42501") {
    return true;
  }
  const normalized = (message ?? "").toLowerCase();
  return normalized.includes("row-level security") || normalized.includes("permission denied");
}

export async function loadCurrentUserProfile(): Promise<UserProfileRecord | null> {
  if (!isSupabaseConfigured) {
    return null;
  }

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError) {
    throw new Error(userError.message);
  }

  if (!user) {
    return null;
  }

  const { data, error } = await supabase
    .from("profiles")
    .select("id,full_name,company_name")
    .eq("id", user.id)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return {
    id: user.id,
    email: user.email ?? "",
    fullName: (data as ProfileRow | null)?.full_name ?? "",
    companyName: (data as ProfileRow | null)?.company_name ?? "",
  };
}

export async function saveCurrentUserProfile(payload: {
  fullName: string;
  companyName: string;
}): Promise<UserProfileRecord> {
  if (!isSupabaseConfigured) {
    throw new Error("Supabase is not configured.");
  }

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError) {
    throw new Error(userError.message);
  }

  if (!user) {
    throw new Error("You must be signed in to update your profile.");
  }

  const fullName = payload.fullName.trim();
  const companyName = payload.companyName.trim();

  const { data: updatedRows, error: updateError } = await supabase
    .from("profiles")
    .update({
      full_name: fullName || null,
      company_name: companyName || null,
    })
    .eq("id", user.id)
    .select("id,full_name,company_name")
    .limit(1);

  if (updateError) {
    throw new Error(updateError.message);
  }

  const updated = (updatedRows?.[0] as ProfileRow | undefined) ?? null;
  if (updated) {
    return {
      id: updated.id,
      email: user.email ?? "",
      fullName: updated.full_name ?? "",
      companyName: updated.company_name ?? "",
    };
  }

  const { data: inserted, error: insertError } = await supabase
    .from("profiles")
    .insert({
      id: user.id,
      full_name: fullName || null,
      company_name: companyName || null,
    })
    .select("id,full_name,company_name")
    .single();

  if (insertError) {
    if (isPermissionError(insertError.code, insertError.message)) {
      throw new Error(
        "Profile insert is blocked by RLS. Apply migration 20260316_add_profiles_self_insert_policy.sql in Supabase."
      );
    }
    throw new Error(insertError.message);
  }

  return {
    id: (inserted as ProfileRow).id,
    email: user.email ?? "",
    fullName: (inserted as ProfileRow).full_name ?? "",
    companyName: (inserted as ProfileRow).company_name ?? "",
  };
}
