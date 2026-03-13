import { NextRequest, NextResponse } from "next/server";
import { PostgrestError } from "@supabase/supabase-js";
import { isSupabaseConfigured, supabase } from "@/lib/supabase/client";

export const dynamic = "force-dynamic";

function mapError(error: PostgrestError | null) {
  if (!error) {
    return null;
  }

  return {
    code: error.code,
    message: error.message,
    details: error.details,
    hint: error.hint,
  };
}

function getProjectRef(url?: string): string | null {
  if (!url) {
    return null;
  }

  try {
    return new URL(url).hostname.split(".")[0] ?? null;
  } catch {
    return null;
  }
}

export async function GET(request: NextRequest) {
  const projectId = request.nextUrl.searchParams.get("projectId");

  const envInfo = {
    configured: isSupabaseConfigured,
    hasUrl: Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL),
    hasAnonKey: Boolean(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY),
    projectRef: getProjectRef(process.env.NEXT_PUBLIC_SUPABASE_URL),
  };

  if (!isSupabaseConfigured) {
    return NextResponse.json(
      {
        ok: false,
        reason: "Supabase env vars are missing at runtime.",
        env: envInfo,
      },
      { status: 500 }
    );
  }

  const projectsQuery = await supabase.from("projects").select("id,name", { count: "exact" }).limit(10);
  const projectRows = projectsQuery.data ?? [];

  const housesQueryBase = supabase.from("houses").select("id,project_id,name", { count: "exact" }).limit(10);
  const housesQuery = projectId ? housesQueryBase.eq("project_id", projectId) : housesQueryBase;
  const housesResult = await housesQuery;
  const houseRows = housesResult.data ?? [];

  const roomsQueryBase = supabase.from("rooms").select("id,house_id,name", { count: "exact" }).limit(10);
  const houseIds = houseRows.map((item) => item.id);
  const roomsResult = houseIds.length > 0 ? await roomsQueryBase.in("house_id", houseIds) : await roomsQueryBase;
  const roomRows = roomsResult.data ?? [];

  const roomObjectsQueryBase = supabase
    .from("room_objects")
    .select("id,room_id,name,selected_material_id", { count: "exact" })
    .limit(10);
  const roomIds = roomRows.map((item) => item.id);
  const roomObjectsResult =
    roomIds.length > 0 ? await roomObjectsQueryBase.in("room_id", roomIds) : await roomObjectsQueryBase;
  const roomObjectRows = roomObjectsResult.data ?? [];

  const selectedMaterialIds = Array.from(
    new Set(roomObjectRows.map((item) => item.selected_material_id).filter((item): item is string => Boolean(item)))
  );

  const materialsResult =
    selectedMaterialIds.length > 0
      ? await supabase
          .from("materials")
          .select("id,name,budget_category,price", { count: "exact" })
          .in("id", selectedMaterialIds)
      : await supabase.from("materials").select("id,name,budget_category,price", { count: "exact" }).limit(10);

  return NextResponse.json({
    ok: true,
    timestamp: new Date().toISOString(),
    env: envInfo,
    requestedProjectId: projectId,
    projects: {
      count: projectsQuery.count ?? 0,
      sample: projectRows,
      error: mapError(projectsQuery.error),
    },
    houses: {
      count: housesResult.count ?? 0,
      sample: houseRows,
      error: mapError(housesResult.error),
    },
    rooms: {
      count: roomsResult.count ?? 0,
      sample: roomRows,
      error: mapError(roomsResult.error),
    },
    roomObjects: {
      count: roomObjectsResult.count ?? 0,
      sample: roomObjectRows,
      error: mapError(roomObjectsResult.error),
    },
    materials: {
      count: materialsResult.count ?? 0,
      sample: materialsResult.data ?? [],
      error: mapError(materialsResult.error),
    },
  });
}
