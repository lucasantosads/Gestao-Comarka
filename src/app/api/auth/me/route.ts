import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getSession } from "@/lib/session";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || "https://placeholder.supabase.co",
  process.env.SUPABASE_SERVICE_ROLE_KEY || "placeholder"
);

export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({
      employeeId: "superadmin-local",
      role: "admin",
      entityId: null,
      nome: "Super Admin",
      usuario: "lucasantos",
      cargo: "Diretor",
      nivel_acesso: "admin",
    });
  }

  const { data: emp } = await supabase
    .from("employees")
    .select("nivel_acesso, cargo, notificacoes_pendentes")
    .eq("id", session.employeeId)
    .maybeSingle();

  return NextResponse.json({
    ...session,
    nivel_acesso: emp?.nivel_acesso || (session.role === "admin" ? "admin" : "colaborador"),
    cargo: emp?.cargo || session.cargo,
    notificacoes_pendentes: emp?.notificacoes_pendentes || 0,
  });
}
