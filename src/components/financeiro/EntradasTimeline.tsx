"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { formatCurrency } from "@/lib/format";
import { Check, Clock, AlertTriangle, Minus, Heart, Handshake } from "lucide-react";

const MESES = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

interface Pagamento { mes_referencia: string; valor_pago: number | null; status: string; justificativa?: string | null }

export function EntradasTimeline({ clienteId, ano }: { clienteId: string; ano?: number }) {
  const [pagamentos, setPagamentos] = useState<Pagamento[]>([]);
  const [loading, setLoading] = useState(true);
  const anoRef = ano || new Date().getFullYear();

  useEffect(() => {
    supabase.from("pagamentos_mensais").select("mes_referencia,valor_pago,status,justificativa")
      .eq("cliente_id", clienteId)
      .gte("mes_referencia", `${anoRef}-01-01`)
      .lte("mes_referencia", `${anoRef}-12-01`)
      .order("mes_referencia")
      .then(({ data }) => { setPagamentos((data || []) as Pagamento[]); setLoading(false); });
  }, [clienteId, anoRef]);

  if (loading) return <div className="h-10 bg-muted animate-pulse rounded" />;

  const pagMap = new Map(pagamentos.map((p) => [p.mes_referencia.slice(5, 7), p]));
  const totalPago = pagamentos.filter((p) => p.status === "pago").reduce((s, p) => s + Number(p.valor_pago || 0), 0);
  const mesesPagos = pagamentos.filter((p) => p.status === "pago").length;
  const mesesInadimplentes = pagamentos.filter((p) => p.status === "atrasado").length;

  return (
    <div className="space-y-2">
      <div className="flex gap-1">
        {MESES.map((label, i) => {
          const mesKey = String(i + 1).padStart(2, "0");
          const pag = pagMap.get(mesKey);
          let bg = "bg-muted/50"; let icon = <Minus size={10} className="text-muted-foreground" />;
          if (pag?.status === "pago") { bg = "bg-green-500/20"; icon = <Check size={10} className="text-green-400" />; }
          else if (pag?.status === "perdoado") { bg = "bg-purple-500/20"; icon = <Heart size={10} className="text-purple-400" />; }
          else if (pag?.status === "parceria") { bg = "bg-purple-500/20"; icon = <Handshake size={10} className="text-purple-400" />; }
          else if (pag?.status === "atrasado") { bg = "bg-red-500/20"; icon = <AlertTriangle size={10} className="text-red-400" />; }
          else if (pag?.status === "pendente") { bg = "bg-yellow-500/20"; icon = <Clock size={10} className="text-yellow-400" />; }

          return (
            <div key={mesKey} className={`flex-1 rounded p-1.5 text-center ${bg}`} title={pag ? `${label}: ${pag.status}${pag.status === "perdoado" && pag.justificativa ? ` (${pag.justificativa})` : ""} — R$ ${Number(pag.valor_pago || 0).toFixed(0)}` : `${label}: sem registro`}>
              <div className="flex justify-center mb-0.5">{icon}</div>
              <p className="text-[8px] text-muted-foreground">{label}</p>
            </div>
          );
        })}
      </div>
      <div className="flex gap-3 text-[10px] text-muted-foreground">
        <span>Total pago: <strong className="text-foreground">{formatCurrency(totalPago)}</strong></span>
        <span>Meses pagos: <strong>{mesesPagos}</strong></span>
        {mesesInadimplentes > 0 && <span className="text-red-400">Inadimplencia: <strong>{mesesInadimplentes} meses</strong></span>}
      </div>
    </div>
  );
}
