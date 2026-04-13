"use client";

import { useEffect, useState, useRef } from "react";
import { supabase } from "@/lib/supabase";
import { AlertTriangle, XCircle, Database, Shield, X } from "lucide-react";
import Link from "next/link";

interface Alerta {
  tipo: "offline" | "erro_critico" | "backup_falhou" | "rate_limit";
  mensagem: string;
  count?: number;
}

export function SistemaAlertas() {
  const [alertas, setAlertas] = useState<Alerta[]>([]);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    async function check() {
      const lista: Alerta[] = [];

      // 1. Integrações offline
      const { data: offlines } = await supabase
        .from("sistema_integracao_status")
        .select("nome")
        .eq("status", "offline");
      if (offlines && offlines.length > 0) {
        lista.push({
          tipo: "offline",
          mensagem: `${offlines.length} integração(ões) offline: ${offlines.map((o) => o.nome).join(", ")}`,
          count: offlines.length,
        });
      }

      // 2. Erros pendentes com >= 2 tentativas
      const { count: errosCriticos } = await supabase
        .from("sistema_fila_erros")
        .select("id", { count: "exact", head: true })
        .eq("status", "pendente")
        .gte("tentativas", 2);
      if (errosCriticos && errosCriticos > 0) {
        lista.push({
          tipo: "erro_critico",
          mensagem: `${errosCriticos} erro(s) pendente(s) com 2+ tentativas`,
          count: errosCriticos,
        });
      }

      // 3. Backup falhou ou atrasado (> 25h)
      const { data: ultimoBackup } = await supabase
        .from("sistema_backups")
        .select("status, iniciado_em")
        .order("iniciado_em", { ascending: false })
        .limit(1)
        .single();
      if (ultimoBackup) {
        if (ultimoBackup.status === "falhou") {
          lista.push({ tipo: "backup_falhou", mensagem: "Último backup falhou" });
        } else {
          const horas = (Date.now() - new Date(ultimoBackup.iniciado_em).getTime()) / 3600000;
          if (horas > 25) {
            lista.push({ tipo: "backup_falhou", mensagem: `Backup atrasado (${Math.round(horas)}h)` });
          }
        }
      } else {
        lista.push({ tipo: "backup_falhou", mensagem: "Nenhum backup encontrado" });
      }

      // 4. Rate limit > 90%
      const umaHoraAtras = new Date(Date.now() - 3600000).toISOString();
      const { data: rateLimits } = await supabase
        .from("sistema_rate_limit_log")
        .select("pct_utilizado, servico")
        .gte("data_hora", umaHoraAtras)
        .gt("pct_utilizado", 90);
      if (rateLimits && rateLimits.length > 0) {
        lista.push({
          tipo: "rate_limit",
          mensagem: `Rate limit > 90% em: ${rateLimits.map((r) => r.servico).join(", ")}`,
          count: rateLimits.length,
        });
      }

      setAlertas(lista);
    }

    check();
    const interval = setInterval(check, 60000);
    return () => clearInterval(interval);
  }, []);

  // Fechar dropdown ao clicar fora
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  if (alertas.length === 0) return null;

  const total = alertas.reduce((s, a) => s + (a.count || 1), 0);

  const ICON_MAP = {
    offline: <XCircle size={12} className="text-red-400 shrink-0" />,
    erro_critico: <AlertTriangle size={12} className="text-orange-400 shrink-0" />,
    backup_falhou: <Database size={12} className="text-red-400 shrink-0" />,
    rate_limit: <Shield size={12} className="text-yellow-400 shrink-0" />,
  };

  return (
    <div ref={ref} className="fixed bottom-4 right-4 z-[99] flex flex-col items-end pointer-events-none">
      {open && (
        <div className="mb-2 w-72 bg-card/95 backdrop-blur-xl border border-white/[0.08] rounded-xl shadow-2xl overflow-hidden pointer-events-auto origin-bottom-right animate-in fade-in slide-in-from-bottom-2">
          <div className="flex items-center justify-between px-3 py-2 border-b dark:border-white/[0.06]">
            <p className="text-xs font-medium flex items-center gap-1.5"><AlertTriangle size={12} className="text-red-400" /> Sistema</p>
            <button onClick={() => setOpen(false)} className="text-muted-foreground hover:text-foreground transition-colors p-1 rounded hover:bg-white/5">
              <X size={14} />
            </button>
          </div>
          <div className="max-h-64 overflow-y-auto">
            {alertas.map((a, i) => (
              <div key={i} className="flex items-start gap-2 px-3 py-2.5 border-b dark:border-white/[0.02] last:border-0 hover:bg-muted/50 transition-colors">
                {ICON_MAP[a.tipo]}
                <p className="text-[11px] text-foreground leading-tight mt-0.5">{a.mensagem}</p>
              </div>
            ))}
          </div>
          <div className="px-3 py-2 border-t dark:border-white/[0.06] bg-muted/20">
            <Link
              href="/config/sistema"
              onClick={() => setOpen(false)}
              className="text-[10px] text-primary hover:underline font-medium"
            >
              Monitoramento Completo →
            </Link>
          </div>
        </div>
      )}

      <button
        onClick={() => setOpen(!open)}
        className="relative p-2.5 bg-card/80 backdrop-blur-md border border-white/[0.08] rounded-full shadow-lg hover:bg-muted transition-all duration-300 pointer-events-auto group hover:scale-110"
        title={`${total} alerta(s) de sistema`}
      >
        <AlertTriangle size={16} className="text-red-400 group-hover:text-red-500 transition-colors" />
        <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[10px] rounded-full w-4 h-4 flex items-center justify-center leading-none font-bold shadow-sm">
          {total > 9 ? "9+" : total}
        </span>
      </button>
    </div>
  );
}
