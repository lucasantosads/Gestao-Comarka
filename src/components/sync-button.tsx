"use client";

import { useState } from "react";
import { toast } from "sonner";
import { RefreshCw } from "lucide-react";

export function SyncButton({ source = "all", onDone }: { source?: "meta" | "ghl" | "all"; onDone?: () => void }) {
  const [syncing, setSyncing] = useState(false);

  const sync = async () => {
    setSyncing(true);
    toast.info("Sincronizando dados...");
    try {
      const res = await fetch(`/api/sync?source=${source}&days=90`, { method: "POST" });
      const data = await res.json();
      if (data.ghl?.opportunities) {
        const attr = data.ghl.attributed ? ` (${data.ghl.attributed} com ad_id)` : "";
        toast.success(`GHL: ${data.ghl.opportunities} oportunidades${attr}`);
      }
      if (data.meta?.days) toast.success(`Meta Ads: últimos ${data.meta.days} dias atualizados`);
      if (data.ad_intelligence?.criativos_atualizados) toast.success(`Ad Intelligence: ${data.ad_intelligence.criativos_atualizados} criativos recalculados`);
      if (data.ghl?.error) toast.error(`GHL: ${data.ghl.error}`);
      if (data.meta?.error) toast.error(`Meta: ${data.meta.error}`);
      if (onDone) onDone();
    } catch {
      toast.error("Erro na sincronização");
    }
    setSyncing(false);
  };

  return (
    <button onClick={sync} disabled={syncing} title="Sincronizar dados agora"
      className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium border rounded-lg hover:bg-muted transition-colors ${syncing ? "opacity-50" : ""}`}>
      <RefreshCw size={12} className={syncing ? "animate-spin" : ""} />
      {syncing ? "Sincronizando..." : "Atualizar Dados"}
    </button>
  );
}
