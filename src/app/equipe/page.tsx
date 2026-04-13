"use client";

import { useMemo, useState, useEffect } from "react";
import useSWR from "swr";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Plus, Edit2, Archive, RotateCcw, X, Eye, EyeOff, Copy, ShieldAlert, BadgeDollarSign, UserCog } from "lucide-react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";

export type SystemRole = "admin" | "closer" | "sdr" | "operacao" | "marketing" | "sucesso";

interface Employee {
  id: string; nome: string; usuario: string; role: SystemRole;
  entity_id: string | null; ativo: boolean; telefone: string | null;
  data_admissao: string | null; created_at: string;
}

const ROLE_BADGE: Record<string, { label: string; color: string }> = {
  admin: { label: "Admin", color: "bg-red-500/15 text-red-500 border border-red-500/20" },
  closer: { label: "Closer", color: "bg-blue-500/15 text-blue-400 border border-blue-500/20" },
  sdr: { label: "SDR", color: "bg-teal-500/15 text-teal-400 border border-teal-500/20" },
  operacao: { label: "Operações", color: "bg-indigo-500/15 text-indigo-400 border border-indigo-500/20" },
  marketing: { label: "Marketing", color: "bg-pink-500/15 text-pink-400 border border-pink-500/20" },
  sucesso: { label: "CS", color: "bg-purple-500/15 text-purple-400 border border-purple-500/20" },
};

const fetcher = (url: string) => fetch(url).then(r => { if (!r.ok) throw new Error("Fetch Error"); return r.json(); });

export default function EquipePage() {
  const { data: employeesRaw, isLoading: loading, mutate } = useSWR<Employee[]>("/api/employees", fetcher);
  const { data: session } = useSWR("/api/auth/me", fetcher);

  const employees = Array.isArray(employeesRaw) ? employeesRaw : [];
  const rolesWithAccess = session?.role === "admin" || session?.cargo?.toLowerCase() === "head";

  const [showNovo, setShowNovo] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [filter, setFilter] = useState<"todos" | "ativos" | "inativos">("ativos");

  const toggleAtivo = async (emp: Employee) => {
    const res = await fetch(`/api/employees/${emp.id}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ativo: !emp.ativo }),
    });
    if (res.ok) {
      toast.success(`${emp.nome} ${emp.ativo ? "arquivado" : "reativado"}!`);
      mutate();
    }
  };

  const { filtered, grouped } = useMemo(() => {
    let f = employees;
    if (filter === "ativos") f = f.filter((e) => e.ativo);
    if (filter === "inativos") f = f.filter((e) => !e.ativo);

    const admins = f.filter((e) => e.role === "admin");
    const operacoes = f.filter((e) => e.role === "operacao" || e.role === "marketing" || e.role === "sucesso");
    const closers = f.filter((e) => e.role === "closer");
    const sdrs = f.filter((e) => e.role === "sdr");

    return {
      filtered: f,
      grouped: [
        { label: "Administradores do Sistema", list: admins },
        { label: "Pipeline (Closers)", list: closers },
        { label: "Prospecção (SDRs)", list: sdrs },
        { label: "Núcleos Criativos & Operacionais", list: operacoes },
      ].filter((g) => g.list.length > 0)
    };
  }, [employees, filter]);

  if (!rolesWithAccess && session) return (
    <div className="flex flex-col items-center justify-center py-20 text-muted-foreground gap-3">
      <ShieldAlert size={32} />
      <p className="text-sm font-medium">Acesso negado. Apenas Gestores e Diretores possuem privilégios de controle da área DHO.</p>
    </div>
  );

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-2 duration-700">
      <div className="flex flex-col md:flex-row items-center justify-between gap-4 border-b border-border/50 pb-4">
        <div className="flex items-center gap-3">
          <div className="w-1.5 h-7 bg-primary rounded-full"></div>
          <h1 className="text-3xl font-black tracking-tight" style={{ letterSpacing: "-0.04em" }}>Gestão de Pessoal</h1>
        </div>

        <div className="flex items-center gap-2">
          <div className="flex bg-muted/50 border border-border/50 rounded-xl p-1 backdrop-blur shadow-inner">
            {(["ativos", "todos", "inativos"] as const).map((f) => (
              <button key={f} onClick={() => setFilter(f)}
                className={`px-3 py-1.5 text-xs font-bold uppercase tracking-wider rounded-lg transition-all ${filter === f ? "bg-background text-foreground shadow scale-100" : "text-muted-foreground hover:bg-muted/80 scale-95"}`}>
                {f}
              </button>
            ))}
          </div>
          <Button size="sm" onClick={() => setShowNovo(true)} className="rounded-xl shadow shadow-primary/20 hover:shadow-primary/40 transition-shadow">
            <Plus size={16} className="mr-1.5" /> Adicionar
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="bg-card/40 backdrop-blur border-border/50 shadow-sm"><CardContent className="p-4 flex flex-col items-center"><p className="text-[10px] uppercase font-bold tracking-widest text-muted-foreground mb-1">Total Ativos</p><p className="text-3xl font-black">{employees.filter((e) => e.ativo).length}</p></CardContent></Card>
        <Card className="bg-card/40 backdrop-blur border-border/50 shadow-sm"><CardContent className="p-4 flex flex-col items-center"><p className="text-[10px] uppercase font-bold tracking-widest text-muted-foreground mb-1">Vendas (Pipeline)</p><p className="text-3xl font-black text-blue-400">{employees.filter((e) => e.role === "closer" && e.ativo).length}</p></CardContent></Card>
        <Card className="bg-card/40 backdrop-blur border-border/50 shadow-sm"><CardContent className="p-4 flex flex-col items-center"><p className="text-[10px] uppercase font-bold tracking-widest text-muted-foreground mb-1">SDRs</p><p className="text-3xl font-black text-teal-400">{employees.filter((e) => e.role === "sdr" && e.ativo).length}</p></CardContent></Card>
        <Link href="/custos-fixos" className="group">
          <Card className="bg-emerald-500/5 backdrop-blur border-emerald-500/20 shadow-sm group-hover:bg-emerald-500/10 transition-colors h-full flex items-center justify-center">
            <CardContent className="p-4 flex flex-col items-center text-emerald-500">
              <BadgeDollarSign size={20} className="mb-2 opacity-80" />
              <p className="text-[10px] uppercase font-bold tracking-widest mb-1 text-emerald-600 dark:text-emerald-400">Ver Folhas</p>
              <span className="text-xs font-semibold underline decoration-emerald-500/30 group-hover:decoration-emerald-500/80 underline-offset-2">DRE / Financeiro</span>
            </CardContent>
          </Card>
        </Link>
      </div>

      {loading && (
        <div className="h-40 flex items-center justify-center">
          <div className="w-8 h-8 border-4 border-muted border-t-primary rounded-full animate-spin"></div>
        </div>
      )}

      {!loading && (
        <div className="space-y-8">
          {grouped.map((group) => (
            <div key={group.label} className="space-y-3">
              <div className="flex items-center gap-3">
                <h2 className="text-sm font-bold tracking-widest uppercase text-muted-foreground bg-muted/30 px-3 py-1 rounded-sm border-l-2 border-primary">{group.label}</h2>
                <div className="flex-1 border-b border-border/30 h-px"></div>
                <span className="text-[10px] font-mono text-muted-foreground">[{group.list.length}]</span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {group.list.map((emp) => (
                  <Card key={emp.id} className={`border-border/40 shadow-sm backdrop-blur transition-all overflow-hidden ${!emp.ativo ? "opacity-60 grayscale-[0.8] bg-muted/10 border-dashed" : "bg-card/50 hover:bg-muted/10 hover:border-primary/30"}`}>
                    <CardContent className="p-4 flex flex-col gap-4">
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary/20 to-primary/5 border border-primary/20 flex flex-col items-center justify-center shadow-inner">
                            <UserCog size={16} className="text-primary opacity-80" />
                          </div>
                          <div className="flex flex-col">
                            <p className="text-sm font-bold tracking-tight truncate max-w-[130px]" title={emp.nome}>{emp.nome}</p>
                            <p className="text-[10px] text-muted-foreground font-mono mt-0.5">@{emp.usuario}</p>
                          </div>
                        </div>
                        <div className="flex flex-col items-end gap-1">
                          <Badge className={`text-[8px] px-1.5 py-0 uppercase tracking-widest ${ROLE_BADGE[emp.role]?.color || "bg-muted text-muted-foreground border-transparent"}`}>
                            {ROLE_BADGE[emp.role]?.label || emp.role}
                          </Badge>
                          {!emp.ativo && <Badge className="text-[8px] px-1.5 py-0 uppercase tracking-widest bg-rose-500/10 text-rose-500 border border-rose-500/20">Desligado</Badge>}
                        </div>
                      </div>

                      <div className="bg-background/40 border border-border/50 rounded-lg p-2.5 flex items-center justify-between mt-auto">
                        <span className="text-[10px] font-medium text-muted-foreground select-all">{emp.telefone || "Sem telefone"}</span>
                        <div className="flex items-center gap-1 bg-card rounded-md border border-border p-0.5">
                          <Link href={`/equipe/${emp.id}`}>
                            <motion.button whileTap={{ scale: 0.9 }} className="p-1 text-muted-foreground hover:text-primary transition-colors hover:bg-primary/10 rounded" title="Ver Relatórios Individuais">
                              <Eye size={14} />
                            </motion.button>
                          </Link>
                          <motion.button whileTap={{ scale: 0.9 }} onClick={() => setEditId(emp.id)} className="p-1 text-muted-foreground hover:text-amber-500 transition-colors hover:bg-amber-500/10 rounded" title="Editar Arquivo Funcional">
                            <Edit2 size={14} />
                          </motion.button>
                          <motion.button whileTap={{ scale: 0.9 }} onClick={() => toggleAtivo(emp)} className={`p-1 transition-colors rounded ${emp.ativo ? "text-muted-foreground hover:text-rose-500 hover:bg-rose-500/10" : "text-emerald-500 hover:bg-emerald-500/10"}`} title={emp.ativo ? "Desativar (Arquivar)" : "Reativar"}>
                            {emp.ativo ? <Archive size={14} /> : <RotateCcw size={14} />}
                          </motion.button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      <AnimatePresence>
        {showNovo && <NovoModal onClose={() => setShowNovo(false)} onSaved={() => { setShowNovo(false); mutate(); }} sessionRole={session?.cargo || session?.role} />}
        {editId && <EditModal empId={editId} onClose={() => setEditId(null)} onSaved={() => { setEditId(null); mutate(); }} sessionRole={session?.cargo || session?.role} />}
      </AnimatePresence>
    </div>
  );
}

function PasswordField({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder?: string }) {
  const [visible, setVisible] = useState(false);
  return (
    <div className="relative">
      <Input type={visible ? "text" : "password"} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} className="pr-16 font-mono bg-background/50 border-white/10" />
      <div className="absolute right-1 top-1/2 -translate-y-1/2 flex items-center gap-0.5">
        {value && (
          <button type="button" onClick={() => { navigator.clipboard.writeText(value); toast.success("Senha copiada"); }} className="p-1.5 text-muted-foreground hover:text-foreground">
            <Copy size={12} />
          </button>
        )}
        <button type="button" onClick={() => setVisible((v) => !v)} className="p-1.5 text-muted-foreground hover:text-foreground">
          {visible ? <EyeOff size={12} /> : <Eye size={12} />}
        </button>
      </div>
    </div>
  );
}

const CARGOS_FULL = ["Closer", "SDR", "Operações", "Marketing", "Sucesso do Cliente", "Admin"];
const CARGOS_HEAD = ["Closer", "SDR", "Operações", "Marketing", "Sucesso do Cliente"];

function cargoToRoleLogic(cargo: string): SystemRole {
  const c = (cargo || "").toLowerCase();
  if (c.includes("closer")) return "closer";
  if (c.includes("sdr")) return "sdr";
  if (c.includes("operac") || c.includes("operaç") || c.includes("trafego") || c.includes("tráfego") || c.includes("dev")) return "operacao";
  if (c.includes("marketing") || c.includes("social")) return "marketing";
  if (c.includes("sucesso") || c.includes("cs")) return "sucesso";
  return "admin";
}

function useCargosPermitidos(sessionRole?: string): string[] {
  return useMemo(() => {
    if (!sessionRole) return [];
    if (sessionRole === "admin" || sessionRole.toLowerCase().includes("diretor")) return CARGOS_FULL;
    if (sessionRole.toLowerCase() === "head") return CARGOS_HEAD;
    return [];
  }, [sessionRole]);
}

function NovoModal({ onClose, onSaved, sessionRole }: { onClose: () => void; onSaved: () => void; sessionRole?: string }) {
  const cargosPermitidos = useCargosPermitidos(sessionRole);
  const [form, setForm] = useState({ nome: "", usuario: "", senha: "comarka2026", cargo: "Closer", email: "", telefone: "", data_admissao: "", salario: 0, dia_vencimento: "" });
  const [saving, setSaving] = useState(false);

  const salvar = async () => {
    if (!form.nome || !form.usuario) { toast.error("Nome e usuario obrigatórios"); return; }
    setSaving(true);
    const res = await fetch("/api/employees", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...form, role: cargoToRoleLogic(form.cargo) }),
    });
    const data = await res.json();
    if (data.error) toast.error(data.error);
    else { toast.success(`${form.nome} provisionado no sistema.`); onSaved(); }
    setSaving(false);
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" onClick={onClose}>
      <motion.div initial={{ scale: 0.95, y: 10 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.95, y: 10 }} className="bg-card border border-white/10 rounded-2xl shadow-2xl p-6 w-full max-w-xl space-y-5" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-border/50 pb-3">
          <div>
            <h3 className="text-lg font-bold tracking-tight">Onboarding Colaborador</h3>
            <p className="text-[11px] text-muted-foreground uppercase tracking-widest font-semibold mt-1">Criação Multi-Sistema e DRE Acoplada</p>
          </div>
          <button onClick={onClose} className="p-2 bg-muted/50 hover:bg-muted rounded-full transition-colors"><X size={16} className="text-muted-foreground" /></button>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div className="col-span-2 space-y-1.5"><Label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Nome Social / Nome Completo *</Label><Input value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} className="bg-background/50 border-white/5 focus-visible:ring-primary/50" /></div>
          <div className="space-y-1.5"><Label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Alias (Login) *</Label><Input value={form.usuario} onChange={(e) => setForm({ ...form, usuario: e.target.value.toLowerCase().trim() })} placeholder="ex: pedro.vendas" className="bg-background/50 border-white/5 focus-visible:ring-primary/50 font-mono" /></div>
          <div className="space-y-1.5"><Label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Senha Provisória *</Label><PasswordField value={form.senha} onChange={(v) => setForm({ ...form, senha: v })} /></div>
          <div className="space-y-1.5"><Label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Departamento / Role *</Label>
            <select value={form.cargo} onChange={(e) => setForm({ ...form, cargo: e.target.value })} className="w-full text-sm bg-background/50 border border-white/5 focus:ring-1 focus:ring-primary/50 rounded-lg px-3 py-2 outline-none">
              {cargosPermitidos.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div className="space-y-1.5"><Label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Contato WhatsApp</Label><Input value={form.telefone} onChange={(e) => setForm({ ...form, telefone: e.target.value })} className="bg-background/50 border-white/5" /></div>
          <div className="col-span-2 grid grid-cols-3 gap-3 border border-indigo-500/20 bg-indigo-500/5 p-4 rounded-xl relative mt-2">
            <div className="absolute -top-2.5 left-4 bg-background px-2 text-[10px] text-indigo-400 font-bold uppercase tracking-widest flex items-center gap-1"><BadgeDollarSign size={10} /> Impacto DRE Financeiro (Folha)</div>
            <div className="space-y-1.5"><Label className="text-xs font-medium text-muted-foreground">Data Admissão</Label><Input type="date" value={form.data_admissao} onChange={(e) => setForm({ ...form, data_admissao: e.target.value })} className="bg-background/50 border-white/10" /></div>
            <div className="space-y-1.5"><Label className="text-xs font-medium text-muted-foreground">Salário Fixo</Label><Input type="number" step="0.01" value={form.salario || ""} onChange={(e) => setForm({ ...form, salario: Number(e.target.value) })} placeholder="R$ 0,00" className="bg-background/50 border-white/10" /></div>
            <div className="space-y-1.5"><Label className="text-xs font-medium text-muted-foreground">Dia Acerto</Label><Input type="number" min="1" max="31" value={form.dia_vencimento} onChange={(e) => setForm({ ...form, dia_vencimento: e.target.value })} placeholder="Ex: 5" className="bg-background/50 border-white/10" /></div>
          </div>
        </div>
        <div className="flex gap-3 justify-end pt-2">
          <Button variant="ghost" onClick={onClose} className="hover:bg-muted/50">Cancelar Implantação</Button>
          <Button onClick={salvar} disabled={saving} className="bg-primary hover:bg-primary/90 text-primary-foreground shadow shadow-primary/20">{saving ? "Provisionando Integrações..." : "Cadastrar e Sincronizar"}</Button>
        </div>
      </motion.div>
    </motion.div>
  );
}

function EditModal({ empId, onClose, onSaved, sessionRole }: { empId: string; onClose: () => void; onSaved: () => void; sessionRole?: string }) {
  const cargosPermitidos = useCargosPermitidos(sessionRole);
  const [form, setForm] = useState({ nome: "", usuario: "", senha: "", cargo: "", email: "", telefone: "", data_admissao: "", salario: 0, dia_vencimento: "" });
  const [loadingForm, setLoadingForm] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    Promise.all([
      fetch(`/api/employees/${empId}`).then((r) => r.json()),
      fetch(`/api/employees/${empId}/folha`).then((r) => r.json()).catch(() => null),
    ]).then(([data, folha]) => {
      setForm({
        nome: data.nome || "", usuario: data.usuario || "", senha: data.senha_visivel || "",
        cargo: data.cargo || (data.role === "operacao" ? "Operações" : data.role === "sucesso" ? "Sucesso do Cliente" : data.role) || "",
        email: data.email || "", telefone: data.telefone || "", data_admissao: data.data_admissao || "",
        salario: folha?.valor || 0, dia_vencimento: folha?.dia_vencimento ? String(folha.dia_vencimento) : "",
      });
      setLoadingForm(false);
    });
  }, [empId]);

  const salvar = async () => {
    setSaving(true);
    const body: Record<string, string | number> = {
      nome: form.nome, usuario: form.usuario, cargo: form.cargo, role: cargoToRoleLogic(form.cargo),
      email: form.email, telefone: form.telefone, data_admissao: form.data_admissao,
      salario: Number(form.salario || 0), dia_vencimento: form.dia_vencimento,
    };
    if (form.senha) body.senha = form.senha;
    const res = await fetch(`/api/employees/${empId}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    if (data.error) toast.error(data.error);
    else { toast.success("Dossiê Sintetizado com Sucesso"); onSaved(); }
    setSaving(false);
  };

  if (loadingForm) return null;

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" onClick={onClose}>
      <motion.div initial={{ scale: 0.95, y: 10 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.95, y: 10 }} className="bg-card border border-white/10 rounded-2xl shadow-2xl p-6 w-full max-w-xl space-y-5" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-border/50 pb-3">
          <div>
            <h3 className="text-lg font-bold tracking-tight">Auditoria: <span className="text-primary">{form.nome}</span></h3>
          </div>
          <button onClick={onClose} className="p-2 bg-muted/50 hover:bg-muted rounded-full transition-colors"><X size={16} className="text-muted-foreground" /></button>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div className="col-span-2 space-y-1.5"><Label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Identificação</Label><Input value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} className="bg-background/50 border-white/5" /></div>
          <div className="space-y-1.5"><Label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Auth Alias</Label><Input value={form.usuario} onChange={(e) => setForm({ ...form, usuario: e.target.value.toLowerCase().trim() })} className="bg-background/50 border-white/5 font-mono" /></div>
          <div className="space-y-1.5"><Label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Recovery Password</Label><PasswordField value={form.senha} onChange={(v) => setForm({ ...form, senha: v })} placeholder="Vazio = não alterar" /></div>
          <div className="space-y-1.5"><Label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Vetor / Role</Label>
            <select value={form.cargo} onChange={(e) => setForm({ ...form, cargo: e.target.value })} className="w-full text-sm bg-background/50 border border-white/5 focus:ring-1 focus:ring-primary/50 rounded-lg px-3 py-2 outline-none">
              <option value="">— selecionar —</option>
              {cargosPermitidos.map((c) => <option key={c} value={c}>{c}</option>)}
              {form.cargo && !cargosPermitidos.includes(form.cargo) && <option value={form.cargo} disabled>{form.cargo} (Protegido Admin)</option>}
            </select>
          </div>
          <div className="space-y-1.5"><Label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Telefone</Label><Input value={form.telefone} onChange={(e) => setForm({ ...form, telefone: e.target.value })} className="bg-background/50 border-white/5 font-mono" /></div>

          <div className="col-span-2 grid grid-cols-3 gap-3 border border-emerald-500/20 bg-emerald-500/5 p-4 rounded-xl relative mt-2">
            <div className="absolute -top-2.5 left-4 bg-background px-2 text-[10px] text-emerald-500 font-bold uppercase tracking-widest flex items-center gap-1"><BadgeDollarSign size={10} /> Impacto DRE Financeiro (Folha)</div>
            <div className="space-y-1.5"><Label className="text-xs font-medium text-muted-foreground">Data Admissão</Label><Input type="date" value={form.data_admissao} onChange={(e) => setForm({ ...form, data_admissao: e.target.value })} className="bg-background/50 border-white/10" /></div>
            <div className="space-y-1.5"><Label className="text-xs font-medium text-muted-foreground">Salário Fixo Bruto</Label><Input type="number" step="0.01" value={form.salario || ""} onChange={(e) => setForm({ ...form, salario: Number(e.target.value) })} className="bg-background/50 border-white/10" /></div>
            <div className="space-y-1.5"><Label className="text-xs font-medium text-muted-foreground">Data Acerto</Label><Input type="number" min="1" max="31" value={form.dia_vencimento} onChange={(e) => setForm({ ...form, dia_vencimento: e.target.value })} className="bg-background/50 border-white/10" /></div>
          </div>
        </div>
        {form.senha === "comarka2026" && (
          <div className="text-[10px] text-yellow-400 bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-3 flex items-center gap-2 font-medium">
            <ShieldAlert size={14} className="shrink-0 animate-pulse" /> ⚠ O usuário encontra-se com a senha provisória de Backfill (comarka2026). Avise a central para resetar no primeiro login.
          </div>
        )}
        <div className="flex gap-3 justify-end pt-2">
          <Button variant="ghost" onClick={onClose} className="hover:bg-muted/50">Recuar</Button>
          <Button onClick={salvar} disabled={saving} className="bg-primary hover:bg-primary/90 text-primary-foreground shadow shadow-primary/20">{saving ? "Commitando BD..." : "Salvar Arquivo"}</Button>
        </div>
      </motion.div>
    </motion.div>
  );
}
