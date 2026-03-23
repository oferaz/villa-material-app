import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

interface SubmitClientViewResponseBody {
  itemId?: string;
  selectedOptionId?: string | null;
  preferredBudget?: number | null;
  scopeDecision?: string | null;
  comment?: string | null;
}

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

export async function POST(request: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;

  let body: SubmitClientViewResponseBody;
  try {
    body = (await request.json()) as SubmitClientViewResponseBody;
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON body." }, { status: 400 });
  }

  try {
    const supabase = createRouteClient(request);
    const { data, error } = await supabase.rpc("submit_client_view_response", {
      p_token: token,
      p_item_id: body.itemId ?? null,
      p_selected_option_id: body.selectedOptionId ?? null,
      p_preferred_budget: body.preferredBudget ?? null,
      p_scope_decision: body.scopeDecision ?? null,
      p_comment: body.comment ?? null,
    });

    if (error) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 400 });
    }

    return NextResponse.json({ ok: true, response: data });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to submit client view response.";
    const status = message === "Authentication required." ? 401 : 500;
    return NextResponse.json({ ok: false, error: message }, { status });
  }
}

