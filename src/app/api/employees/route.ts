import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getSession, canManageCargo } from "@/lib/session";

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

export async function GET() {
  const session = await getSession();
  // Admin (inclui Head e qualquer cargo com role=admin) podem listar
  if (!session || session.role !== "admin") return NextResponse.json({ error: "Acesso negado" }, { status: 403 });

  const { data, error } = await supabase.from("employees")
    .select("id, nome, usuario, role, entity_id, ativo, foto_url, telefone, data_admissao, created_at")
    .order("role").order("nome");

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

// Cargos operacionais que devem aparecer como analista no /dashboard/clientes
const CARGOS_OPERACIONAIS = ["trafego", "tráfego", "head", "pleno", "junior", "júnior", "diretor", "ceo", "desenvolvimento", "desenvolv"];

function isOperacional(cargo: string): boolean {
  const c = cargo.toLowerCase();
  return CARGOS_OPERACIONAIS.some((k) => c.includes(k));
}

// Deriva o role enum de auth a partir do cargo
function roleFromCargo(cargo: string): "admin" | "closer" | "sdr" {
  const c = cargo.toLowerCase();
  if (c === "closer") return "closer";
  if (c === "sdr") return "sdr";
  return "admin"; // operacionais e admins → permissão admin
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session || session.role !== "admin") return NextResponse.json({ error: "Acesso negado" }, { status: 403 });

  const body = await req.json();
  const { nome, usuario, senha, cargo, role: roleInput, email, telefone, data_admissao, funcoes, salario, dia_vencimento } = body;

  if (!nome || !usuario || !senha) {
    return NextResponse.json({ error: "nome, usuario e senha obrigatórios" }, { status: 400 });
  }

  // Cargo é a fonte de verdade; role é derivado se não vier explícito
  const cargoFinal: string = cargo || roleInput || "admin";

  // Gate: só super-admin (lucas) pode criar admin/diretor; head só cria operacional/closer/sdr
  if (!canManageCargo(session, cargoFinal)) {
    return NextResponse.json({ error: `Você não tem permissão para criar cargo "${cargoFinal}"` }, { status: 403 });
  }
  const role = roleInput && ["admin", "closer", "sdr"].includes(roleInput) ? roleInput : roleFromCargo(cargoFinal);

  const encoder = new TextEncoder();
  const hashBuffer = await crypto.subtle.digest("SHA-256", encoder.encode(senha));
  const senha_hash = Array.from(new Uint8Array(hashBuffer)).map((b) => b.toString(16).padStart(2, "0")).join("");

  // Criar entity (closer ou sdr) se for o caso
  let entity_id: string | null = null;
  if (role === "closer") {
    const { data: closer, error: e1 } = await supabase.from("closers")
      .insert({ nome, ativo: true }).select("id").single();
    if (e1) return NextResponse.json({ error: `closers: ${e1.message}` }, { status: 500 });
    entity_id = closer?.id;
  } else if (role === "sdr") {
    const { data: sdr, error: e2 } = await supabase.from("sdrs")
      .insert({ nome, ativo: true }).select("id").single();
    if (e2) return NextResponse.json({ error: `sdrs: ${e2.message}` }, { status: 500 });
    entity_id = sdr?.id;
  }

  // Cargo operacional → também cria em team_notion_mirror para aparecer como analista
  if (isOperacional(cargoFinal)) {
    const notionId = `local_${crypto.randomUUID()}`;
    const { error: e3 } = await supabase.from("team_notion_mirror").insert({
      notion_id: notionId,
      nome,
      cargo: cargoFinal,
      funcoes: funcoes || null,
      email: email || null,
      telefone: telefone || null,
      status: "ativo",
    });
    if (e3) {
      // não bloqueia o cadastro se a mirror falhar — só loga
      console.error("team_notion_mirror insert:", e3.message);
    }
  }

  const { data, error } = await supabase.from("employees")
    .insert({
      nome, usuario, senha_hash, senha_visivel: senha,
      role, cargo: cargoFinal,
      email: email || null,
      entity_id, ativo: true,
      telefone: telefone || null,
      data_admissao: data_admissao || null,
    })
    .select().single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Entrada na folha de pagamento (custos_fixos_recorrentes tipo='folha')
  // sempre que o colaborador é criado — valor pode ser 0 e admin ajusta depois.
  const { error: eFolha } = await supabase.from("custos_fixos_recorrentes").insert({
    nome,
    tipo: "folha",
    cargo: cargoFinal,
    valor: Number(salario || 0),
    dia_vencimento: dia_vencimento ? Number(dia_vencimento) : null,
    ativo: true,
    data_inicio: data_admissao || null,
    employee_id: data.id,
  });
  if (eFolha) console.error("custos_fixos_recorrentes insert:", eFolha.message);

  return NextResponse.json(data);
}
