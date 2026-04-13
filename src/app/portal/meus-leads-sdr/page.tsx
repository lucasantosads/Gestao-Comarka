"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/lib/supabase";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Search, ChevronDown, ChevronRight, Phone, Mail } from "lucide-react";

interface Lead {
  id: string; nome: string; etapa: string; telefone: string; email: string;
  valor_mensal: number; canal_aquisicao: string; created_at: string;
  data_reuniao: string | null; closer_id: string;
}

const ETAPA_COLORS: Record<string, string> = {
  oportunidade: "bg-blue-500/15 text-blue-400",
  reuniao_agendada: "bg-yellow-500/15 text-yellow-400",
  reuniao_feita: "bg-orange-500/15 text-orange-400",
  proposta_enviada: "bg-purple-500/15 text-purple-400",
  follow_up: "bg-cyan-500/15 text-cyan-400",
  comprou: "bg-green-500/15 text-green-400",
  desistiu: "bg-red-500/15 text-red-400",
};
const ETAPA_LABELS: Record<string, string> = {
  oportunidade: "Oportunidade", reuniao_agendada: "Agendada", reuniao_feita: "Feita",
  proposta_enviada: "Proposta", follow_up: "Follow Up", comprou: "Comprou", desistiu: "Desistiu",
};

export default function MeusLeadsSdrPage() {
  const { user } = useAuth();
  const [leads, setLeads] = useState<Lead[]>([]);
  const [closers, setClosers] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [busca, setBusca] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => {
    if (!user?.entityId) return;
    Promise.all([
      supabase.from("leads_crm").select("id,nome,etapa,telefone,email,valor_mensal,canal_aquisicao,created_at,data_reuniao,closer_id")
        .eq("sdr_id", user.entityId).order("created_at", { ascending: false }),
      supabase.from("closers").select("id,nome"),
    ]).then(([{ data: lds }, { data: cls }]) => {
      setLeads((lds || []) as Lead[]);
      const map: Record<string, string> = {};
      for (const c of (cls || [])) map[c.id] = c.nome;
      setClosers(map);
      setLoading(false);
    });
  }, [user]);

  if (loading) return <div className="h-64 flex items-center justify-center text-muted-foreground">Carregando...</div>;

  let filtered = leads;
  if (busca) { const q = busca.toLowerCase(); filtered = filtered.filter((l) => l.nome?.toLowerCase().includes(q)); }

  const agendadas = leads.filter((l) => l.etapa === "reuniao_agendada").length;
  const feitas = leads.filter((l) => ["reuniao_feita", "proposta_enviada", "follow_up", "assinatura", "comprou"].includes(l.etapa)).length;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">Meu Pipeline</h1>
        <span className="text-xs text-muted-foreground">{filtered.length} leads</span>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <Card><CardContent className="pt-3 pb-2 text-center"><p className="text-[10px] text-muted-foreground">Total</p><p className="text-lg font-bold">{leads.length}</p></CardContent></Card>
        <Card><CardContent className="pt-3 pb-2 text-center"><p className="text-[10px] text-muted-foreground">Agendadas</p><p className="text-lg font-bold text-yellow-400">{agendadas}</p></CardContent></Card>
        <Card><CardContent className="pt-3 pb-2 text-center"><p className="text-[10px] text-muted-foreground">Feitas</p><p className="text-lg font-bold text-green-400">{feitas}</p></CardContent></Card>
      </div>

      <div className="relative">
        <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar lead..."
          className="w-full pl-7 pr-3 py-2 text-xs bg-transparent border rounded-lg" />
      </div>

      <div className="space-y-1">
        {filtered.map((l) => {
          const isExp = expandedId === l.id;
          return (
            <div key={l.id} className="border rounded-lg">
              <button onClick={() => setExpandedId(isExp ? null : l.id)}
                className="w-full flex items-center justify-between p-3 text-left hover:bg-muted/20 transition-colors">
                <div className="flex items-center gap-2 min-w-0">
                  {isExp ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                  <span className="text-sm font-medium truncate">{l.nome || "Sem nome"}</span>
                  <Badge className={`text-[8px] ${ETAPA_COLORS[l.etapa] || "bg-muted"}`}>{ETAPA_LABELS[l.etapa] || l.etapa}</Badge>
                </div>
                {l.closer_id && <span className="text-[10px] text-muted-foreground shrink-0 ml-2">{closers[l.closer_id] || ""}</span>}
              </button>
              {isExp && (
                <div className="px-4 pb-3 space-y-2 border-t bg-muted/5">
                  <div className="grid grid-cols-2 gap-2 text-xs pt-2">
                    {l.telefone && <span className="flex items-center gap-1"><Phone size={10} /> {l.telefone}</span>}
                    {l.email && <span className="flex items-center gap-1"><Mail size={10} /> {l.email}</span>}
                    {l.canal_aquisicao && <span>Canal: <strong>{l.canal_aquisicao}</strong></span>}
                    {l.data_reuniao && <span>Reuniao: <strong>{new Date(l.data_reuniao).toLocaleDateString("pt-BR")}</strong></span>}
                    {l.closer_id && <span>Closer: <strong>{closers[l.closer_id]}</strong></span>}
                  </div>
                </div>
              )}
            </div>
          );
        })}
        {filtered.length === 0 && <p className="text-center text-sm text-muted-foreground py-8">Nenhum lead encontrado</p>}
      </div>
    </div>
  );
}
