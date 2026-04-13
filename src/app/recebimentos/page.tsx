"use client";

import { useEffect, useState, useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { formatCurrency } from "@/lib/format";
import { toast } from "sonner";
import { EntradasResumoCards } from "@/components/financeiro/EntradasResumoCards";
import { EntradasTabela } from "@/components/financeiro/EntradasTabela";
import { NovoClienteModal } from "@/components/financeiro/NovoClienteModal";
import { MarcarPagoModal } from "@/components/financeiro/MarcarPagoModal";
import { Plus, Download, AlertTriangle, Clock, ChevronDown, ChevronRight, CheckCircle, Flame } from "lucide-react";
import { useEntradasSWR } from "@/hooks/use-financeiro-swr";
import { motion, AnimatePresence } from "framer-motion";

const MESES_SHORT = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

function buildMesesOptions(ano: number) {
  const labels: Record<string, string> = {};
  const options = ["tudo"];
  for (let i = 1; i <= 12; i++) {
    const key = `${ano}-${String(i).padStart(2, "0")}`;
    labels[key] = MESES_SHORT[i - 1];
    options.push(key);
  }
  return { labels, options };
}

export default function EntradasPage() {
  const [mounted, setMounted] = useState(false);
  const [ano, setAno] = useState(() => new Date().getFullYear());
  const [mes, setMes] = useState(() => new Date().toISOString().slice(0, 7));
  const [showNovo, setShowNovo] = useState(false);
  const [pagoInline, setPagoInline] = useState<any | null>(null);
  const [alertasAberto, setAlertasAberto] = useState(true);

  // Setup options once per year
  const { labels: MESES_LABELS, options: MESES_OPTIONS } = useMemo(() => buildMesesOptions(ano), [ano]);

  useEffect(() => { setMounted(true); }, []);

  const { clientes, resumo, isLoading, mutate } = useEntradasSWR(mes);

  // Process Warnings Only Once using useMemo
  const { inadimplentes, renovacao } = useMemo(() => {
    if (!clientes) return { inadimplentes: [], renovacao: [] };
    const hoje = new Date().getTime();

    const inap = clientes.filter((c: any) => c.pagamento_mes?.status === "atrasado" && c.status === "ativo");
    const ren = clientes.filter((c: any) => {
      const sf = c.status_financeiro || c.status;
      if (sf === "churned") return false;
      if (!c.fidelidade_fim) return false;
      const fim = new Date(c.fidelidade_fim).getTime();
      const dias = Math.ceil((fim - hoje) / (1000 * 60 * 60 * 24));
      return dias <= 30;
    }).sort((a: any, b: any) => new Date(a.fidelidade_fim).getTime() - new Date(b.fidelidade_fim).getTime());

    return { inadimplentes: inap, renovacao: ren };
  }, [clientes]);

  const totalAlertas = inadimplentes.length + renovacao.length;

  const exportarCsv = () => {
    const header = "Cliente,Plataforma,Valor,Closer,Contrato,Status,Pagamento";
    const rows = clientes.map((c: any) => {
      const pagStatus = c.pagamento_mes?.status || "—";
      const pagValor = c.pagamento_mes?.valor_pago ? formatCurrency(Number(c.pagamento_mes.valor_pago)) : "—";
      return `"${c.nome}",${c.plataforma},${c.valor_mensal},${c.closer},${c.tipo_contrato},${c.status},${pagStatus} ${pagValor}`;
    });
    const csv = [header, ...rows].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `entradas-${mes}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("CSV exportado com sucesso.");
  };

  if (!mounted || isLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-24 animate-in fade-in text-muted-foreground">
        <div className="w-8 h-8 rounded-full border-4 border-emerald-500/30 border-t-emerald-500 animate-spin mb-3" />
        <p className="text-xs uppercase tracking-widest font-bold">Apurando Entradas...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in slide-in-from-bottom-4 duration-700 fade-in">
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between bg-card/60 border border-border/50 p-6 rounded-2xl backdrop-blur-xl shadow-[0_4px_24px_-10px_rgba(0,0,0,0.1)] gap-6">
        <div>
          <h1 className="text-3xl font-black tracking-tighter flex items-center gap-2">Recebimentos CRM <CheckCircle size={24} className="text-emerald-500" /></h1>
          <p className="text-muted-foreground font-medium text-sm mt-1 max-w-[500px]">Fluxo principal dos caixas da agência baseando-se por renovações.</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 bg-muted/20 border border-border/40 p-1 rounded-xl">
            <button onClick={() => { setAno(ano - 1); setMes("tudo"); }} className="px-2 py-1 text-xs text-muted-foreground hover:text-foreground">←</button>
            <span className="text-sm font-black tracking-wider w-12 text-center font-mono">{ano}</span>
            <button onClick={() => { setAno(ano + 1); setMes("tudo"); }} className="px-2 py-1 text-xs text-muted-foreground hover:text-foreground">→</button>
          </div>
          <div className="flex bg-muted/20 border border-border/40 rounded-xl p-1 shadow-inner">
            {MESES_OPTIONS.map((m) => (
              <button key={m} onClick={() => setMes(m)}
                className={`px-3 py-1.5 text-[10px] font-black uppercase tracking-widest rounded-lg transition-all ${mes === m ? "bg-emerald-500 text-white shadow" : "text-muted-foreground hover:text-foreground hover:bg-muted/40"}`}>
                {m === "tudo" ? "Tudo" : (MESES_LABELS[m] || m)}
              </button>
            ))}
          </div>
          <div className="flex gap-2">
            <Button size="sm" onClick={() => setShowNovo(true)} className="bg-emerald-500 hover:bg-emerald-600 font-bold uppercase tracking-widest text-[10px]"><Plus size={14} className="mr-1" /> Cliente</Button>
            <Button size="sm" variant="outline" onClick={exportarCsv} className="border-border/40 shadow-sm font-bold uppercase tracking-widest text-[10px]"><Download size={14} className="mr-1" /> CSV</Button>
          </div>
        </div>
      </div>

      <EntradasResumoCards resumo={resumo} loading={isLoading} />

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        <div className="lg:col-span-3">
          <EntradasTabela clientes={clientes} mesReferencia={`${mes}-01`} onRefresh={mutate} />
        </div>

        {/* Alertas Column */}
        <div className="lg:col-span-1 space-y-4">
          {totalAlertas > 0 ? (
            <Card className="shadow-sm border border-border/40">
              <CardContent className="pt-4 pb-4">
                <button onClick={() => setAlertasAberto(!alertasAberto)} className="w-full flex items-center justify-between py-1 text-xs font-black uppercase tracking-widest text-destructive hover:opacity-80 transition-opacity">
                  <span className="flex items-center gap-2"><AlertTriangle size={16} /> Quarentena ({totalAlertas})</span>
                  {alertasAberto ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                </button>
                <AnimatePresence>
                  {alertasAberto && (
                    <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="pt-4 space-y-4 overflow-hidden">
                      {inadimplentes.length > 0 && (
                        <div className="space-y-2">
                          <p className="text-[10px] font-black uppercase tracking-widest text-red-500">{inadimplentes.length} Pendências Ativas</p>
                          {inadimplentes.map((c: any) => (
                            <div key={c.id} className="flex flex-col gap-2 p-3 border rounded-xl border-red-500/30 bg-red-500/10">
                              <div className="flex items-center justify-between">
                                <span className="text-xs font-bold text-red-100">{c.nome}</span>
                                <span className="text-xs text-red-400 font-mono font-black">{formatCurrency(c.valor_mensal)}</span>
                              </div>
                              <Button size="sm" className="w-full h-6 text-[10px] uppercase font-black tracking-widest bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500 hover:text-white transition-all shadow-none" onClick={() => setPagoInline(c)}>Quitar Débito</Button>
                            </div>
                          ))}
                        </div>
                      )}
                      {renovacao.length > 0 && (
                        <div className="space-y-2">
                          <p className="text-[10px] font-black uppercase tracking-widest text-yellow-500">{renovacao.length} Fidelidades Expirando</p>
                          {renovacao.map((c: any) => {
                            const dias = Math.ceil((new Date(c.fidelidade_fim).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24));
                            return (
                              <div key={c.id} className={`flex flex-col gap-2 p-3 border rounded-xl ${dias <= 0 ? "border-red-500/30 bg-red-500/10" : "border-yellow-500/30 bg-yellow-500/10"}`}>
                                <div className="flex items-center justify-between">
                                  <span className="text-xs font-bold text-slate-200">{c.nome}</span>
                                  <span className="text-xs text-muted-foreground font-mono">{formatCurrency(c.valor_mensal)}</span>
                                </div>
                                <Badge variant="outline" className={`justify-center font-mono text-[9px] uppercase tracking-widest ${dias <= 0 ? "text-red-400 border-red-500/40" : "text-yellow-400 border-yellow-500/40"}`}>
                                  {dias <= 0 ? "Expirou Agora" : `${dias} Dias Faltando`}
                                </Badge>
                              </div>
                            )
                          })}
                        </div>
                      )}
                    </motion.div>
                  )}
                </AnimatePresence>
              </CardContent>
            </Card>
          ) : (
            <div className="h-32 rounded-2xl border border-dashed border-border/50 flex flex-col items-center justify-center text-muted-foreground bg-green-500/5">
              <Flame size={24} className="opacity-50 text-emerald-500 mb-2" />
              <p className="text-[10px] uppercase font-black tracking-widest">Nenhuma Ameaça Encontrada</p>
            </div>
          )}
        </div>
      </div>

      {showNovo && <NovoClienteModal onSaved={() => { setShowNovo(false); mutate(); }} onClose={() => setShowNovo(false)} />}
      {pagoInline && <MarcarPagoModal clienteId={pagoInline.id} clienteNome={pagoInline.nome} valorMensal={pagoInline.valor_mensal} mesReferencia={`${mes}-01`} onSaved={() => { setPagoInline(null); mutate(); }} onClose={() => setPagoInline(null)} />}
    </div>
  );
}
