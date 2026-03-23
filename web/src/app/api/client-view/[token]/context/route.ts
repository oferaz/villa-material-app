import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

function createRouteClient(request: NextRequest) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();
  const authorization = request.headers.get("authorization")?.trim();

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error("Supabase environment variables are not configured.");
  }
  if (!authorization) {
    throw new Error("Authentication required.");
  }

  return createClient(supabaseUrl, supabaseAnonKey, {
    global: {
      headers: {
        Authorization: authorization,
      },
    },
  });
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;

  try {
    const supabase = createRouteClient(request);
    const { data, error } = await supabase.rpc("get_client_view_submission_context", {
      p_token: token,
    });

    if (error) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 403 });
    }

    return NextResponse.json({ ok: true, context: data });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to load submission context.";
    const status = message === "Authentication required." ? 401 : 500;
    return NextResponse.json({ ok: false, error: message }, { status });
  }
}

