"use client";

import { useEffect, useState, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { RefreshCw, Check, Pencil, Link2 } from "lucide-react";

interface Nicho { id: string; nome: string }
interface Tese { id: string; nome: string; nicho_id: string }
interface CampanhaVinculo {
  id: string;
  campaign_id: string;
  campaign_name: string;
  campaign_status?: string;
  cliente_id: string | null;
  nicho_id: string | null;
  tese_id: string | null;
  vinculo_automatico: boolean;
  confirmado: boolean;
}

export function CampanhasVinculos() {
  const [matched, setMatched] = useState<CampanhaVinculo[]>([]);
  const [unmatched, setUnmatched] = useState<CampanhaVinculo[]>([]);
  const [confirmed, setConfirmed] = useState<CampanhaVinculo[]>([]);
  const [nichos, setNichos] = useState<Nicho[]>([]);
  const [teses, setTeses] = useState<Tese[]>([]);
  const [loading, setLoading] = useState(false);
  const [total, setTotal] = useState(0);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editNicho, setEditNicho] = useState("");
  const [editTese, setEditTese] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    const [matchRes, catRes] = await Promise.all([
      fetch("/api/campanhas/match-nichos").then((r) => r.json()),
      fetch("/api/nichos-teses").then((r) => r.json()),
    ]);
    setMatched(matchRes.matched || []);
    setUnmatched(matchRes.unmatched || []);
    setConfirmed(matchRes.confirmed || []);
    setTotal(matchRes.total || 0);
    setNichos(catRes.nichos || []);
    setTeses(catRes.teses || []);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const confirmar = async (camp: CampanhaVinculo) => {
    const res = await fetch("/api/campanhas/match-nichos", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: camp.id }),
    });
    const data = await res.json();
    if (data.error) { toast.error(data.error); return; }
    setMatched((prev) => prev.filter((c) => c.id !== camp.id));
    setConfirmed((prev) => [{ ...camp, confirmado: true }, ...prev]);
    toast.success("Vínculo confirmado");
  };

  const salvarManual = async (camp: CampanhaVinculo, nichoId: string, teseId: string) => {
    if (!nichoId || !teseId) { toast.error("Selecione nicho e tese"); return; }
    const res = await fetch("/api/campanhas/match-nichos", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: camp.id, nicho_id: nichoId, tese_id: teseId }),
    });
    const data = await res.json();
    if (data.error) { toast.error(data.error); return; }
    setUnmatched((prev) => prev.filter((c) => c.id !== camp.id));
    setMatched((prev) => prev.filter((c) => c.id !== camp.id));
    setConfirmed((prev) => [{ ...camp, nicho_id: nichoId, tese_id: teseId, confirmado: true }, ...prev]);
    setEditingId(null);
    toast.success("Vínculo salvo");
  };

  const nichoNome = (id: string | null) => nichos.find((n) => n.id === id)?.nome || "—";
  const teseNome = (id: string | null) => teses.find((t) => t.id === id)?.nome || "—";
  const tesesDoNicho = (nichoId: string) => teses.filter((t) => t.nicho_id === nichoId);
  const pendentes = matched.length + unmatched.length;

  const renderRow = (camp: CampanhaVinculo, tipo: "matched" | "unmatched" | "confirmed") => {
    const isEditing = editingId === camp.id;

    return (
      <div key={camp.id} className="flex items-center justify-between gap-3 p-3 border rounded-lg bg-background/50 hover:bg-muted/10 transition-colors">
        <div className="flex-1 min-w-0">
          <p className="text-xs font-medium truncate">{camp.campaign_name || camp.campaign_id}</p>
          <p className="text-[10px] text-muted-foreground font-mono">{camp.campaign_id}</p>
        </div>

        <div className="flex items-center gap-2 flex-shrink-0">
          {tipo === "confirmed" && (
            <>
              <Badge className="bg-green-500/15 text-green-400 text-[9px]">Confirmado</Badge>
              <span className="text-[10px] text-muted-foreground">{nichoNome(camp.nicho_id)} → {teseNome(camp.tese_id)}</span>
            </>
          )}

          {tipo === "matched" && !isEditing && (
            <>
              <Badge className="bg-yellow-500/15 text-yellow-400 text-[9px]">Auto-detectado</Badge>
              <span className="text-[10px] text-muted-foreground">{nichoNome(camp.nicho_id)} → {teseNome(camp.tese_id)}</span>
              <Button size="sm" variant="ghost" className="h-6 text-[10px] text-green-400" onClick={() => confirmar(camp)}>
                <Check size={12} className="mr-1" />Confirmar
              </Button>
              <Button size="sm" variant="ghost" className="h-6 text-[10px]"
                onClick={() => { setEditingId(camp.id); setEditNicho(camp.nicho_id || ""); setEditTese(camp.tese_id || ""); }}>
                <Pencil size={10} className="mr-1" />Corrigir
              </Button>
            </>
          )}

          {tipo === "unmatched" && !isEditing && (
            <>
              <Badge className="bg-red-500/15 text-red-400 text-[9px]">Preencher</Badge>
              <Button size="sm" variant="ghost" className="h-6 text-[10px]"
                onClick={() => { setEditingId(camp.id); setEditNicho(""); setEditTese(""); }}>
                <Pencil size={10} className="mr-1" />Atribuir
              </Button>
            </>
          )}

          {isEditing && (
            <div className="flex items-center gap-2">
              <select value={editNicho} onChange={(e) => { setEditNicho(e.target.value); setEditTese(""); }}
                className="text-[10px] bg-transparent border rounded px-1.5 py-1 min-w-[100px]">
                <option value="">Nicho...</option>
                {nichos.map((n) => <option key={n.id} value={n.id}>{n.nome}</option>)}
              </select>
              <select value={editTese} onChange={(e) => setEditTese(e.target.value)}
                className="text-[10px] bg-transparent border rounded px-1.5 py-1 min-w-[100px]"
                disabled={!editNicho}>
                <option value="">Tese...</option>
                {tesesDoNicho(editNicho).map((t) => <option key={t.id} value={t.id}>{t.nome}</option>)}
              </select>
              <Button size="sm" className="h-6 text-[10px]" onClick={() => salvarManual(camp, editNicho, editTese)}>
                Salvar
              </Button>
              <Button size="sm" variant="ghost" className="h-6 text-[10px]" onClick={() => setEditingId(null)}>
                Cancelar
              </Button>
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <Card className="shadow-sm border border-border/40">
      <CardHeader className="bg-muted/10 border-b border-border/30">
        <div className="flex items-center justify-between">
          <CardTitle className="text-xs font-black uppercase tracking-widest text-blue-500 flex items-center gap-2">
            <Link2 size={14} /> Vínculos de Campanhas
          </CardTitle>
          <div className="flex items-center gap-3">
            {pendentes > 0 && (
              <Badge className="bg-yellow-500/15 text-yellow-400 text-[10px]">
                {pendentes} aguardando confirmação
              </Badge>
            )}
            <Button size="sm" variant="outline" onClick={load} disabled={loading} className="h-7 text-[10px] gap-1">
              <RefreshCw size={10} className={loading ? "animate-spin" : ""} />
              {loading ? "Buscando..." : "Sincronizar Meta"}
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-4 space-y-4 pt-4">
        {loading && matched.length === 0 && unmatched.length === 0 && confirmed.length === 0 && (
          <div className="flex items-center justify-center py-8">
            <div className="w-6 h-6 border-2 border-muted border-t-primary rounded-full animate-spin" />
            <span className="ml-3 text-xs text-muted-foreground">Buscando campanhas do Meta...</span>
          </div>
        )}

        {/* Resumo */}
        {!loading && total > 0 && (
          <div className="grid grid-cols-3 gap-3">
            <div className="p-3 rounded-lg border bg-yellow-500/5 border-yellow-500/20 text-center">
              <p className="text-lg font-bold text-yellow-400">{matched.length}</p>
              <p className="text-[9px] text-muted-foreground uppercase tracking-widest">Auto-detectados</p>
            </div>
            <div className="p-3 rounded-lg border bg-red-500/5 border-red-500/20 text-center">
              <p className="text-lg font-bold text-red-400">{unmatched.length}</p>
              <p className="text-[9px] text-muted-foreground uppercase tracking-widest">Preencher</p>
            </div>
            <div className="p-3 rounded-lg border bg-green-500/5 border-green-500/20 text-center">
              <p className="text-lg font-bold text-green-400">{confirmed.length}</p>
              <p className="text-[9px] text-muted-foreground uppercase tracking-widest">Confirmados</p>
            </div>
          </div>
        )}

        {/* Auto-detectados */}
        {matched.length > 0 && (
          <div className="space-y-2">
            <p className="text-[10px] font-bold uppercase tracking-widest text-yellow-500">Auto-detectados — aguardando confirmação</p>
            {matched.map((c) => renderRow(c, "matched"))}
          </div>
        )}

        {/* Preencher manualmente */}
        {unmatched.length > 0 && (
          <div className="space-y-2">
            <p className="text-[10px] font-bold uppercase tracking-widest text-red-500">Preencher manualmente</p>
            {unmatched.map((c) => renderRow(c, "unmatched"))}
          </div>
        )}

        {/* Confirmados */}
        {confirmed.length > 0 && (
          <div className="space-y-2">
            <p className="text-[10px] font-bold uppercase tracking-widest text-green-500">Confirmados</p>
            {confirmed.map((c) => renderRow(c, "confirmed"))}
          </div>
        )}

        {!loading && total === 0 && (
          <p className="text-xs text-muted-foreground text-center py-4">Nenhuma campanha encontrada. Clique em "Sincronizar Meta" para buscar.</p>
        )}
      </CardContent>
    </Card>
  );
}
