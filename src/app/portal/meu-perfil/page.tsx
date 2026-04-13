"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/lib/supabase";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { User, Calendar, Phone, Shield } from "lucide-react";

export default function MeuPerfilPage() {
  const { user } = useAuth();
  const [employee, setEmployee] = useState<Record<string, unknown> | null>(null);
  const [telefone, setTelefone] = useState("");
  const [senhaAtual, setSenhaAtual] = useState("");
  const [senhaNova, setSenhaNova] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!user) return;
    supabase.from("employees").select("*").eq("id", user.employeeId).single()
      .then(({ data }) => {
        if (data) {
          setEmployee(data);
          setTelefone(data.telefone || "");
        }
      });
  }, [user]);

  const salvarPerfil = async () => {
    if (!user) return;
    setSaving(true);
    const { error } = await supabase.from("employees")
      .update({ telefone, updated_at: new Date().toISOString() })
      .eq("id", user.employeeId);
    if (error) toast.error("Erro ao salvar");
    else toast.success("Perfil atualizado");
    setSaving(false);
  };

  const alterarSenha = async () => {
    if (!senhaNova || senhaNova.length < 6) { toast.error("Senha deve ter pelo menos 6 caracteres"); return; }
    setSaving(true);
    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ usuario: employee?.usuario, senha: senhaAtual }),
    });
    if (!res.ok) { toast.error("Senha atual incorreta"); setSaving(false); return; }

    const encoder = new TextEncoder();
    const hashBuffer = await crypto.subtle.digest("SHA-256", encoder.encode(senhaNova));
    const hash = Array.from(new Uint8Array(hashBuffer)).map((b) => b.toString(16).padStart(2, "0")).join("");

    const { error } = await supabase.from("employees").update({ senha_hash: hash }).eq("id", user!.employeeId);
    if (error) toast.error("Erro ao alterar senha");
    else { toast.success("Senha alterada"); setSenhaAtual(""); setSenhaNova(""); }
    setSaving(false);
  };

  if (!employee) return <div className="h-64 flex items-center justify-center text-muted-foreground">Carregando...</div>;

  const roleBadge = { admin: "bg-red-500/15 text-red-400", closer: "bg-green-500/15 text-green-400", sdr: "bg-blue-500/15 text-blue-400" };

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-bold">Meu Perfil</h1>

      <Card>
        <CardHeader><CardTitle className="text-sm flex items-center gap-2"><User size={14} /> Dados Pessoais</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center text-lg font-bold">
              {(employee.nome as string)?.charAt(0)}
            </div>
            <div>
              <p className="font-medium">{employee.nome as string}</p>
              <Badge className={`text-[9px] ${roleBadge[user!.role]}`}>{user!.role === "closer" ? "Closer" : user!.role === "sdr" ? "SDR" : "Administrador"}</Badge>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs flex items-center gap-1"><Shield size={10} /> Usuario</Label>
              <Input value={employee.usuario as string} disabled />
            </div>
            <div className="space-y-1">
              <Label className="text-xs flex items-center gap-1"><Phone size={10} /> Telefone</Label>
              <Input value={telefone} onChange={(e) => setTelefone(e.target.value)} placeholder="(00) 00000-0000" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs flex items-center gap-1"><Calendar size={10} /> Data de Admissao</Label>
              <Input value={employee.data_admissao ? new Date(employee.data_admissao as string).toLocaleDateString("pt-BR") : "Nao informado"} disabled />
            </div>
          </div>

          <Button size="sm" onClick={salvarPerfil} disabled={saving}>{saving ? "Salvando..." : "Salvar"}</Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-sm">Alterar Senha</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs">Senha atual</Label>
              <Input type="password" value={senhaAtual} onChange={(e) => setSenhaAtual(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Nova senha</Label>
              <Input type="password" value={senhaNova} onChange={(e) => setSenhaNova(e.target.value)} />
            </div>
          </div>
          <Button size="sm" variant="outline" onClick={alterarSenha} disabled={saving}>Alterar Senha</Button>
        </CardContent>
      </Card>
    </div>
  );
}
