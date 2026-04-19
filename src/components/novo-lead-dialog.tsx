"use client";

import { useState, useEffect, useRef } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Search, UserPlus, Link2, Loader2 } from "lucide-react";

interface GhlContact { id: string; name: string; phone: string; email: string }

const FONTES_AVULSO = ["Indicação", "Orgânico", "Evento", "Parceria", "Outro"];

interface Props {
  open: boolean;
  onClose: () => void;
  onCreateGhl: (contact: GhlContact) => void;
  onCreateAvulso: (data: { nome: string; telefone: string; email: string; fonte: string }) => void;
}

export function NovoLeadDialog({ open, onClose, onCreateGhl, onCreateAvulso }: Props) {
  const [tab, setTab] = useState<"ghl" | "avulso">("ghl");

  // GHL search state
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<GhlContact[]>([]);
  const [searching, setSearching] = useState(false);
  const debounceRef = useRef<NodeJS.Timeout | null>(null);

  // Avulso form state
  const [nome, setNome] = useState("");
  const [telefone, setTelefone] = useState("");
  const [email, setEmail] = useState("");
  const [fonte, setFonte] = useState("");

  // Reset on open
  useEffect(() => {
    if (open) {
      setTab("ghl");
      setQuery("");
      setResults([]);
      setNome("");
      setTelefone("");
      setEmail("");
      setFonte("");
    }
  }, [open]);

  // GHL search with debounce
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (query.length < 2) { setResults([]); return; }
    setSearching(true);
    debounceRef.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/ghl/contacts?query=${encodeURIComponent(query)}`);
        const data = await res.json();
        if (Array.isArray(data)) setResults(data);
        else setResults([]);
      } catch { setResults([]); }
      setSearching(false);
    }, 500);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [query]);

  const handleSelectGhl = (contact: GhlContact) => {
    onCreateGhl(contact);
    onClose();
  };

  const handleCreateAvulso = () => {
    if (!nome.trim()) { toast.error("Nome é obrigatório"); return; }
    if (!fonte) { toast.error("Fonte é obrigatória"); return; }
    onCreateAvulso({ nome: nome.trim(), telefone, email, fonte });
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="text-lg">Novo Lead</DialogTitle>
        </DialogHeader>

        {/* Tabs */}
        <div className="flex gap-2 border-b pb-2">
          <button onClick={() => setTab("ghl")}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-t-lg transition-all ${tab === "ghl" ? "bg-card border border-b-0 border-border text-foreground -mb-[9px] pb-[9px]" : "text-muted-foreground hover:text-foreground"}`}>
            <Link2 size={12} /> Vincular GHL
          </button>
          <button onClick={() => setTab("avulso")}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-t-lg transition-all ${tab === "avulso" ? "bg-card border border-b-0 border-border text-foreground -mb-[9px] pb-[9px]" : "text-muted-foreground hover:text-foreground"}`}>
            <UserPlus size={12} /> Lead avulso
          </button>
        </div>

        {/* Tab GHL */}
        {tab === "ghl" && (
          <div className="space-y-3 pt-2">
            <div className="relative">
              <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Buscar por nome ou telefone..."
                className="pl-8 h-9 text-sm"
                autoFocus
              />
              {searching && <Loader2 size={14} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground animate-spin" />}
            </div>

            <div className="max-h-[250px] overflow-y-auto space-y-1">
              {results.length === 0 && query.length >= 2 && !searching && (
                <p className="text-xs text-muted-foreground text-center py-4">Nenhum contato encontrado.</p>
              )}
              {results.map((c) => (
                <button key={c.id} onClick={() => handleSelectGhl(c)}
                  className="w-full text-left p-3 rounded-lg border bg-background/50 hover:bg-muted/20 transition-colors flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">{c.name || "Sem nome"}</p>
                    <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                      {c.phone && <span>{c.phone}</span>}
                      {c.email && <span>{c.email}</span>}
                    </div>
                  </div>
                  <Badge className="text-[8px] bg-blue-500/15 text-blue-400 flex-shrink-0">GHL</Badge>
                </button>
              ))}
            </div>

            {query.length < 2 && (
              <p className="text-[10px] text-muted-foreground text-center">Digite pelo menos 2 caracteres para buscar.</p>
            )}
          </div>
        )}

        {/* Tab Avulso */}
        {tab === "avulso" && (
          <div className="space-y-4 pt-2">
            <div className="space-y-1.5">
              <Label className="text-xs">Nome *</Label>
              <Input value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Nome do lead..." className="h-9 text-sm" autoFocus />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Telefone</Label>
                <Input value={telefone} onChange={(e) => setTelefone(e.target.value)} placeholder="(00) 00000-0000" className="h-9 text-sm" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Email</Label>
                <Input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="email@..." className="h-9 text-sm" type="email" />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Fonte *</Label>
              <select value={fonte} onChange={(e) => setFonte(e.target.value)}
                className="w-full text-sm bg-transparent border rounded-lg px-3 py-2 outline-none focus:ring-1 focus:ring-primary">
                <option value="">Selecionar fonte...</option>
                {FONTES_AVULSO.map((f) => <option key={f} value={f}>{f}</option>)}
              </select>
            </div>
            <Button onClick={handleCreateAvulso} className="w-full">
              <UserPlus size={14} className="mr-2" /> Criar lead avulso
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
