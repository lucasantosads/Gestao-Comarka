"use client";

import { useEffect, useState, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { ArrowLeft, Plus, Trash2, Save, X } from "lucide-react";
import Link from "next/link";

interface Item { id: string; ordem: number; secao: string; texto: string }

const SECOES_PADRAO = [
  "Passagem de bastão",
  "Administrativo e Financeiro",
  "Entrada",
  "Conexões do cliente",
  "Ações finais",
  "Trabalho iniciado",
];

const SECAO_STYLE: Record<string, { border: string; text: string; badge: string }> = {
  "Passagem de bastão":          { border: "border-t-blue-500",   text: "text-blue-400",   badge: "bg-blue-500/15 text-blue-400" },
  "Administrativo e Financeiro": { border: "border-t-amber-500",  text: "text-amber-400",  badge: "bg-amber-500/15 text-amber-400" },
  "Entrada":                     { border: "border-t-purple-500", text: "text-purple-400", badge: "bg-purple-500/15 text-purple-400" },
  "Conexões do cliente":         { border: "border-t-teal-500",   text: "text-teal-400",   badge: "bg-teal-500/15 text-teal-400" },
  "Ações finais":                { border: "border-t-orange-500", text: "text-orange-400", badge: "bg-orange-500/15 text-orange-400" },
  "Trabalho iniciado":           { border: "border-t-green-500",  text: "text-green-400",  badge: "bg-green-500/15 text-green-400" },
};

export default function OnboardingTemplatePage() {
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");
  // Inline add por seção (Fase E)
  const [addingSecao, setAddingSecao] = useState<string | null>(null);
  const [newItemText, setNewItemText] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch("/api/onboarding/template");
    const data = await res.json();
    if (Array.isArray(data)) setItems(data);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const adicionarInline = async (secao: string) => {
    if (!newItemText.trim()) { toast.error("Digite o texto"); return; }
    const ordemUltimo = Math.max(...items.filter((i) => i.secao === secao).map((i) => i.ordem), 0);
    const res = await fetch("/api/onboarding/template", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ secao, texto: newItemText, ordem: ordemUltimo + 1 }),
    });
    const data = await res.json();
    if (data.error) toast.error(data.error);
    else {
      toast.success("Item adicionado");
      setNewItemText("");
      // Mantém aberto na mesma seção pra adicionar mais rapidamente
      load();
    }
  };

  const deletar = async (id: string) => {
    if (!confirm("Remover este item?")) return;
    await fetch(`/api/onboarding/template?id=${id}`, { method: "DELETE" });
    toast.success("Removido");
    load();
  };

  const salvarEdicao = async (id: string) => {
    await fetch("/api/onboarding/template", {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, texto: editValue }),
    });
    toast.success("Atualizado");
    setEditing(null);
    load();
  };

  if (loading) return <div className="flex items-center justify-center h-64"><p className="text-muted-foreground">Carregando...</p></div>;

  // Agrupar por seção
  const grupos: Record<string, Item[]> = {};
  for (const item of items) {
    if (!grupos[item.secao]) grupos[item.secao] = [];
    grupos[item.secao].push(item);
  }
  const secoesExistentes = Object.keys(grupos);
  const todasSecoes = Array.from(new Set([...SECOES_PADRAO, ...secoesExistentes]));

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/dashboard/onboarding"><Button variant="ghost" size="sm"><ArrowLeft size={16} /></Button></Link>
        <div>
          <h1 className="text-2xl font-bold">Template de Onboarding</h1>
          <p className="text-xs text-muted-foreground">Itens deste checklist serão adicionados automaticamente em cada novo onboarding</p>
        </div>
      </div>

      {/* Listagem por seção — todas as seções sempre aparecem (mesmo vazias) */}
      {todasSecoes.map((secao) => {
        const style = SECAO_STYLE[secao] || { border: "", text: "", badge: "bg-muted text-muted-foreground" };
        const lista = grupos[secao] || [];
        return (
          <Card key={secao} className={`border-t-4 ${style.border}`}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <span className={style.text}>{secao}</span>
                <Badge className={`text-[9px] ${style.badge}`}>{lista.length}</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-1">
              {lista.length === 0 && (
                <p className="text-[11px] text-muted-foreground italic px-2 py-1">Nenhum item nesta categoria</p>
              )}
              {lista.map((item) => (
                <div key={item.id} className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-muted/30">
                  <input type="checkbox" disabled className="opacity-50" />
                  {editing === item.id ? (
                    <>
                      <Input value={editValue} onChange={(e) => setEditValue(e.target.value)}
                        className="flex-1 h-7 text-xs"
                        onKeyDown={(e) => { if (e.key === "Enter") salvarEdicao(item.id); if (e.key === "Escape") setEditing(null); }} />
                      <button onClick={() => salvarEdicao(item.id)} className="text-green-400"><Save size={12} /></button>
                    </>
                  ) : (
                    <>
                      <span className="text-sm flex-1 cursor-pointer" onClick={() => { setEditing(item.id); setEditValue(item.texto); }}>{item.texto}</span>
                      <button onClick={() => deletar(item.id)} className="text-muted-foreground hover:text-red-400">
                        <Trash2 size={12} />
                      </button>
                    </>
                  )}
                </div>
              ))}

              {/* Inline add (Fase E) */}
              {addingSecao === secao ? (
                <div className="flex items-center gap-2 px-2 py-1.5 border border-dashed rounded">
                  <Input value={newItemText} onChange={(e) => setNewItemText(e.target.value)}
                    placeholder="Texto do novo item..." className="flex-1 h-7 text-xs" autoFocus
                    onKeyDown={(e) => {
                      if (e.key === "Enter") adicionarInline(secao);
                      if (e.key === "Escape") { setAddingSecao(null); setNewItemText(""); }
                    }} />
                  <button onClick={() => adicionarInline(secao)} className="text-green-400" title="Confirmar">
                    <Save size={12} />
                  </button>
                  <button onClick={() => { setAddingSecao(null); setNewItemText(""); }} className="text-muted-foreground hover:text-foreground" title="Cancelar">
                    <X size={12} />
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => { setAddingSecao(secao); setNewItemText(""); }}
                  className="w-full text-left text-[11px] text-muted-foreground hover:text-primary hover:bg-muted/30 px-2 py-1.5 rounded flex items-center gap-1.5"
                >
                  <Plus size={12} /> Adicionar item
                </button>
              )}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
