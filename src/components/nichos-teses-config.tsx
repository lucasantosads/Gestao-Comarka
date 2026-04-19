"use client";

import { useEffect, useState, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { Plus, Trash2, ChevronDown, ChevronRight, Tag } from "lucide-react";

interface Nicho { id: string; nome: string }
interface Tese { id: string; nome: string; nicho_id: string }

export function NichosTesesConfig() {
  const [nichos, setNichos] = useState<Nicho[]>([]);
  const [teses, setTeses] = useState<Tese[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedNicho, setExpandedNicho] = useState<string | null>(null);
  const [novoNichoNome, setNovoNichoNome] = useState("");
  const [novaTesePorNicho, setNovaTesePorNicho] = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch("/api/nichos-teses").then((r) => r.json());
    setNichos(res.nichos || []);
    setTeses(res.teses || []);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const criarNicho = async () => {
    const nome = novoNichoNome.trim();
    if (!nome) return;
    const res = await fetch("/api/nichos-teses", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "criar_nicho", nome }),
    });
    const data = await res.json();
    if (data.error) { toast.error(data.error); return; }
    setNichos((prev) => [...prev, data].sort((a, b) => a.nome.localeCompare(b.nome)));
    setNovoNichoNome("");
    toast.success("Nicho criado");
  };

  const criarTese = async (nichoId: string) => {
    const nome = (novaTesePorNicho[nichoId] || "").trim();
    if (!nome) return;
    const res = await fetch("/api/nichos-teses", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "criar_tese", nome, nicho_id: nichoId }),
    });
    const data = await res.json();
    if (data.error) { toast.error(data.error); return; }
    setTeses((prev) => [...prev, data]);
    setNovaTesePorNicho((prev) => ({ ...prev, [nichoId]: "" }));
    toast.success("Tese criada");
  };

  const deletarNicho = async (id: string) => {
    if (!confirm("Remover este nicho e todas as teses vinculadas?")) return;
    await fetch(`/api/nichos-teses?action=nicho&id=${id}`, { method: "DELETE" });
    setNichos((prev) => prev.filter((n) => n.id !== id));
    setTeses((prev) => prev.filter((t) => t.nicho_id !== id));
    toast.success("Nicho removido");
  };

  const deletarTese = async (id: string) => {
    await fetch(`/api/nichos-teses?action=tese&id=${id}`, { method: "DELETE" });
    setTeses((prev) => prev.filter((t) => t.id !== id));
    toast.success("Tese removida");
  };

  if (loading) return <div className="text-xs text-muted-foreground animate-pulse p-4">Carregando nichos...</div>;

  return (
    <Card className="shadow-sm border border-border/40">
      <CardHeader className="bg-muted/10 border-b border-border/30">
        <CardTitle className="text-xs font-black uppercase tracking-widest text-violet-500 flex items-center gap-2">
          <Tag size={14} /> Nichos & Teses
        </CardTitle>
      </CardHeader>
      <CardContent className="p-4 space-y-4 pt-4">
        {/* Adicionar nicho */}
        <div className="flex items-center gap-2">
          <Input value={novoNichoNome} onChange={(e) => setNovoNichoNome(e.target.value)}
            placeholder="Novo nicho..." className="h-8 text-xs flex-1"
            onKeyDown={(e) => { if (e.key === "Enter") criarNicho(); }} />
          <Button size="sm" onClick={criarNicho} className="h-8 text-xs gap-1">
            <Plus size={12} /> Nicho
          </Button>
        </div>

        {/* Lista de nichos */}
        {nichos.length === 0 ? (
          <p className="text-xs text-muted-foreground">Nenhum nicho cadastrado.</p>
        ) : (
          <div className="space-y-2">
            {nichos.map((nicho) => {
              const tesesDoNicho = teses.filter((t) => t.nicho_id === nicho.id);
              const isExpanded = expandedNicho === nicho.id;
              return (
                <div key={nicho.id} className="border rounded-lg overflow-hidden">
                  <div className="flex items-center justify-between p-3 bg-muted/10 hover:bg-muted/20 transition-colors cursor-pointer"
                    onClick={() => setExpandedNicho(isExpanded ? null : nicho.id)}>
                    <div className="flex items-center gap-2">
                      {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                      <span className="text-sm font-semibold">{nicho.nome}</span>
                      <span className="text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded-full">{tesesDoNicho.length} tese(s)</span>
                    </div>
                    <button onClick={(e) => { e.stopPropagation(); deletarNicho(nicho.id); }}
                      className="text-muted-foreground hover:text-red-400 transition-colors p-1">
                      <Trash2 size={12} />
                    </button>
                  </div>

                  {isExpanded && (
                    <div className="p-3 space-y-2 border-t bg-background/50">
                      {tesesDoNicho.length === 0 ? (
                        <p className="text-[10px] text-muted-foreground italic">Nenhuma tese neste nicho.</p>
                      ) : (
                        tesesDoNicho.map((t) => (
                          <div key={t.id} className="flex items-center justify-between px-2 py-1.5 rounded-md bg-muted/10 hover:bg-muted/20 transition-colors">
                            <span className="text-xs">{t.nome}</span>
                            <button onClick={() => deletarTese(t.id)} className="text-muted-foreground hover:text-red-400 transition-colors">
                              <Trash2 size={11} />
                            </button>
                          </div>
                        ))
                      )}
                      {/* Adicionar tese */}
                      <div className="flex items-center gap-2 pt-1">
                        <Input
                          value={novaTesePorNicho[nicho.id] || ""}
                          onChange={(e) => setNovaTesePorNicho((prev) => ({ ...prev, [nicho.id]: e.target.value }))}
                          placeholder="Nova tese..."
                          className="h-7 text-xs flex-1"
                          onKeyDown={(e) => { if (e.key === "Enter") criarTese(nicho.id); }}
                        />
                        <Button size="sm" variant="outline" onClick={() => criarTese(nicho.id)} className="h-7 text-[10px]">
                          <Plus size={10} />
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
