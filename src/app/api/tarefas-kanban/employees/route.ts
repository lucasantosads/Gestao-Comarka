import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

const supabase = createClient((process.env.NEXT_PUBLIC_SUPABASE_URL || "https://placeholder.supabase.co"), (process.env.SUPABASE_SERVICE_ROLE_KEY || "placeholder"));

export async function GET() {
  const { data, error } = await supabase
    .from("employees")
    .select("id, nome, role, cargo, foto_url")
    .eq("ativo", true)
    .order("nome");

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data || []);
}
