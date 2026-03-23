import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

function createRouteClient(request?: NextRequest) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error("Supabase environment variables are not configured.");
  }

  const authorization = request?.headers.get("authorization")?.trim();
  return createClient(supabaseUrl, supabaseAnonKey, authorization ? { global: { headers: { Authorization: authorization } } } : undefined);
}

export async function GET(_request: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;

  try {
    const supabase = createRouteClient();
    const { data, error } = await supabase.rpc("get_published_client_view", {
      p_token: token,
    });

    if (error) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 400 });
    }

    if (!data) {
      return NextResponse.json({ ok: false, error: "Client view not found." }, { status: 404 });
    }

    return NextResponse.json({ ok: true, clientView: data });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Failed to load client view." },
      { status: 500 }
    );
  }
}

