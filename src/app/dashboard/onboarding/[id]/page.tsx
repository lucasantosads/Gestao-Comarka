"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { formatCurrency } from "@/lib/format";
import { ArrowLeft, CheckSquare } from "lucide-react";
import Link from "next/link";
import type { OnboardingItem, NotionBlock } from "@/lib/data";

interface CheckItem { block_id: string; text: string; checked: boolean }
interface Section { title: string; items: CheckItem[] }

function parseChecklists(blocks: NotionBlock[]): Section[] {
  const sections: Section[] = [];
  let currentSection: Section | null = null;

  for (const block of blocks) {
    if (block.type === "heading_1" || block.type === "heading_2" || block.type === "heading_3") {
      const h = block[block.type] as { rich_text: { plain_text: string }[] };
      const title = (h.rich_text || []).map((t) => t.plain_text).join("");
      currentSection = { title, items: [] };
      sections.push(currentSection);
    } else if (block.type === "callout") {
      const c = block.callout as { rich_text: { plain_text: string }[] };
      const text = (c.rich_text || []).map((t) => t.plain_text).join("");
      if (currentSection) currentSection.title += ` — ${text}`;
    } else if (block.type === "to_do") {
      const td = block.to_do as { rich_text: { plain_text: string }[]; checked: boolean };
      const text = (td.rich_text || []).map((t) => t.plain_text).join("");
      const item: CheckItem = { block_id: block.id, text, checked: td.checked };
      if (currentSection) currentSection.items.push(item);
      else {
        currentSection = { title: "Checklist", items: [item] };
        sections.push(currentSection);
      }
    }
  }
  return sections.filter((s) => s.items.length > 0);
}

export default function OnboardingDetalhePage() {
  const { id } = useParams();
  const [item, setItem] = useState<(OnboardingItem & { blocks?: NotionBlock[] }) | null>(null);
  const [sections, setSections] = useState<Section[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch(`/api/notion/onboarding/${id}`);
    const data = await res.json();
    if (!data.error) {
      setItem(data);
      setSections(parseChecklists(data.blocks || []));
    }
    setLoading(false);
  }, [id]);

  useEffect(() => { load(); }, [load]);

  const toggleItem = async (blockId: string, checked: boolean) => {
    // Optimistic
    setSections((prev) => prev.map((s) => ({
      ...s, items: s.items.map((i) => i.block_id === blockId ? { ...i, checked } : i),
    })));
    const res = await fetch("/api/notion/update", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ notion_id: blockId, field: "checklist_toggle", value: String(checked) }),
    });
    const data = await res.json();
    if (!data.success) { toast.error(data.error || "Erro"); load(); }
  };

  if (loading) return <div className="flex items-center justify-center h-64"><p className="text-muted-foreground">Carregando...</p></div>;
  if (!item) return <div className="text-center py-12"><p className="text-muted-foreground">Item não encontrado</p></div>;

  const totalItems = sections.reduce((s, sec) => s + sec.items.length, 0);
  const doneItems = sections.reduce((s, sec) => s + sec.items.filter((i) => i.checked).length, 0);
  const progressPct = totalItems > 0 ? (doneItems / totalItems) * 100 : 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link href="/dashboard/onboarding"><Button variant="ghost" size="sm"><ArrowLeft size={16} /></Button></Link>
        <div>
          <h1 className="text-2xl font-bold">{item.nome}</h1>
          <div className="flex items-center gap-2 mt-1">
            <Badge className="text-xs bg-indigo-500/15 text-indigo-400">{item.etapa}</Badge>
            {item.plataformas && item.plataformas.split(",").map((p) => (
              <Badge key={p.trim()} className="text-[8px] bg-blue-500/15 text-blue-400">{p.trim()}</Badge>
            ))}
            {item.orcamento && <span className="text-xs font-mono text-muted-foreground">{formatCurrency(Number(item.orcamento))}</span>}
            {item.gestor && <span className="text-xs text-muted-foreground">Gestor: {item.gestor}</span>}
          </div>
        </div>
      </div>

      {/* Progresso geral */}
      <Card>
        <CardContent className="pt-4 pb-3">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium">Progresso geral</span>
            <span className="text-sm font-mono">{doneItems}/{totalItems} ({progressPct.toFixed(0)}%)</span>
          </div>
          <div className="h-3 bg-muted rounded-full overflow-hidden">
            <div className="h-full bg-green-500 rounded-full transition-all" style={{ width: `${progressPct}%` }} />
          </div>
        </CardContent>
      </Card>

      {/* Checklists por seção */}
      {sections.map((sec, si) => {
        const secDone = sec.items.filter((i) => i.checked).length;
        const secPct = sec.items.length > 0 ? (secDone / sec.items.length) * 100 : 0;
        return (
          <Card key={si}>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm flex items-center gap-2">
                  <CheckSquare size={14} className={secPct === 100 ? "text-green-400" : "text-muted-foreground"} />
                  {sec.title}
                </CardTitle>
                <Badge className={`text-[9px] ${secPct === 100 ? "bg-green-500/15 text-green-400" : "bg-muted text-muted-foreground"}`}>
                  {secDone}/{sec.items.length}
                </Badge>
              </div>
              <div className="h-1.5 bg-muted rounded-full overflow-hidden mt-2">
                <div className={`h-full rounded-full transition-all ${secPct === 100 ? "bg-green-500" : "bg-indigo-500"}`} style={{ width: `${secPct}%` }} />
              </div>
            </CardHeader>
            <CardContent className="space-y-1">
              {sec.items.map((check) => (
                <label key={check.block_id} className="flex items-center gap-2.5 px-2 py-1.5 rounded hover:bg-muted/30 cursor-pointer transition-colors">
                  <input type="checkbox" checked={check.checked}
                    onChange={(e) => toggleItem(check.block_id, e.target.checked)}
                    className="rounded border-muted-foreground w-4 h-4" />
                  <span className={`text-sm ${check.checked ? "line-through text-muted-foreground" : ""}`}>{check.text}</span>
                </label>
              ))}
            </CardContent>
          </Card>
        );
      })}

      {sections.length === 0 && (
        <Card><CardContent className="py-12 text-center">
          <CheckSquare size={32} className="mx-auto mb-2 text-muted-foreground opacity-30" />
          <p className="text-sm text-muted-foreground">Nenhum checklist encontrado para este item</p>
        </CardContent></Card>
      )}
    </div>
  );
}
