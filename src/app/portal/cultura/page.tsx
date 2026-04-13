"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

export default function CulturaPage() {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";
  const [conteudo, setConteudo] = useState("");
  const [atualizadoEm, setAtualizadoEm] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    const res = await fetch("/api/portal/conteudo/cultura");
    const data = await res.json();
    setConteudo(data.conteudo || "");
    setAtualizadoEm(data.atualizado_em);
  };

  useEffect(() => { load(); }, []);

  const salvar = async () => {
    setSaving(true);
    const res = await fetch("/api/portal/conteudo/cultura", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ conteudo }),
    });
    if (res.ok) { toast.success("Salvo"); setEditing(false); load(); }
    else toast.error("Erro ao salvar");
    setSaving(false);
  };

  return (
    <div className="w-full max-w-3xl space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">Cultura</h1>
        {isAdmin && !editing && <Button size="sm" onClick={() => setEditing(true)}>Editar</Button>}
      </div>
      {editing ? (
        <div className="space-y-2">
          <textarea
            className="w-full min-h-[400px] bg-transparent border rounded-lg p-3 text-sm font-mono"
            value={conteudo}
            onChange={(e) => setConteudo(e.target.value)}
          />
          <div className="flex gap-2 justify-end">
            <Button size="sm" variant="outline" onClick={() => { setEditing(false); load(); }}>Cancelar</Button>
            <Button size="sm" onClick={salvar} disabled={saving}>{saving ? "Salvando..." : "Salvar"}</Button>
          </div>
        </div>
      ) : (
        <div className="prose prose-invert max-w-none whitespace-pre-wrap text-sm">{conteudo || "—"}</div>
      )}
      {atualizadoEm && (
        <p className="text-[10px] text-muted-foreground">
          Última atualização: {new Date(atualizadoEm).toLocaleString("pt-BR")}
        </p>
      )}
    </div>
  );
}
