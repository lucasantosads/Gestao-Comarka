"use client";

import { useEffect, useState, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Plus, X, Tag } from "lucide-react";

interface Nicho { id: string; nome: string }
interface Tese { id: string; nome: string; nicho_id: string }
interface Vinculo { id: string; cliente_id: string; nicho_id: string; tese_id: string; nichos: Nicho; teses: Tese }

export function NichoTesesSection({ clienteId }: { clienteId: string }) {
  const [nichos, setNichos] = useState<Nicho[]>([]);
  const [teses, setTeses] = useState<Tese[]>([]);
  const [vinculos, setVinculos] = useState<Vinculo[]>([]);
  const [loading, setLoading] = useState(true);

  const [selectedNicho, setSelectedNicho] = useState("");
  const [selectedTeses, setSelectedTeses] = useState<string[]>([]);
  const [novoNichoNome, setNovoNichoNome] = useState("");
  const [novaTeseName, setNovaTeseName] = useState("");
  const [showNovoNicho, setShowNovoNicho] = useState(false);
  const [showNovaTese, setShowNovaTese] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const [catRes, vincRes] = await Promise.all([
      fetch("/api/nichos-teses").then((r) => r.json()),
      fetch(`/api/nichos-teses?cliente_id=${clienteId}`).then((r) => r.json()),
    ]);
    setNichos(catRes.nichos || []);
    setTeses(catRes.teses || []);
    setVinculos(vincRes.vinculos || []);
    setLoading(false);
  }, [clienteId]);

  useEffect(() => { load(); }, [load]);

  const tesesDoNicho = teses.filter((t) => t.nicho_id === selectedNicho);

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
    setSelectedNicho(data.id);
    setNovoNichoNome("");
    setShowNovoNicho(false);
    toast.success("Nicho criado");
  };

  const criarTese = async () => {
    const nome = novaTeseName.trim();
    if (!nome || !selectedNicho) return;
    const res = await fetch("/api/nichos-teses", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "criar_tese", nome, nicho_id: selectedNicho }),
    });
    const data = await res.json();
    if (data.error) { toast.error(data.error); return; }
    setTeses((prev) => [...prev, data]);
    setSelectedTeses((prev) => [...prev, data.id]);
    setNovaTeseName("");
    setShowNovaTese(false);
    toast.success("Tese criada");
  };

  const salvarVinculos = async () => {
    if (!selectedNicho) { toast.error("Selecione um nicho"); return; }
    if (selectedTeses.length === 0) { toast.error("Selecione pelo menos 1 tese"); return; }

    let ok = 0;
    for (const teseId of selectedTeses) {
      const jaExiste = vinculos.some((v) => v.nicho_id === selectedNicho && v.tese_id === teseId);
      if (jaExiste) continue;
      const res = await fetch("/api/nichos-teses", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "vincular_cliente", cliente_id: clienteId, nicho_id: selectedNicho, tese_id: teseId }),
      });
      const data = await res.json();
      if (!data.error) ok++;
    }
    if (ok > 0) toast.success(`${ok} vínculo(s) salvo(s)`);
    setSelectedNicho("");
    setSelectedTeses([]);
    load();
  };

  const removerVinculo = async (vinculoId: string) => {
    await fetch(`/api/nichos-teses?action=vinculo&id=${vinculoId}`, { method: "DELETE" });
    setVinculos((prev) => prev.filter((v) => v.id !== vinculoId));
    toast.success("Vínculo removido");
  };

  const toggleTese = (teseId: string) => {
    setSelectedTeses((prev) => prev.includes(teseId) ? prev.filter((t) => t !== teseId) : [...prev, teseId]);
  };

  if (loading) return <div className="text-xs text-muted-foreground animate-pulse py-4">Carregando nichos...</div>;

  // Agrupar vínculos por nicho
  const vinculosPorNicho = vinculos.reduce<Record<string, { nicho: Nicho; teses: (Tese & { vinculoId: string })[] }>>((acc, v) => {
    const key = v.nicho_id;
    if (!acc[key]) acc[key] = { nicho: v.nichos, teses: [] };
    acc[key].teses.push({ ...v.teses, vinculoId: v.id });
    return acc;
  }, {});

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2"><Tag size={16} className="text-violet-400" />Nicho & Teses</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Vínculos existentes */}
        {Object.keys(vinculosPorNicho).length > 0 ? (
          <div className="space-y-2">
            {Object.values(vinculosPorNicho).map(({ nicho, teses: ts }) => (
              <div key={nicho.id} className="p-3 border rounded-lg bg-violet-500/5 border-violet-500/20">
                <p className="text-xs font-semibold text-violet-400 mb-1.5">{nicho.nome}</p>
                <div className="flex flex-wrap gap-1.5">
                  {ts.map((t) => (
                    <Badge key={t.vinculoId} className="bg-violet-500/15 text-violet-300 text-[10px] gap-1 pr-1">
                      {t.nome}
                      <button onClick={() => removerVinculo(t.vinculoId)} className="hover:text-red-400 ml-0.5"><X size={10} /></button>
                    </Badge>
                  ))}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-xs text-muted-foreground">Nenhum nicho/tese vinculado a este cliente.</p>
        )}

        {/* Adicionar vínculo */}
        <div className="p-3 border border-dashed rounded-lg space-y-3">
          <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Adicionar nicho & teses</p>

          {/* Select nicho */}
          <div className="flex items-center gap-2">
            <select
              value={selectedNicho}
              onChange={(e) => { setSelectedNicho(e.target.value); setSelectedTeses([]); }}
              className="flex-1 text-xs bg-transparent border rounded-lg px-2 py-1.5"
            >
              <option value="">Selecionar nicho...</option>
              {nichos.map((n) => <option key={n.id} value={n.id}>{n.nome}</option>)}
            </select>
            <Button size="sm" variant="ghost" onClick={() => setShowNovoNicho(!showNovoNicho)} className="text-[10px] h-7 px-2">
              <Plus size={12} />
            </Button>
          </div>

          {/* Novo nicho inline */}
          {showNovoNicho && (
            <div className="flex items-center gap-2">
              <Input value={novoNichoNome} onChange={(e) => setNovoNichoNome(e.target.value)}
                placeholder="Nome do novo nicho..." className="h-7 text-xs flex-1"
                onKeyDown={(e) => { if (e.key === "Enter") criarNicho(); }} />
              <Button size="sm" onClick={criarNicho} className="h-7 text-[10px]">Criar</Button>
            </div>
          )}

          {/* Multi-select teses */}
          {selectedNicho && (
            <>
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <p className="text-[10px] text-muted-foreground font-medium">Teses do nicho:</p>
                  <Button size="sm" variant="ghost" onClick={() => setShowNovaTese(!showNovaTese)} className="text-[10px] h-6 px-2">
                    <Plus size={10} className="mr-1" />Nova tese
                  </Button>
                </div>
                {tesesDoNicho.length === 0 ? (
                  <p className="text-[10px] text-muted-foreground italic">Nenhuma tese neste nicho. Crie uma abaixo.</p>
                ) : (
                  <div className="flex flex-wrap gap-1.5">
                    {tesesDoNicho.map((t) => {
                      const selected = selectedTeses.includes(t.id);
                      const jaVinculada = vinculos.some((v) => v.tese_id === t.id && v.nicho_id === selectedNicho);
                      return (
                        <button key={t.id} onClick={() => !jaVinculada && toggleTese(t.id)} disabled={jaVinculada}
                          className={`px-2.5 py-1 text-[10px] font-medium rounded-md border transition-all ${
                            jaVinculada ? "bg-muted/30 text-muted-foreground border-border cursor-not-allowed opacity-50" :
                            selected ? "bg-primary text-primary-foreground border-primary shadow-sm" :
                            "bg-card text-muted-foreground border-border hover:border-primary/50 hover:text-foreground"
                          }`}>
                          {t.nome} {jaVinculada && "✓"}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Nova tese inline */}
              {showNovaTese && (
                <div className="flex items-center gap-2">
                  <Input value={novaTeseName} onChange={(e) => setNovaTeseName(e.target.value)}
                    placeholder="Nome da nova tese..." className="h-7 text-xs flex-1"
                    onKeyDown={(e) => { if (e.key === "Enter") criarTese(); }} />
                  <Button size="sm" onClick={criarTese} className="h-7 text-[10px]">Criar</Button>
                </div>
              )}

              {/* Salvar */}
              {selectedTeses.length > 0 && (
                <Button size="sm" onClick={salvarVinculos} className="w-full text-xs">
                  Salvar {selectedTeses.length} tese(s)
                </Button>
              )}
            </>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
