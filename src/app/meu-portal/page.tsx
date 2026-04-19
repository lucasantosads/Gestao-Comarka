"use client";

import { useMemo, useEffect } from "react";
import useSWR from "swr";
import { useRouter } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatCurrency } from "@/lib/format";
import { TarefasKanban } from "@/components/tarefas/tarefas-kanban";
import { Users, Briefcase, Activity, AlertTriangle, ArrowRight } from "lucide-react";
import Link from "next/link";
import type { Cliente, TeamMember } from "@/lib/data";
import { motion, AnimatePresence } from "framer-motion";

interface Session { employeeId: string; nome: string; role: string; cargo?: string; }

const fetcher = (url: string) => fetch(url).then((res) => { if (!res.ok) throw new Error("Erro de fetch"); return res.json(); });

export default function MeuPortalPage() {
  const router = useRouter();
  const { data: session, isLoading: loadingSession } = useSWR<Session>("/api/auth/me", fetcher, { revalidateOnFocus: false });
  const { data: team } = useSWR<TeamMember[]>(session ? "/api/notion/team" : null, fetcher, { revalidateOnFocus: false, dedupingInterval: 60000 });

  useEffect(() => {
    if (session) {
      if (session.role === "closer" && session.employeeId) router.push(`/closer/${session.employeeId}`);
      if (session.role === "sdr" && session.employeeId) router.push(`/relatorio-sdr?sdr=${session.employeeId}`);
    }
  }, [session, router]);

  const notionId = useMemo(() => {
    if (!session || !team) return null;
    if (session.role === "closer" || session.role === "sdr") return null;
    const match = team.find((m) => m.nome === session.nome || m.nome.split(" ")[0] === session.nome.split(" ")[0]);
    return match?.notion_id || null;
  }, [session, team]);

  const { data: memData, isLoading: loadingMember } = useSWR(
    notionId ? `/api/notion/member/${notionId}` : null,
    fetcher
  );

  const member: TeamMember | null = memData?.member || null;
  const clientesBrutos: Cliente[] = memData?.clientes || [];

  const clientes = useMemo(() => clientesBrutos.filter((c) => c.status !== "Finalizado"), [clientesBrutos]);
  const bons = useMemo(() => clientes.filter((c) => c.resultados === "Bons" || c.resultados === "Ótimos").length, [clientes]);
  const piorando = useMemo(() => clientes.filter((c) => c.situacao === "Piorando"), [clientes]);
  const feedbackVencido = useMemo(() => clientes.filter((c) => c.ultimo_feedback && Math.floor((Date.now() - new Date(c.ultimo_feedback).getTime()) / 86400000) > 10), [clientes]);
  const orcTotal = useMemo(() => clientes.reduce((s, c) => s + Number(c.orcamento || 0), 0), [clientes]);

  if (loadingSession || (session && !notionId && session.role !== "closer" && session.role !== "sdr" && !team)) return (
    <div className="flex flex-col items-center justify-center h-[60vh] gap-4">
      <div className="w-8 h-8 border-4 border-muted border-t-primary rounded-full animate-spin"></div>
      <p className="text-muted-foreground animate-pulse text-sm">Carregando portal corporativo...</p>
    </div>
  );

  if (!session) return <div className="text-center py-12"><p className="text-muted-foreground">Sessão expirada ou não autenticado.</p></div>;

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-500">
      <div className="flex items-center gap-4 border-b border-border/50 pb-4">
        <div className="w-14 h-14 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center shadow-inner">
          <Users size={26} className="text-primary" />
        </div>
        <div>
          <h1 className="text-3xl font-black tracking-tight" style={{ letterSpacing: "-0.04em" }}>Olá, {session.nome.split(" ")[0]}</h1>
          <p className="text-xs text-muted-foreground font-medium tracking-widest uppercase mt-0.5">{member?.cargo || session.cargo || session.role}</p>
        </div>
      </div>

      {clientes.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { tag: "Meus Clientes Ativos", val: clientes.length, icon: Briefcase },
            { tag: "Orçamento Total", val: formatCurrency(orcTotal), icon: Users },
            { tag: "% Bons + Ótimos", val: `${clientes.length > 0 ? ((bons / clientes.length) * 100).toFixed(0) : 0}%`, icon: Activity, color: "text-emerald-400" },
            { tag: "Atenção Imediata", val: piorando.length + feedbackVencido.length, icon: AlertTriangle, color: "text-rose-400" },
          ].map((kpi, idx) => (
            <Card key={idx} className="bg-card/40 backdrop-blur border-border/50 shadow-sm hover:shadow-md transition-shadow">
              <CardContent className="p-5 flex flex-col gap-2">
                <div className="flex items-center justify-between opacity-80">
                  <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-widest">{kpi.tag}</p>
                  <kpi.icon size={14} className="text-muted-foreground" />
                </div>
                <p className={`text-3xl font-black tracking-tighter ${kpi.color || "text-foreground"}`}>{kpi.val}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <AnimatePresence>
        {(piorando.length > 0 || feedbackVencido.length > 0) && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="space-y-3 overflow-hidden">
            {piorando.length > 0 && (
              <div className="p-4 rounded-xl bg-orange-500/10 border border-orange-500/20 text-sm text-orange-400 flex items-center gap-3 font-medium shadow-sm">
                <AlertTriangle size={18} className="shrink-0 animate-pulse" />
                <span><strong className="text-orange-500">{piorando.length} clientes em declínio de performance:</strong> {piorando.map((c) => c.nome).join(", ")}</span>
              </div>
            )}
            {feedbackVencido.length > 0 && (
              <div className="p-4 rounded-xl bg-yellow-500/10 border border-yellow-500/20 text-sm text-yellow-400 flex items-center gap-3 font-medium shadow-sm">
                <AlertTriangle size={18} className="shrink-0" />
                <span><strong className="text-yellow-500">{feedbackVencido.length} feedbacks esgotados (10d):</strong> {feedbackVencido.map((c) => c.nome).join(", ")}</span>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Seção de Clientes Ativos removida conforme solicitação */}

      {loadingMember && (
        <div className="w-full flex items-center justify-center py-6 gap-2">
          <div className="w-4 h-4 rounded-full border-2 border-primary border-t-transparent animate-spin" />
          <span className="text-xs text-muted-foreground">Sincronizando tarefas da aba de Kanban...</span>
        </div>
      )}

      <div className="pt-4">
        <TarefasKanban filtroResponsavel={session.nome} />
      </div>
    </div>
  );
}
