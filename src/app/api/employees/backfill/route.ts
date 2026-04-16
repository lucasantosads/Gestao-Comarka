/**
 * POST /api/employees/backfill
 * Cria employees para todo mundo em team_notion_mirror + closers + sdrs
 * que ainda não tem conta de login. Senha padrão: comarka2026.
 * Admin-only.
 */
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getSession } from "@/lib/session";

const supabase = createClient((process.env.NEXT_PUBLIC_SUPABASE_URL || "https://placeholder.supabase.co"), (process.env.SUPABASE_SERVICE_ROLE_KEY || "placeholder"));

const SENHA_PADRAO = "comarka2026";

async function sha256(s: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

function slugify(nome: string): string {
  return (nome || "")
    .toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s]/g, "")
    .replace(/\s+/g, ".")
    .replace(/^\.+|\.+$/g, "");
}

function cargoToRole(cargo: string): "admin" | "closer" | "sdr" {
  const c = (cargo || "").toLowerCase();
  if (c.includes("closer")) return "closer";
  if (c.includes("sdr")) return "sdr";
  return "admin";
}

export async function POST() {
  const session = await getSession();
  if (!session || session.role !== "admin") return NextResponse.json({ error: "Acesso negado" }, { status: 403 });

  const senha_hash = await sha256(SENHA_PADRAO);

  const [{ data: existing }, { data: closers }, { data: sdrs }, { data: team }, { data: folha }] = await Promise.all([
    supabase.from("employees").select("id, nome, entity_id, role"),
    supabase.from("closers").select("id, nome, ativo"),
    supabase.from("sdrs").select("id, nome, ativo"),
    supabase.from("team_notion_mirror").select("nome, cargo, email, telefone, status"),
    supabase.from("custos_fixos_recorrentes").select("id, nome, cargo, valor, dia_vencimento, ativo, employee_id").eq("tipo", "folha"),
  ]);

  const existingNames = new Set((existing || []).map((e) => slugify(e.nome)));
  const existingCloserIds = new Set((existing || []).filter((e) => e.role === "closer").map((e) => e.entity_id));
  const existingSdrIds = new Set((existing || []).filter((e) => e.role === "sdr").map((e) => e.entity_id));

  const created: string[] = [];
  const skipped: string[] = [];

  // 1. Closers sem employees
  for (const c of (closers || []) as Array<{ id: string; nome: string; ativo: boolean | null }>) {
    if (existingCloserIds.has(c.id)) { skipped.push(c.nome); continue; }
    const usuario = slugify(c.nome);
    if (!usuario) continue;
    const { error } = await supabase.from("employees").insert({
      nome: c.nome, usuario, senha_hash, senha_visivel: SENHA_PADRAO,
      role: "closer", cargo: "Closer", entity_id: c.id, ativo: c.ativo ?? true,
    });
    if (!error) { created.push(`${c.nome} (Closer)`); existingNames.add(usuario); }
  }

  // 2. SDRs sem employees
  for (const s of (sdrs || []) as Array<{ id: string; nome: string; ativo: boolean | null }>) {
    if (existingSdrIds.has(s.id)) { skipped.push(s.nome); continue; }
    const usuario = slugify(s.nome);
    if (!usuario) continue;
    const { error } = await supabase.from("employees").insert({
      nome: s.nome, usuario, senha_hash, senha_visivel: SENHA_PADRAO,
      role: "sdr", cargo: "SDR", entity_id: s.id, ativo: s.ativo ?? true,
    });
    if (!error) { created.push(`${s.nome} (SDR)`); existingNames.add(usuario); }
  }

  // 3. team_notion_mirror (operacional + administrativo) — todo mundo sem conta
  for (const t of (team || []) as Array<{ nome: string; cargo: string | null; email: string | null; telefone: string | null; status: string | null }>) {
    if (!t.nome) continue;
    const usuario = slugify(t.nome);
    if (!usuario || existingNames.has(usuario)) { skipped.push(t.nome); continue; }
    const role = cargoToRole(t.cargo || "");
    const { error } = await supabase.from("employees").insert({
      nome: t.nome, usuario, senha_hash, senha_visivel: SENHA_PADRAO,
      role, cargo: t.cargo || "Admin",
      email: t.email, telefone: t.telefone,
      ativo: (t.status || "ativo").toLowerCase() === "ativo",
    });
    if (!error) { created.push(`${t.nome} (${t.cargo || "Admin"})`); existingNames.add(usuario); }
  }

  // 4. custos_fixos_recorrentes (folha) — quem está na folha mas não tem employees
  for (const f of (folha || []) as Array<{ id: string; nome: string; cargo: string | null; valor: number; dia_vencimento: number | null; ativo: boolean | null; employee_id: string | null }>) {
    if (f.employee_id) { skipped.push(f.nome); continue; }
    if (!f.nome) continue;
    const usuario = slugify(f.nome);
    if (!usuario || existingNames.has(usuario)) { skipped.push(f.nome); continue; }
    const cargo = f.cargo || "Admin";
    const role = cargoToRole(cargo);
    const { data: emp, error } = await supabase.from("employees").insert({
      nome: f.nome, usuario, senha_hash, senha_visivel: SENHA_PADRAO,
      role, cargo,
      ativo: f.ativo ?? true,
    }).select("id").single();
    if (!error && emp) {
      created.push(`${f.nome} (${cargo}) — da folha`);
      existingNames.add(usuario);
      await supabase.from("custos_fixos_recorrentes").update({ employee_id: emp.id }).eq("id", f.id);
    }
  }

  // 5. Garante entrada folha para todo employee que ainda não tem
  const { data: allEmp } = await supabase.from("employees").select("id, nome, cargo, ativo");
  const { data: folhaAfter } = await supabase.from("custos_fixos_recorrentes").select("employee_id").eq("tipo", "folha");
  const folhaEmpIds = new Set((folhaAfter || []).map((f) => f.employee_id).filter(Boolean));
  for (const e of (allEmp || []) as Array<{ id: string; nome: string; cargo: string | null; ativo: boolean | null }>) {
    if (folhaEmpIds.has(e.id)) continue;
    await supabase.from("custos_fixos_recorrentes").insert({
      nome: e.nome, tipo: "folha", cargo: e.cargo || "Admin",
      valor: 0, ativo: e.ativo ?? true, employee_id: e.id,
    });
  }

  return NextResponse.json({ created_count: created.length, created, skipped_count: skipped.length });
}
