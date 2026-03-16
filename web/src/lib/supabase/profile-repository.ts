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

  const { data, error } = await supabase
    .from("profiles")
    .upsert(
      {
        id: user.id,
        full_name: fullName || null,
        company_name: companyName || null,
      },
      { onConflict: "id" }
    )
    .select("id,full_name,company_name")
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return {
    id: (data as ProfileRow).id,
    email: user.email ?? "",
    fullName: (data as ProfileRow).full_name ?? "",
    companyName: (data as ProfileRow).company_name ?? "",
  };
}
