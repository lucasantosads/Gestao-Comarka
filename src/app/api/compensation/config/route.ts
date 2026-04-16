import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getSession } from "@/lib/session";

const supabase = createClient((process.env.NEXT_PUBLIC_SUPABASE_URL || "https://placeholder.supabase.co"), (process.env.SUPABASE_SERVICE_ROLE_KEY || "placeholder"));

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const employeeId = req.nextUrl.searchParams.get("employee_id") || session.employeeId;
  const mes = req.nextUrl.searchParams.get("mes");

  if (session.role !== "admin" && employeeId !== session.employeeId) {
    return NextResponse.json({ error: "Acesso negado" }, { status: 403 });
  }

  let query = supabase.from("compensation_config").select("*").eq("employee_id", employeeId);
  if (mes) query = query.eq("mes_referencia", mes);
  query = query.order("mes_referencia", { ascending: false });

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session || session.role !== "admin") return NextResponse.json({ error: "Acesso negado" }, { status: 403 });

  const body = await req.json();
  const { data, error } = await supabase.from("compensation_config")
    .upsert(body, { onConflict: "employee_id,mes_referencia" })
    .select().single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}
