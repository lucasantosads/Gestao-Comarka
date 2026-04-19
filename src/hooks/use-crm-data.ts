"use client";

import { useEffect, useState, useMemo, useCallback, useRef } from "react";
import useSWR, { mutate as globalMutate } from "swr";
import { supabase } from "@/lib/supabase";
import type { LeadCrm, Closer, Sdr, Contrato } from "@/types/database";
import { toast } from "sonner";

const PAGE_SIZE = 50;

export interface CrmDataReturn {
    leads: LeadCrm[];
    closers: Closer[];
    sdrs: Sdr[];
    contratosMap: Record<string, Contrato>;
    loading: boolean;
    mutate: () => void;
    updateLead: (id: string, campo: keyof LeadCrm, valor: any) => Promise<void>;
    mudarEtapa: (id: string, novaEtapa: string) => Promise<void>;
    addNovoLead: (etapa: string, mesRef: string, extra?: { nome?: string; telefone?: string; email?: string; ghl_contact_id?: string; lead_avulso?: boolean; fonte_avulso?: string }) => Promise<LeadCrm | null>;
    deleteLead: (id: string) => Promise<void>;
    loadMore: () => Promise<void>;
    hasMore: boolean;
    totalCount: number;
    loadingMore: boolean;
}

export function useCrmData(): CrmDataReturn {
    const [allLeads, setAllLeads] = useState<LeadCrm[]>([]);
    const [contratosMap, setContratosMap] = useState<Record<string, Contrato>>({});
    const [hasMore, setHasMore] = useState(true);
    const [totalCount, setTotalCount] = useState(0);
    const [loadingMore, setLoadingMore] = useState(false);
    const cursorRef = useRef<{ ghl_created_at: string | null; id: string } | null>(null);

    const { data, mutate } = useSWR(
        "crm-data",
        async () => {
            // Busca total count e primeira página de leads + closers/sdrs
            const [{ count }, { data: l }, { data: c }, { data: s }] = await Promise.all([
                supabase.from("leads_crm").select("id", { count: "exact", head: true }),
                supabase.from("leads_crm").select("*").order("ghl_created_at", { ascending: false, nullsFirst: false }).order("id", { ascending: false }).limit(PAGE_SIZE),
                supabase.from("closers").select("*").eq("ativo", true).order("nome"),
                supabase.from("sdrs").select("*").eq("ativo", true).order("nome"),
            ]);
            const leads = (l || []) as LeadCrm[];
            const total = count || 0;

            // Atualiza cursor
            if (leads.length > 0) {
                const last = leads[leads.length - 1];
                cursorRef.current = { ghl_created_at: last.ghl_created_at, id: last.id };
            } else {
                cursorRef.current = null;
            }

            setAllLeads(leads);
            setTotalCount(total);
            setHasMore(leads.length < total);

            return { closers: (c || []) as Closer[], sdrs: (s || []) as Sdr[] };
        },
        { revalidateOnFocus: false, dedupingInterval: 5000 }
    );

    const closers = data?.closers || [];
    const sdrs = data?.sdrs || [];
    const loading = !data;

    // Batch-fetch contratos for leads that have contrato_id
    const fetchContratos = useCallback(async (leads: LeadCrm[]) => {
        const ids = leads.map((l) => l.contrato_id).filter(Boolean) as string[];
        // Remove ids we already have
        const newIds = ids.filter((id) => !contratosMap[id]);
        if (newIds.length === 0) return;
        const { data: cData } = await supabase
            .from("contratos")
            .select("id, data_fechamento, mrr, valor_entrada, valor_total_projeto, meses_contrato, cliente_nome")
            .in("id", newIds);
        if (cData && cData.length > 0) {
            setContratosMap((prev) => {
                const next = { ...prev };
                for (const c of cData) next[c.id] = c as Contrato;
                return next;
            });
        }
    }, [contratosMap]);

    // Fetch contratos whenever allLeads changes
    useEffect(() => {
        if (allLeads.length > 0) fetchContratos(allLeads);
    }, [allLeads]); // eslint-disable-line react-hooks/exhaustive-deps

    // Carregar mais leads (cursor-based)
    const loadMore = useCallback(async () => {
        if (!hasMore || loadingMore || !cursorRef.current) return;
        setLoadingMore(true);
        try {
            const cursor = cursorRef.current;
            // Cursor-based: busca leads com ghl_created_at menor que o cursor,
            // ou igual mas com id menor (desempate)
            let query = supabase
                .from("leads_crm")
                .select("*")
                .order("ghl_created_at", { ascending: false, nullsFirst: false })
                .order("id", { ascending: false })
                .limit(PAGE_SIZE);

            if (cursor.ghl_created_at) {
                query = query.or(`ghl_created_at.lt.${cursor.ghl_created_at},and(ghl_created_at.eq.${cursor.ghl_created_at},id.lt.${cursor.id})`);
            } else {
                query = query.lt("id", cursor.id);
            }

            const { data: newLeads } = await query;
            const batch = (newLeads || []) as LeadCrm[];

            if (batch.length > 0) {
                const last = batch[batch.length - 1];
                cursorRef.current = { ghl_created_at: last.ghl_created_at, id: last.id };
                setAllLeads((prev) => {
                    const existingIds = new Set(prev.map((l) => l.id));
                    const unique = batch.filter((l) => !existingIds.has(l.id));
                    return [...prev, ...unique];
                });
            }
            if (batch.length < PAGE_SIZE) setHasMore(false);
        } finally {
            setLoadingMore(false);
        }
    }, [hasMore, loadingMore]);

    // Real-time (debounced)
    useEffect(() => {
        let timeoutId: NodeJS.Timeout;
        const triggerLoad = () => {
            clearTimeout(timeoutId);
            timeoutId = setTimeout(() => {
                cursorRef.current = null;
                setAllLeads([]);
                setHasMore(true);
                mutate();
            }, 2000);
        };

        const ch = supabase.channel("leads_crm_rt2")
            .on("postgres_changes", { event: "*", schema: "public", table: "leads_crm" }, triggerLoad)
            .subscribe();

        return () => { clearTimeout(timeoutId); supabase.removeChannel(ch); };
    }, [mutate]);

    const updateLead = useCallback(async (id: string, campo: keyof LeadCrm, valor: any) => {
        const oldLead = allLeads.find((l) => l.id === id);
        if (!oldLead) return;

        // Mutação Otimista
        setAllLeads((prev) => prev.map((l) => (l.id === id ? { ...l, [campo]: valor } : l)));

        const { error } = await supabase.from("leads_crm").update({ [campo]: valor }).eq("id", id);
        if (error) {
            // Rollback
            setAllLeads((prev) => prev.map((l) => (l.id === id ? oldLead : l)));
            toast.error("Erro ao salvar o lead no banco.");
        }
    }, [allLeads]);

    const mudarEtapa = useCallback(async (id: string, novaEtapa: string) => {
        const lead = allLeads.find((l) => l.id === id);
        if (!lead) return;

        const agora = new Date().toISOString();
        const df: Record<string, string> = { reuniao_agendada: "data_reuniao_agendada", proposta_enviada: "data_proposta_enviada", follow_up: "data_follow_up", assinatura_contrato: "data_assinatura", comprou: "data_comprou", desistiu: "data_desistiu" };
        const upd: Partial<LeadCrm> = { etapa: novaEtapa as LeadCrm["etapa"] };
        if (df[novaEtapa]) (upd as any)[df[novaEtapa]] = agora;
        if (novaEtapa === "comprou") upd.data_venda = agora.split("T")[0];

        // Mutação otimista
        setAllLeads((prev) => prev.map((l) => (l.id === id ? { ...l, ...upd } : l)));

        // Auto Contrato
        let contratoIdToLink = null;
        if (novaEtapa === "comprou" && lead.etapa !== "comprou") {
            try {
                const { data: contrato, error: contratoErr } = await supabase.from("contratos").insert({
                    mes_referencia: lead.mes_referencia || agora.slice(0, 7),
                    closer_id: lead.closer_id || null,
                    sdr_id: lead.sdr_id || null,
                    cliente_nome: lead.nome || "Sem nome",
                    origem_lead: lead.canal_aquisicao || lead.funil || "—",
                    valor_entrada: Number(lead.valor_entrada) || 0,
                    meses_contrato: Number(lead.fidelidade_meses) || 6,
                    mrr: Number(lead.mensalidade) || 0,
                    data_fechamento: agora.split("T")[0],
                    obs: "",
                }).select("id").single();

                if (contratoErr) throw contratoErr;

                if (contrato?.id) {
                    contratoIdToLink = contrato.id;
                    upd.contrato_id = contrato.id;
                }

                // Auto Entrada (clientes_receita) — trigger cria clientes_notion_mirror
                const closerNome = closers.find((c) => c.id === lead.closer_id)?.nome || "";
                const { error: entradaErr } = await supabase.from("clientes_receita").insert({
                    nome: lead.nome || "Sem nome",
                    plataforma: "META",
                    valor_mensal: Number(lead.mensalidade) || 0,
                    closer: closerNome,
                    tipo_contrato: "mensal",
                    dia_pagamento: null,
                    status: "ativo",
                    status_financeiro: "ativo",
                    mes_fechamento: agora.slice(0, 7) + "-01",
                    fidelidade_meses: Number(lead.fidelidade_meses) || null,
                });
                if (entradaErr) console.error("Erro entrada:", entradaErr);

                // Auto Onboarding
                const onbId = "local_" + crypto.randomUUID();
                const [{ error: onbErr }, { error: trackErr }] = await Promise.all([
                    supabase.from("onboarding_notion_mirror").insert({
                        notion_id: onbId,
                        nome: lead.nome || "Sem nome",
                        etapa: "Passagem de bastão",
                        orcamento_mensal: Number(lead.mensalidade) || 0,
                        ultimo_sync_em: agora,
                        editado_em: agora,
                    }),
                    supabase.from("onboarding_tracking").insert({
                        notion_id: onbId,
                        cliente_nome: lead.nome || "Sem nome",
                        iniciado_em: agora,
                        etapa_atual: "Passagem de bastão",
                        etapa_entrada_em: agora,
                    }),
                ]);
                if (onbErr) console.error("Erro onboarding mirror:", onbErr);
                if (trackErr) console.error("Erro onboarding tracking:", trackErr);

                toast.success("Contrato, entrada e onboarding criados automaticamente!");
                globalMutate((key) => Array.isArray(key) && key[0] === 'dashboard-db');
            } catch (err: any) {
                toast.error("Venda migrada para Comprou, mas falha ao criar registros. Verifique Contratos/Entradas manualmente.");
                console.error("Erro ao processar compra:", err);
            }
        }

        const { error } = await supabase.from("leads_crm").update(upd).eq("id", id);
        if (error) {
            setAllLeads((prev) => prev.map((l) => (l.id === id ? lead : l)));
            toast.error("Tentativa falhou. Rollback revertendo o visual.");
            return;
        }

        await supabase.from("leads_crm_historico").insert({ lead_id: id, etapa_anterior: lead.etapa, etapa_nova: novaEtapa });

        if (contratoIdToLink) {
            setAllLeads((prev) => prev.map((l) => (l.id === id ? { ...l, contrato_id: contratoIdToLink } : l)));
        }
    }, [allLeads, mutate]);

    const addNovoLead = useCallback(async (etapa: string, mesRef: string, extra?: { nome?: string; telefone?: string; email?: string; ghl_contact_id?: string; lead_avulso?: boolean; fonte_avulso?: string }) => {
        const { data: dataRow, error } = await supabase.from("leads_crm").insert({
            nome: extra?.nome || "",
            etapa: etapa || "oportunidade",
            mes_referencia: mesRef,
            ghl_contact_id: extra?.ghl_contact_id || `manual-${Date.now()}`,
            telefone: extra?.telefone || null,
            email: extra?.email || null,
            lead_avulso: extra?.lead_avulso || false,
            fonte_avulso: extra?.fonte_avulso || null,
        }).select().single();

        if (error) { toast.error("Erro ao criar lead: " + error.message); return null; }

        if (dataRow) {
            const newLead = dataRow as LeadCrm;
            setAllLeads((prev) => [newLead, ...prev]);
            setTotalCount((prev) => prev + 1);
            return newLead;
        }
        return null;
    }, []);

    const deleteLead = useCallback(async (id: string) => {
        if (!confirm("Excluir este lead permanentemente?")) return;
        setAllLeads((prev) => prev.filter((l) => l.id !== id));
        setTotalCount((prev) => Math.max(0, prev - 1));
        await supabase.from("leads_crm").delete().eq("id", id);
        toast.success("Lead excluido");
    }, []);

    return { leads: allLeads, closers, sdrs, contratosMap, loading, mutate, updateLead, mudarEtapa, addNovoLead, deleteLead, loadMore, hasMore, totalCount, loadingMore };
}
