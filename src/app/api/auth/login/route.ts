import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createSessionToken, setSessionCookie } from "@/lib/session";

const supabase = createClient((process.env.NEXT_PUBLIC_SUPABASE_URL || "https://placeholder.supabase.co"), (process.env.SUPABASE_SERVICE_ROLE_KEY || "placeholder"));

async function hashPassword(password: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(password);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

export async function POST(req: NextRequest) {
  const { usuario, senha } = await req.json();
  if (!usuario || !senha) return NextResponse.json({ error: "Usuário e senha obrigatórios" }, { status: 400 });

  const hash = await hashPassword(senha);

  const { data: employee, error } = await supabase
    .from("employees")
    .select("id, nome, role, entity_id, ativo, cargo, usuario")
    .eq("usuario", usuario)
    .eq("senha_hash", hash)
    .single();

  if (error || !employee) return NextResponse.json({ error: "Credenciais inválidas" }, { status: 401 });
  if (!employee.ativo) return NextResponse.json({ error: "Conta desativada" }, { status: 403 });

  const token = await createSessionToken({
    employeeId: employee.id,
    role: employee.role,
    entityId: employee.entity_id,
    nome: employee.nome,
    usuario: employee.usuario,
    cargo: employee.cargo || employee.role,
  });

  setSessionCookie(token);

  return NextResponse.json({ role: employee.role, nome: employee.nome, entityId: employee.entity_id });
}
