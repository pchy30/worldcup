import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";

const ADMIN_SECRET = process.env.ADMIN_SECRET;

export async function POST(request: NextRequest) {
  // Simple secret-based auth for admin endpoints
  const authHeader = request.headers.get("x-admin-secret");
  if (!ADMIN_SECRET || authHeader !== ADMIN_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: { team_code?: string; eliminated?: boolean };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { team_code, eliminated = true } = body;
  if (!team_code) {
    return NextResponse.json({ error: "team_code is required." }, { status: 400 });
  }

  const adminSupabase = createAdminClient();

  const { data, error } = await adminSupabase
    .from("national_teams")
    .update({ is_eliminated: eliminated })
    .eq("code", team_code.toUpperCase())
    .select("name, code, is_eliminated")
    .single();

  if (error || !data) {
    return NextResponse.json(
      { error: error?.message ?? "Team not found." },
      { status: 404 }
    );
  }

  return NextResponse.json(data);
}