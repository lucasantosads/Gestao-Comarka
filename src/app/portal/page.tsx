"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
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
    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ usuario: usuario.trim().toLowerCase(), senha }),
    });
    const data = await res.json();
    setLoading(false);

    if (!res.ok || data.error) {
      toast.error(data.error || "Erro ao entrar");
      return;
    }

    toast.success(`Bem-vindo, ${data.nome}!`);

    if (data.role === "admin") {
      router.push("/dashboard");
    } else if (data.role === "sdr") {
      router.push("/portal/painel-sdr");
    } else {
      router.push("/portal/painel");
    }
  }

  return (
    <Card className="w-full max-w-sm">
      <CardHeader className="text-center">
        <CardTitle className="text-xl">Comarka Ads</CardTitle>
        <p className="text-sm text-muted-foreground">Portal do Colaborador</p>
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
