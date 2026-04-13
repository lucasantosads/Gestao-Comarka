"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { CurrencyInput } from "@/components/currency-input";
import { formatCurrency } from "@/lib/format";
import { toast } from "sonner";
import { ArrowLeft, Send, Save } from "lucide-react";
import Link from "next/link";

interface Employee {
  id: string; nome: string; usuario: string; role: string;
  entity_id: string | null; ativo: boolean; telefone: string | null;
  data_admissao: string | null;
  cargo_nivel?: "jr" | "pleno" | "sr" | null;
  is_gestor_trafego?: boolean;
  is_head_operacional?: boolean;
}

const MESES_LABELS = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

export default function EmployeeDetailPage() {
  const { id } = useParams();
  const [emp, setEmp] = useState<Employee | null>(null);
  const [tab, setTab] = useState<"compensacao" | "notificar" | "comarka-pro">("compensacao");
  const [cpSaving, setCpSaving] = useState(false);
  const [cpPontos, setCpPontos] = useState<{ pontos_finais: number; meses_sequencia: number } | null>(null);
  const [mes, setMes] = useState(() => new Date().toISOString().slice(0, 7));
  const [compForm, setCompForm] = useState({
    salario_base: 0, comissao_percentual: 0, comissao_base: "mrr",
    bonus_meta_atingida: 0, bonus_meta_superada_pct: 0, ote: 0,
    vale_alimentacao: 0, vale_transporte: 0, outros_beneficios: 0,
    descricao_beneficios: "",
  });
  const [compLoading, setCompLoading] = useState(true);
  const [compSaving, setCompSaving] = useState(false);
  const [compResult, setCompResult] = useState<Record<string, unknown> | null>(null);
  const [notifTitulo, setNotifTitulo] = useState("");
  const [notifMsg, setNotifMsg] = useState("");
  const [notifSending, setNotifSending] = useState(false);

  useEffect(() => {
    fetch(`/api/employees/${id}`).then((r) => r.json()).then(setEmp);
  }, [id]);

  useEffect(() => {
    if (!emp) return;
    setCompLoading(true);
    // Carregar config de compensação + salário base de folha_pagamento (fonte única)
    Promise.all([
      fetch(`/api/compensation/config?employee_id=${emp.id}&mes=${mes}`).then((r) => r.json()),
      fetch(`/api/financeiro/custos-fixos`).then((r) => r.json()),
    ]).then(([data, custos]) => {
      // Pegar salário base do folha_pagamento por nome
      const folhaItem = custos?.folha?.itens?.find((f: { nome: string }) =>
        f.nome.trim().toLowerCase() === emp.nome.trim().toLowerCase()
      );
      const salarioFolha = folhaItem ? Number(folhaItem.valor || 0) : 0;

      if (Array.isArray(data) && data.length > 0) {
        const c = data[0];
        setCompForm({
          salario_base: salarioFolha || c.salario_base || 0,
          comissao_percentual: c.comissao_percentual || 0,
          comissao_base: c.comissao_base || "mrr", bonus_meta_atingida: c.bonus_meta_atingida || 0,
          bonus_meta_superada_pct: c.bonus_meta_superada_pct || 0, ote: c.ote || 0,
          vale_alimentacao: c.vale_alimentacao || 0, vale_transporte: c.vale_transporte || 0,
          outros_beneficios: c.outros_beneficios || 0, descricao_beneficios: c.descricao_beneficios || "",
        });
      } else {
        setCompForm({ salario_base: salarioFolha, comissao_percentual: 0, comissao_base: "mrr", bonus_meta_atingida: 0, bonus_meta_superada_pct: 0, ote: 0, vale_alimentacao: 0, vale_transporte: 0, outros_beneficios: 0, descricao_beneficios: "" });
      }
    }).finally(() => setCompLoading(false));

    // Calcular compensação atual
    fetch(`/api/compensation/calculate?employee_id=${emp.id}&mes=${mes}`)
      .then((r) => r.ok ? r.json() : null)
      .then((data) => { if (data && !data.error) setCompResult(data); else setCompResult(null); });
  }, [emp, mes]);

  const salvarComp = async () => {
    if (!emp) return;
    setCompSaving(true);
    const res = await fetch("/api/compensation/config", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ employee_id: emp.id, mes_referencia: mes, ...compForm }),
    });
    const data = await res.json();
    if (data.error) toast.error(data.error);
    else toast.success("Compensação salva");
    setCompSaving(false);
  };

  const enviarNotif = async () => {
    if (!emp || !notifTitulo) { toast.error("Título obrigatório"); return; }
    setNotifSending(true);
    const res = await fetch("/api/notifications", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ employee_id: emp.id, titulo: notifTitulo, mensagem: notifMsg, tipo: "mensagem_admin" }),
    });
    if (res.ok) { toast.success(`Notificação enviada para ${emp.nome}`); setNotifTitulo(""); setNotifMsg(""); }
    else toast.error("Erro ao enviar");
    setNotifSending(false);
  };

  if (!emp) return <div className="h-64 flex items-center justify-center text-muted-foreground">Carregando...</div>;

  const ROLE_BADGE: Record<string, { label: string; color: string }> = {
    admin: { label: "Admin", color: "bg-red-500/15 text-red-400" },
    closer: { label: "Closer", color: "bg-green-500/15 text-green-400" },
    sdr: { label: "SDR", color: "bg-blue-500/15 text-blue-400" },
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/equipe"><Button variant="ghost" size="sm"><ArrowLeft size={14} /></Button></Link>
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center text-lg font-bold">{emp.nome.charAt(0)}</div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold">{emp.nome}</h1>
              <Badge className={`text-[9px] ${ROLE_BADGE[emp.role]?.color}`}>{ROLE_BADGE[emp.role]?.label}</Badge>
              {!emp.ativo && <Badge className="text-[8px] bg-muted">Arquivado</Badge>}
            </div>
            <p className="text-xs text-muted-foreground">@{emp.usuario}{emp.telefone ? ` • ${emp.telefone}` : ""}{emp.data_admissao ? ` • Desde ${new Date(emp.data_admissao).toLocaleDateString("pt-BR")}` : ""}</p>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-muted rounded-lg p-0.5 w-fit">
        <button onClick={() => setTab("compensacao")} className={`px-3 py-1.5 text-xs font-medium rounded-md ${tab === "compensacao" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground"}`}>Compensacao</button>
        <button onClick={() => setTab("notificar")} className={`px-3 py-1.5 text-xs font-medium rounded-md ${tab === "notificar" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground"}`}>Notificar</button>
        <button onClick={() => setTab("comarka-pro")} className={`px-3 py-1.5 text-xs font-medium rounded-md ${tab === "comarka-pro" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground"}`}>Comarka Pro</button>
      </div>

      {tab === "compensacao" && (
        <>
          {/* Mes selector */}
          <div className="flex bg-muted rounded-lg p-0.5 w-fit">
            {MESES_LABELS.map((label, i) => {
              const m = `2026-${String(i + 1).padStart(2, "0")}`;
              return (
                <button key={m} onClick={() => setMes(m)}
                  className={`px-2 py-1 text-[10px] font-medium rounded-md ${mes === m ? "bg-background text-foreground shadow-sm" : "text-muted-foreground"}`}>
                  {label}
                </button>
              );
            })}
          </div>

          {/* Resultado atual */}
          {compResult && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <Card className="border-green-500/20"><CardContent className="pt-3 pb-2"><p className="text-[10px] text-muted-foreground">Comissao</p><p className="text-lg font-bold text-green-400">{formatCurrency(compResult.comissao_calculada as number)}</p></CardContent></Card>
              <Card><CardContent className="pt-3 pb-2"><p className="text-[10px] text-muted-foreground">Bonus</p><p className="text-lg font-bold text-yellow-400">{formatCurrency(compResult.bonus as number)}</p></CardContent></Card>
              <Card><CardContent className="pt-3 pb-2"><p className="text-[10px] text-muted-foreground">Contratos</p><p className="text-lg font-bold">{compResult.contratos as number}</p></CardContent></Card>
              <Card className="border-foreground/20"><CardContent className="pt-3 pb-2"><p className="text-[10px] text-muted-foreground">Total Bruto</p><p className="text-lg font-bold">{formatCurrency(compResult.total_bruto as number)}</p></CardContent></Card>
            </div>
          )}

          {/* Form de configuração */}
          <Card>
            <CardHeader><CardTitle className="text-sm">Configurar Compensacao — {MESES_LABELS[parseInt(mes.slice(5)) - 1]}</CardTitle></CardHeader>
            <CardContent>
              {compLoading ? <div className="h-20 bg-muted animate-pulse rounded" /> : (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    <div className="space-y-1">
                      <Label className="text-xs flex items-center gap-1">Salario Base 🔒</Label>
                      <div className="h-9 px-3 py-2 text-sm bg-muted/30 border rounded-lg font-mono text-muted-foreground">
                        {compForm.salario_base > 0 ? compForm.salario_base.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }) : "—"}
                      </div>
                      <p className="text-[9px] text-muted-foreground">Editar em <a href="/custos-fixos" className="text-blue-400 hover:underline">Custos Fixos → Folha</a></p>
                    </div>
                    <div className="space-y-1"><Label className="text-xs">Comissao %</Label><Input type="number" step="0.5" value={compForm.comissao_percentual} onChange={(e) => setCompForm({ ...compForm, comissao_percentual: Number(e.target.value) })} /></div>
                    <div className="space-y-1"><Label className="text-xs">Base da Comissao</Label>
                      <select value={compForm.comissao_base} onChange={(e) => setCompForm({ ...compForm, comissao_base: e.target.value })} className="w-full text-sm bg-transparent border rounded-lg px-3 py-2">
                        <option value="mrr">MRR</option><option value="valor_total">Valor Total (LTV)</option><option value="valor_entrada">Valor Entrada</option>
                      </select>
                    </div>
                    <div className="space-y-1"><Label className="text-xs">Bonus Meta Atingida</Label><CurrencyInput value={compForm.bonus_meta_atingida} onChange={(v) => setCompForm({ ...compForm, bonus_meta_atingida: v })} /></div>
                    <div className="space-y-1"><Label className="text-xs">Bonus Extra % (acima meta)</Label><Input type="number" step="1" value={compForm.bonus_meta_superada_pct} onChange={(e) => setCompForm({ ...compForm, bonus_meta_superada_pct: Number(e.target.value) })} /></div>
                    <div className="space-y-1"><Label className="text-xs">OTE</Label><CurrencyInput value={compForm.ote} onChange={(v) => setCompForm({ ...compForm, ote: v })} /></div>
                  </div>
                  <div className="border-t pt-3">
                    <p className="text-xs font-medium mb-2">Beneficios</p>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                      <div className="space-y-1"><Label className="text-xs">VA</Label><CurrencyInput value={compForm.vale_alimentacao} onChange={(v) => setCompForm({ ...compForm, vale_alimentacao: v })} /></div>
                      <div className="space-y-1"><Label className="text-xs">VT</Label><CurrencyInput value={compForm.vale_transporte} onChange={(v) => setCompForm({ ...compForm, vale_transporte: v })} /></div>
                      <div className="space-y-1"><Label className="text-xs">Outros</Label><CurrencyInput value={compForm.outros_beneficios} onChange={(v) => setCompForm({ ...compForm, outros_beneficios: v })} /></div>
                      <div className="space-y-1"><Label className="text-xs">Descricao</Label><Input value={compForm.descricao_beneficios} onChange={(e) => setCompForm({ ...compForm, descricao_beneficios: e.target.value })} placeholder="Plano saude, etc" /></div>
                    </div>
                  </div>
                  <Button size="sm" onClick={salvarComp} disabled={compSaving}>
                    <Save size={14} className="mr-1" />{compSaving ? "Salvando..." : "Salvar Compensacao"}
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}

      {tab === "comarka-pro" && emp && (
        <Card>
          <CardHeader><CardTitle className="text-sm">Comarka Pro — configuração do colaborador</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Nível do cargo</Label>
                <select
                  value={emp.cargo_nivel || ""}
                  onChange={(e) => setEmp({ ...emp, cargo_nivel: (e.target.value || null) as Employee["cargo_nivel"] })}
                  className="w-full text-sm bg-transparent border rounded-lg px-3 py-2"
                >
                  <option value="">—</option>
                  <option value="jr">Junior</option>
                  <option value="pleno">Pleno</option>
                  <option value="sr">Senior</option>
                </select>
              </div>
              <label className="flex items-center gap-2 pt-6">
                <input type="checkbox" checked={!!emp.is_gestor_trafego}
                  onChange={(e) => setEmp({ ...emp, is_gestor_trafego: e.target.checked })} />
                <span className="text-xs">É gestor de tráfego (entra no ranking)</span>
              </label>
              <label className="flex items-center gap-2 pt-6">
                <input type="checkbox" checked={!!emp.is_head_operacional}
                  onChange={(e) => setEmp({ ...emp, is_head_operacional: e.target.checked })} />
                <span className="text-xs">É head operacional (pode aprovar/lançar pontos)</span>
              </label>
            </div>
            <Button size="sm" disabled={cpSaving} onClick={async () => {
              setCpSaving(true);
              const res = await fetch(`/api/employees/${emp.id}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  cargo_nivel: emp.cargo_nivel,
                  is_gestor_trafego: !!emp.is_gestor_trafego,
                  is_head_operacional: !!emp.is_head_operacional,
                }),
              });
              if (res.ok) toast.success("Configuração Comarka Pro salva");
              else toast.error("Erro ao salvar");
              setCpSaving(false);
            }}>
              <Save size={14} className="mr-1" />{cpSaving ? "Salvando..." : "Salvar"}
            </Button>

            {emp.is_gestor_trafego && (
              <div className="border-t pt-4 space-y-2">
                <p className="text-xs font-medium">Pontuação atual do mês</p>
                <Button size="sm" variant="outline" onClick={async () => {
                  const r = await fetch(`/api/comarka-pro/ranking?periodo=mensal`, { credentials: "include" });
                  const d = await r.json();
                  const linha = (d.ranking || []).find((l: { colaborador_id: string }) => l.colaborador_id === emp.id);
                  if (linha) setCpPontos(linha);
                  else toast.message("Sem pontos registrados este mês");
                }}>
                  Carregar pontos do mês
                </Button>
                {cpPontos && (
                  <div className="text-sm text-muted-foreground">
                    {cpPontos.pontos_finais} pts · {cpPontos.meses_sequencia} mês(es) consecutivos
                  </div>
                )}
                <Link href="/time/comarka-pro/admin" className="text-xs text-blue-400 hover:underline block">
                  Abrir admin Comarka Pro →
                </Link>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {tab === "notificar" && (
        <Card>
          <CardHeader><CardTitle className="text-sm">Enviar Notificacao para {emp.nome}</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-1"><Label className="text-xs">Titulo</Label><Input value={notifTitulo} onChange={(e) => setNotifTitulo(e.target.value)} placeholder="Assunto da notificacao" /></div>
            <div className="space-y-1"><Label className="text-xs">Mensagem</Label><Input value={notifMsg} onChange={(e) => setNotifMsg(e.target.value)} placeholder="Detalhes (opcional)" /></div>
            <Button size="sm" onClick={enviarNotif} disabled={notifSending}>
              <Send size={14} className="mr-1" />{notifSending ? "Enviando..." : "Enviar"}
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
