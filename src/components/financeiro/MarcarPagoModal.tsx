"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CurrencyInput } from "@/components/currency-input";
import { formatCurrency } from "@/lib/format";
import { toast } from "sonner";
import { X, AlertTriangle, Check, Gift } from "lucide-react";

const MESES_LABELS = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

interface PagamentoMes {
  mes: string; status: string; valor_pago: number | null; dia_pagamento: number | null;
}

interface Props {
  clienteId: string; clienteNome: string; valorMensal: number;
  mesReferencia: string; onSaved: () => void; onClose: () => void;
  pagamentoAtual?: { status: string | null; valor_pago: number | null; dia_pagamento: number | null; justificativa?: string | null; mes_pagamento?: string | null };
  pagamentosTodos?: PagamentoMes[];
  mesFechamento?: string | null;
  statusFinanceiro?: string | null;
}

// Status que NÃO geram cobrança mensal recorrente — alinhado com /api/financeiro/entradas
// (linhas 70 e 102: só `status_financeiro = 'ativo'` entra em ativosRecorrentes/inadimplentes).
const STATUS_NAO_RECORRENTE = new Set(["pagou_integral", "parceria", "pausado", "churned"]);
// Status de uma row de pagamento que conta como "mês resolvido" (não pendente)
const STATUS_PAG_RESOLVIDO = new Set(["pago", "perdoado", "parceria", "pagou_integral", "pausado"]);

function getMesesPendentes(
  mesReferencia: string,
  pagamentosTodos?: PagamentoMes[],
  mesFechamento?: string | null,
  statusFinanceiro?: string | null,
): string[] {
  // Cliente não-recorrente (integral/parceria/pausado/churned) nunca tem pendência mensal.
  // Mesmo critério usado no card de Inadimplentes em /entradas.
  if (statusFinanceiro && STATUS_NAO_RECORRENTE.has(statusFinanceiro)) return [];
  if (!pagamentosTodos && !mesFechamento) return [];

  const [anoRef, mesRef] = mesReferencia.slice(0, 7).split("-").map(Number);
  const pendentes: string[] = [];

  // Checar os 12 meses do ano atual até o mês anterior ao de referência
  for (let m = 1; m < mesRef; m++) {
    const mesStr = `${anoRef}-${String(m).padStart(2, "0")}`;
    const mesDate = `${mesStr}-01`;

    // Pular meses antes do fechamento do cliente
    if (mesFechamento && mesFechamento > mesDate) continue;

    const pag = pagamentosTodos?.find((p) => p.mes.slice(0, 7) === mesStr);
    // Sem row OU row com status que não conta como resolvido → pendente
    if (!pag || !STATUS_PAG_RESOLVIDO.has(pag.status)) {
      pendentes.push(mesStr);
    }
  }

  return pendentes;
}

function formatMesLabel(mes: string): string {
  const [, m] = mes.split("-").map(Number);
  return MESES_LABELS[m - 1] || mes;
}

export function MarcarPagoModal({ clienteId, clienteNome, valorMensal, mesReferencia, onSaved, onClose, pagamentoAtual, pagamentosTodos, mesFechamento, statusFinanceiro }: Props) {
  const hoje = new Date();
  const isEdicao = pagamentoAtual?.status === "pago" || pagamentoAtual?.status === "perdoado";
  const [valor, setValor] = useState(isEdicao && pagamentoAtual?.valor_pago ? pagamentoAtual.valor_pago : valorMensal);
  const [dia, setDia] = useState(isEdicao && pagamentoAtual?.dia_pagamento ? pagamentoAtual.dia_pagamento : hoje.getDate());
  const [mesPag, setMesPag] = useState(isEdicao && pagamentoAtual?.mes_pagamento ? pagamentoAtual.mes_pagamento : `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, "0")}`);
  const [tipo, setTipo] = useState<"pago" | "perdoado">(isEdicao && pagamentoAtual?.status === "perdoado" ? "perdoado" : "pago");
  const [justificativa, setJustificativa] = useState(isEdicao && pagamentoAtual?.justificativa ? pagamentoAtual.justificativa : "");
  const [saving, setSaving] = useState(false);

  // Pendências anteriores
  const mesesPendentes = !isEdicao ? getMesesPendentes(mesReferencia, pagamentosTodos, mesFechamento, statusFinanceiro) : [];
  const temPendencias = mesesPendentes.length > 0;
  const [pendenciaAcoes, setPendenciaAcoes] = useState<Record<string, "pagar" | "perdoar" | "ignorar">>({});
  const [pendenciaJustificativas, setPendenciaJustificativas] = useState<Record<string, string>>({});
  const [pendenciaValores, setPendenciaValores] = useState<Record<string, number>>(() => {
    const v: Record<string, number> = {};
    mesesPendentes.forEach((m) => { v[m] = valorMensal; });
    return v;
  });

  const salvarPagamento = async (cId: string, mesRef: string, vPago: number, dPag: number, st: string, just?: string, mPag?: string) => {
    return fetch("/api/financeiro/entradas/pagamento", {
      method: "PUT", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        cliente_id: cId, mes_referencia: mesRef,
        valor_pago: st === "perdoado" ? 0 : vPago,
        dia_pagamento: dPag,
        status: st,
        justificativa: st === "perdoado" ? (just || null) : undefined,
        mes_pagamento: mPag,
      }),
    });
  };

  const salvar = async () => {
    setSaving(true);

    // Primeiro resolver pendências
    for (const mesPend of mesesPendentes) {
      const acao = pendenciaAcoes[mesPend];
      if (!acao || acao === "ignorar") continue;

      const res = await salvarPagamento(
        clienteId,
        `${mesPend}-01`,
        acao === "pagar" ? (pendenciaValores[mesPend] || valorMensal) : 0,
        dia,
        acao === "pagar" ? "pago" : "perdoado",
        acao === "perdoar" ? (pendenciaJustificativas[mesPend] || "Perdoado ao regularizar") : undefined,
        mesPag,
      );
      const data = await res.json();
      if (data.error) {
        toast.error(`Erro em ${formatMesLabel(mesPend)}: ${data.error}`);
        setSaving(false);
        return;
      }
    }

    // Depois salvar o pagamento principal
    const res = await salvarPagamento(clienteId, mesReferencia, valor, dia, tipo, justificativa, mesPag);
    const data = await res.json();
    if (data.error) toast.error(data.error);
    else {
      const pendResolvidas = mesesPendentes.filter((m) => pendenciaAcoes[m] && pendenciaAcoes[m] !== "ignorar").length;
      const msg = pendResolvidas > 0
        ? `${clienteNome}: ${tipo === "perdoado" ? "Perdoado" : "Pago"} + ${pendResolvidas} pendencia(s) resolvida(s)`
        : `${clienteNome}: ${tipo === "perdoado" ? "Perdoado" : "Pago"}`;
      toast.success(msg);
      onSaved();
    }
    setSaving(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onClose}>
      <div className={`bg-card border rounded-xl shadow-2xl p-6 w-full ${temPendencias ? "max-w-lg" : "max-w-sm"} space-y-4 max-h-[90vh] overflow-y-auto`} onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold">{isEdicao ? "Editar Pagamento" : "Confirmar Pagamento"}</h3>
          <button onClick={onClose}><X size={16} className="text-muted-foreground" /></button>
        </div>
        <p className="text-xs text-muted-foreground">{clienteNome} — {mesReferencia.slice(0, 7)}</p>

        {/* Alerta de pendências */}
        {temPendencias && (
          <div className="rounded-lg border border-red-500/30 bg-red-500/5 p-3 space-y-3">
            <div className="flex items-start gap-2">
              <AlertTriangle size={16} className="text-red-400 mt-0.5 shrink-0" />
              <div>
                <p className="text-xs font-semibold text-red-400">
                  {mesesPendentes.length === 1 ? "Pendencia encontrada" : `${mesesPendentes.length} pendencias encontradas`}
                </p>
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  Este cliente tem {mesesPendentes.length === 1 ? "1 mes" : `${mesesPendentes.length} meses`} anterior{mesesPendentes.length > 1 ? "es" : ""} sem pagamento. Escolha o que fazer com cada um:
                </p>
              </div>
            </div>

            <div className="space-y-2">
              {mesesPendentes.map((mesPend) => {
                const acao = pendenciaAcoes[mesPend] || "ignorar";
                return (
                  <div key={mesPend} className="rounded-md border border-muted p-2.5 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-medium">{formatMesLabel(mesPend)} — {formatCurrency(valorMensal)}</span>
                    </div>
                    <div className="flex gap-1.5">
                      <button onClick={() => setPendenciaAcoes((p) => ({ ...p, [mesPend]: "pagar" }))}
                        className={`flex-1 flex items-center justify-center gap-1 py-1.5 text-[10px] rounded-md border transition-colors ${acao === "pagar" ? "bg-green-500/15 border-green-500/30 text-green-400 font-medium" : "text-muted-foreground hover:text-foreground"}`}>
                        <Check size={10} /> Pagar
                      </button>
                      <button onClick={() => setPendenciaAcoes((p) => ({ ...p, [mesPend]: "perdoar" }))}
                        className={`flex-1 flex items-center justify-center gap-1 py-1.5 text-[10px] rounded-md border transition-colors ${acao === "perdoar" ? "bg-purple-500/15 border-purple-500/30 text-purple-400 font-medium" : "text-muted-foreground hover:text-foreground"}`}>
                        <Gift size={10} /> Perdoar
                      </button>
                      <button onClick={() => setPendenciaAcoes((p) => ({ ...p, [mesPend]: "ignorar" }))}
                        className={`flex-1 flex items-center justify-center gap-1 py-1.5 text-[10px] rounded-md border transition-colors ${acao === "ignorar" ? "bg-muted text-foreground font-medium" : "text-muted-foreground hover:text-foreground"}`}>
                        Ignorar
                      </button>
                    </div>
                    {acao === "pagar" && (
                      <div className="space-y-1">
                        <Label className="text-[10px]">Valor</Label>
                        <CurrencyInput value={pendenciaValores[mesPend] || valorMensal} onChange={(v) => setPendenciaValores((p) => ({ ...p, [mesPend]: v }))} />
                      </div>
                    )}
                    {acao === "perdoar" && (
                      <div className="space-y-1">
                        <Label className="text-[10px]">Justificativa</Label>
                        <Input className="h-7 text-xs" value={pendenciaJustificativas[mesPend] || ""} onChange={(e) => setPendenciaJustificativas((p) => ({ ...p, [mesPend]: e.target.value }))} placeholder="Ex: acordo, cortesia..." />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Separador visual quando tem pendências */}
        {temPendencias && (
          <div className="flex items-center gap-2">
            <div className="h-px flex-1 bg-border" />
            <span className="text-[10px] text-muted-foreground font-medium">Pagamento de {formatMesLabel(mesReferencia.slice(0, 7))}</span>
            <div className="h-px flex-1 bg-border" />
          </div>
        )}

        <div className="space-y-3">
          <div className="flex gap-2">
            <button onClick={() => setTipo("pago")} className={`flex-1 py-2 text-xs rounded-lg border transition-colors ${tipo === "pago" ? "bg-green-500/15 border-green-500/30 text-green-400 font-medium" : "text-muted-foreground"}`}>Pago</button>
            <button onClick={() => setTipo("perdoado")} className={`flex-1 py-2 text-xs rounded-lg border transition-colors ${tipo === "perdoado" ? "bg-purple-500/15 border-purple-500/30 text-purple-400 font-medium" : "text-muted-foreground"}`}>Perdoado</button>
          </div>
          {tipo === "pago" && (
            <div className="space-y-1">
              <Label className="text-xs">Valor pago</Label>
              <CurrencyInput value={valor} onChange={setValor} />
            </div>
          )}
          {tipo === "perdoado" && (
            <div className="space-y-1">
              <Label className="text-xs">Justificativa do perdao</Label>
              <Input value={justificativa} onChange={(e) => setJustificativa(e.target.value)} placeholder="Ex: cortesia, acordo, etc." />
            </div>
          )}
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <Label className="text-xs">Dia</Label>
              <Input type="number" min={1} max={31} value={dia} onChange={(e) => setDia(Number(e.target.value))} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Mes do pagamento</Label>
              <Input type="month" value={mesPag} onChange={(e) => setMesPag(e.target.value)} />
            </div>
          </div>
        </div>
        <Button className="w-full" onClick={salvar} disabled={saving}>{saving ? "Salvando..." : isEdicao ? "Salvar Alteracao" : "Confirmar Pagamento"}</Button>
      </div>
    </div>
  );
}
