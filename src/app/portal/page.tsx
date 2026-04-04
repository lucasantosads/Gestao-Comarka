"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { hashPassword, setCloserSession } from "@/lib/auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { LogIn } from "lucide-react";

export default function PortalLoginPage() {
  const router = useRouter();
  const [usuario, setUsuario] = useState("");
  const [senha, setSenha] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    if (!usuario.trim() || !senha.trim()) {
      toast.error("Preencha usuario e senha");
      return;
    }

    setLoading(true);
    const senhaHash = await hashPassword(senha);

    const { data: closer } = await supabase
      .from("closers")
      .select("*")
      .eq("usuario", usuario.trim().toLowerCase())
      .eq("senha_hash", senhaHash)
      .eq("ativo", true)
      .single();

    setLoading(false);

    if (!closer) {
      toast.error("Usuario ou senha incorretos");
      return;
    }

    setCloserSession(closer.id, closer.nome);
    router.push("/portal/painel");
  }

  return (
    <Card className="w-full max-w-sm">
      <CardHeader className="text-center">
        <CardTitle className="text-xl">Comarka Ads</CardTitle>
        <p className="text-sm text-muted-foreground">Portal do Closer</p>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleLogin} className="space-y-4">
          <div className="space-y-2">
            <Label>Usuario</Label>
            <Input
              value={usuario}
              onChange={(e) => setUsuario(e.target.value)}
              placeholder="seu.usuario"
              autoFocus
            />
          </div>
          <div className="space-y-2">
            <Label>Senha</Label>
            <Input
              type="password"
              value={senha}
              onChange={(e) => setSenha(e.target.value)}
              placeholder="********"
            />
          </div>
          <Button type="submit" disabled={loading} className="w-full">
            <LogIn size={16} className="mr-2" />
            {loading ? "Entrando..." : "Entrar"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
