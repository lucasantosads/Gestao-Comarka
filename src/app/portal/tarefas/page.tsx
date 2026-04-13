"use client";

import { useEffect, useState, useCallback } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Plus, ChevronRight, MessageSquare, Clock, X, Send } from "lucide-react";

interface Tarefa {
  id: string; titulo: string; descricao: string; criado_por: string;
  atribuido_para: string; status: string; prioridade: string;
  prazo: string; iniciado_em: string | null; concluido_em: string | null;
  tipo: string; created_at: string;
}

interface Colaborador { id: string; nome: string; }

const PRIO_BADGE: Record<string, string> = {
  baixa: "bg-slate-500/15 text-slate-400", media: "bg-blue-500/15 text-blue-400",
  alta: "bg-orange-500/15 text-orange-400", urgente: "bg-red-500/15 text-red-400",
};
const TIPO_BADGE: Record<string, string> = {
  lancamento: "bg-yellow-500/15 text-yellow-400", followup: "bg-cyan-500/15 text-cyan-400",
  confirmacao_reuniao: "bg-green-500/15 text-green-400", envio_proposta: "bg-purple-500/15 text-purple-400",
  interno: "bg-blue-500/15 text-blue-400", outro: "bg-muted text-muted-foreground",
};
const TIPO_LABELS: Record<string, string> = {
  lancamento: "Lançamento", followup: "Follow Up", confirmacao_reuniao: "Confirmar Reuniao",
  envio_proposta: "Proposta", interno: "Interno", outro: "Outro",
};
const STATUS_NEXT: Record<string, string> = { pendente: "em_andamento", em_andamento: "concluida" };

export default function TarefasPage() {
  useAuth();
  const [tarefas, setTarefas] = useState<Tarefa[]>([]);
  const [colaboradores, setColaboradores] = useState<Colaborador[]>([]);
  const [loading, setLoading] = useState(true);
  const [filtro, setFiltro] = useState("minhas");
  const [showModal, setShowModal] = useState(false);
  const [editTarefa, setEditTarefa] = useState<Tarefa | null>(null);
  const [comentarios, setComentarios] = useState<{ id: string; autor_id: string; texto: string; created_at: string }[]>([]);
  const [novoComentario, setNovoComentario] = useState("");

  const loadTarefas = useCallback(async () => {
    setLoading(true);
    const res = await fetch(`/api/tarefas?filtro=${filtro}`);
    const data = await res.json();
    if (Array.isArray(data)) setTarefas(data);
    setLoading(false);
  }, [filtro]);

  useEffect(() => {
    loadTarefas();
    Promise.all([
      supabase.from("closers").select("id,nome").eq("ativo", true),
      supabase.from("sdrs").select("id,nome").eq("ativo", true),
    ]).then(([{ data: c }, { data: s }]) => {
      setColaboradores([...(c || []), ...(s || [])] as Colaborador[]);
    });
  }, [loadTarefas]);

  const avancar = async (t: Tarefa) => {
    const next = STATUS_NEXT[t.status];
    if (!next) return;
    const res = await fetch(`/api/tarefas/${t.id}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: next }),
    });
    if (res.ok) { toast.success(`Tarefa → ${next.replace("_", " ")}`); loadTarefas(); }
  };

  const abrirDetalhes = async (t: Tarefa) => {
    setEditTarefa(t);
    const res = await fetch(`/api/tarefas/${t.id}/comentarios`);
    const data = await res.json();
    if (Array.isArray(data)) setComentarios(data);
  };

  const enviarComentario = async () => {
    if (!editTarefa || !novoComentario.trim()) return;
    const res = await fetch(`/api/tarefas/${editTarefa.id}/comentarios`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ texto: novoComentario }),
    });
    if (res.ok) {
      const c = await res.json();
      setComentarios([...comentarios, c]);
      setNovoComentario("");
    }
  };

  const getNome = (id: string) => colaboradores.find((c) => c.id === id)?.nome || "—";

  const prazoInfo = (prazo: string) => {
    const diff = Math.ceil((new Date(prazo).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
    if (diff < 0) return { label: `${Math.abs(diff)}d atrasada`, color: "text-red-400" };
    if (diff === 0) return { label: "Hoje", color: "text-yellow-400" };
    if (diff <= 3) return { label: `${diff}d`, color: "text-yellow-400" };
    return { label: `${diff}d`, color: "text-green-400" };
  };

  const tempoExec = (t: Tarefa) => {
    if (t.status === "concluida" && t.iniciado_em && t.concluido_em) {
      const mins = Math.floor((new Date(t.concluido_em).getTime() - new Date(t.iniciado_em).getTime()) / 60000);
      return mins >= 60 ? `${Math.floor(mins / 60)}h ${mins % 60}m` : `${mins}m`;
    }
    if (t.status === "em_andamento" && t.iniciado_em) {
      const mins = Math.floor((Date.now() - new Date(t.iniciado_em).getTime()) / 60000);
      return mins >= 60 ? `${Math.floor(mins / 60)}h ${mins % 60}m` : `${mins}m`;
    }
    return null;
  };

  const colunas = [
    { status: "pendente", label: "Pendente", color: "border-yellow-500/30" },
    { status: "em_andamento", label: "Em Andamento", color: "border-blue-500/30" },
    { status: "concluida", label: "Concluida", color: "border-green-500/30" },
  ];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">Tarefas</h1>
        <Button size="sm" onClick={() => setShowModal(true)}><Plus size={14} className="mr-1" />Nova</Button>
      </div>

      {/* Filtros */}
      <div className="flex bg-muted rounded-lg p-0.5 w-fit">
        {[
          { key: "minhas", label: "Minhas" },
          { key: "criadas", label: "Criadas por mim" },
          { key: "todas", label: "Todas" },
        ].map((f) => (
          <button key={f.key} onClick={() => setFiltro(f.key)}
            className={`px-2.5 py-1 text-[10px] font-medium rounded-md ${filtro === f.key ? "bg-background text-foreground shadow-sm" : "text-muted-foreground"}`}>
            {f.label}
          </button>
        ))}
      </div>

      {/* Kanban */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">{[1,2,3].map((i) => <div key={i} className="h-48 bg-muted animate-pulse rounded-lg" />)}</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {colunas.map((col) => {
            const items = tarefas.filter((t) => t.status === col.status);
            return (
              <div key={col.status} className={`border rounded-lg ${col.color}`}>
                <div className="px-3 py-2 border-b flex items-center justify-between">
                  <span className="text-xs font-medium">{col.label}</span>
                  <Badge className="text-[9px] bg-muted">{items.length}</Badge>
                </div>
                <div className="p-2 space-y-2 max-h-[60vh] overflow-y-auto">
                  {items.length === 0 && <p className="text-xs text-muted-foreground text-center py-4">Nenhuma tarefa</p>}
                  {items.map((t) => {
                    const p = prazoInfo(t.prazo);
                    const tempo = tempoExec(t);
                    return (
                      <div key={t.id} className="border rounded-lg p-2.5 space-y-1.5 bg-card hover:bg-muted/20 transition-colors">
                        <div className="flex items-start justify-between gap-1">
                          <p className="text-xs font-medium leading-tight">{t.titulo}</p>
                          <div className="flex gap-0.5 shrink-0">
                            <Badge className={`text-[7px] ${PRIO_BADGE[t.prioridade]}`}>{t.prioridade}</Badge>
                          </div>
                        </div>
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <Badge className={`text-[7px] ${TIPO_BADGE[t.tipo]}`}>{TIPO_LABELS[t.tipo]}</Badge>
                          <span className={`text-[9px] ${p.color}`}>{p.label}</span>
                          {tempo && <span className="text-[9px] text-muted-foreground flex items-center gap-0.5"><Clock size={8} />{tempo}</span>}
                        </div>
                        <div className="text-[9px] text-muted-foreground">
                          {getNome(t.criado_por)} → <strong>{getNome(t.atribuido_para)}</strong>
                        </div>
                        <div className="flex gap-1 pt-1">
                          {STATUS_NEXT[t.status] && (
                            <Button size="sm" variant="ghost" className="h-5 px-1.5 text-[9px]" onClick={() => avancar(t)}>
                              <ChevronRight size={10} />Avancar
                            </Button>
                          )}
                          <Button size="sm" variant="ghost" className="h-5 px-1.5 text-[9px]" onClick={() => abrirDetalhes(t)}>
                            <MessageSquare size={10} className="mr-0.5" />Detalhes
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal Nova Tarefa */}
      {showModal && <NovaTarefaModal colaboradores={colaboradores} onClose={() => setShowModal(false)} onSaved={() => { setShowModal(false); loadTarefas(); }} />}

      {/* Modal Detalhes */}
      {editTarefa && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => { setEditTarefa(null); setComentarios([]); }}>
          <div className="bg-card border rounded-xl shadow-2xl p-6 w-full max-w-lg space-y-4 max-h-[80vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold">{editTarefa.titulo}</h3>
              <button onClick={() => { setEditTarefa(null); setComentarios([]); }}><X size={16} className="text-muted-foreground" /></button>
            </div>
            <div className="flex gap-2 flex-wrap">
              <Badge className={PRIO_BADGE[editTarefa.prioridade]}>{editTarefa.prioridade}</Badge>
              <Badge className={TIPO_BADGE[editTarefa.tipo]}>{TIPO_LABELS[editTarefa.tipo]}</Badge>
              <Badge className="bg-muted">{editTarefa.status.replace("_", " ")}</Badge>
            </div>
            {editTarefa.descricao && <p className="text-xs text-muted-foreground">{editTarefa.descricao}</p>}
            <div className="grid grid-cols-2 gap-2 text-xs">
              <span>Criado por: <strong>{getNome(editTarefa.criado_por)}</strong></span>
              <span>Atribuido: <strong>{getNome(editTarefa.atribuido_para)}</strong></span>
              <span>Prazo: <strong className={prazoInfo(editTarefa.prazo).color}>{new Date(editTarefa.prazo).toLocaleDateString("pt-BR")}</strong></span>
              {tempoExec(editTarefa) && <span>Tempo: <strong>{tempoExec(editTarefa)}</strong></span>}
            </div>

            {/* Ações rápidas */}
            <div className="flex gap-2">
              {STATUS_NEXT[editTarefa.status] && (
                <Button size="sm" onClick={async () => { await avancar(editTarefa); setEditTarefa(null); }}>
                  Avancar para {STATUS_NEXT[editTarefa.status]?.replace("_", " ")}
                </Button>
              )}
            </div>

            {/* Comentários */}
            <div className="border-t pt-3">
              <p className="text-xs font-medium mb-2">Comentarios ({comentarios.length})</p>
              <div className="space-y-2 max-h-32 overflow-y-auto mb-2">
                {comentarios.map((c) => (
                  <div key={c.id} className="text-xs p-2 bg-muted/30 rounded">
                    <div className="flex justify-between mb-0.5">
                      <span className="font-medium">{getNome(c.autor_id)}</span>
                      <span className="text-[9px] text-muted-foreground">{new Date(c.created_at).toLocaleString("pt-BR")}</span>
                    </div>
                    <p>{c.texto}</p>
                  </div>
                ))}
                {comentarios.length === 0 && <p className="text-xs text-muted-foreground text-center py-2">Nenhum comentario</p>}
              </div>
              <div className="flex gap-2">
                <Input value={novoComentario} onChange={(e) => setNovoComentario(e.target.value)} placeholder="Adicionar comentario..." className="text-xs" onKeyDown={(e) => e.key === "Enter" && enviarComentario()} />
                <Button size="sm" variant="outline" onClick={enviarComentario}><Send size={12} /></Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function NovaTarefaModal({ colaboradores, onClose, onSaved }: { colaboradores: { id: string; nome: string }[]; onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState({
    titulo: "", descricao: "", atribuido_para: "", tipo: "outro", prioridade: "media",
    prazo: new Date(Date.now() + 86400000).toISOString().slice(0, 16),
  });
  const [saving, setSaving] = useState(false);

  const salvar = async () => {
    if (!form.titulo) { toast.error("Titulo obrigatório"); return; }
    setSaving(true);
    const res = await fetch("/api/tarefas", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    if (res.ok) { toast.success("Tarefa criada"); onSaved(); }
    else toast.error("Erro ao criar");
    setSaving(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onClose}>
      <div className="bg-card border rounded-xl shadow-2xl p-6 w-full max-w-md space-y-4" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold">Nova Tarefa</h3>
          <button onClick={onClose}><X size={16} className="text-muted-foreground" /></button>
        </div>
        <div className="space-y-3">
          <div className="space-y-1"><Label className="text-xs">Titulo</Label><Input value={form.titulo} onChange={(e) => setForm({ ...form, titulo: e.target.value })} /></div>
          <div className="space-y-1"><Label className="text-xs">Descricao</Label><Input value={form.descricao} onChange={(e) => setForm({ ...form, descricao: e.target.value })} placeholder="Opcional" /></div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1"><Label className="text-xs">Atribuir para</Label>
              <select value={form.atribuido_para} onChange={(e) => setForm({ ...form, atribuido_para: e.target.value })} className="w-full text-sm bg-transparent border rounded-lg px-3 py-2">
                <option value="">Eu mesmo</option>
                {colaboradores.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
              </select>
            </div>
            <div className="space-y-1"><Label className="text-xs">Tipo</Label>
              <select value={form.tipo} onChange={(e) => setForm({ ...form, tipo: e.target.value })} className="w-full text-sm bg-transparent border rounded-lg px-3 py-2">
                <option value="outro">Outro</option><option value="lancamento">Lançamento</option>
                <option value="followup">Follow Up</option><option value="confirmacao_reuniao">Confirmar Reuniao</option>
                <option value="envio_proposta">Proposta</option><option value="interno">Interno</option>
              </select>
            </div>
            <div className="space-y-1"><Label className="text-xs">Prioridade</Label>
              <select value={form.prioridade} onChange={(e) => setForm({ ...form, prioridade: e.target.value })} className="w-full text-sm bg-transparent border rounded-lg px-3 py-2">
                <option value="baixa">Baixa</option><option value="media">Media</option>
                <option value="alta">Alta</option><option value="urgente">Urgente</option>
              </select>
            </div>
            <div className="space-y-1"><Label className="text-xs">Prazo</Label>
              <Input type="datetime-local" value={form.prazo} onChange={(e) => setForm({ ...form, prazo: e.target.value })} />
            </div>
          </div>
        </div>
        <div className="flex gap-2 justify-end">
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={salvar} disabled={saving}>{saving ? "Criando..." : "Criar"}</Button>
        </div>
      </div>
    </div>
  );
}
