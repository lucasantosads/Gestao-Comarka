"use client";

import { useEffect, useState, useMemo, useCallback } from "react";
import useSWR, { mutate as globalMutate } from "swr";
import { supabase } from "@/lib/supabase";
import type { LeadCrm, Closer, Sdr } from "@/types/database";
import { toast } from "sonner";

export interface CrmDataReturn {
    leads: LeadCrm[];
    closers: Closer[];
    sdrs: Sdr[];
    loading: boolean;
    mutate: () => void;
    updateLead: (id: string, campo: keyof LeadCrm, valor: any) => Promise<void>;
    mudarEtapa: (id: string, novaEtapa: string) => Promise<void>;
    addNovoLead: (etapa: string, mesRef: string) => Promise<LeadCrm | null>;
    deleteLead: (id: string) => Promise<void>;
}

export function useCrmData(): CrmDataReturn {
    const { data, mutate } = useSWR(
        "crm-data",
        async () => {
            const [{ data: l }, { data: c }, { data: s }] = await Promise.all([
                supabase.from("leads_crm").select("*").order("ghl_created_at", { ascending: false, nullsFirst: false }).limit(2000),
                supabase.from("closers").select("*").eq("ativo", true).order("nome"),
                supabase.from("sdrs").select("*").eq("ativo", true).order("nome"),
            ]);
            return { leads: (l || []) as LeadCrm[], closers: (c || []) as Closer[], sdrs: (s || []) as Sdr[] };
        },
        { revalidateOnFocus: false, dedupingInterval: 5000 }
    );

    const leads = data?.leads || [];
    const closers = data?.closers || [];
    const sdrs = data?.sdrs || [];
    const loading = !data;

    // Real-time (debounced)
    useEffect(() => {
        let timeoutId: NodeJS.Timeout;
        const triggerLoad = () => {
            clearTimeout(timeoutId);
            timeoutId = setTimeout(() => mutate(), 2000);
        };

        const ch = supabase.channel("leads_crm_rt2")
            .on("postgres_changes", { event: "*", schema: "public", table: "leads_crm" }, triggerLoad)
            .subscribe();

        return () => { clearTimeout(timeoutId); supabase.removeChannel(ch); };
    }, [mutate]);

    const updateLead = useCallback(async (id: string, campo: keyof LeadCrm, valor: any) => {
        const oldLeads = data?.leads;
        const oldLead = oldLeads?.find((l) => l.id === id);
        if (!oldLeads || !oldLead) return;

        // Mutação Otimista
        mutate((prev) => prev ? { ...prev, leads: prev.leads.map((l) => (l.id === id ? { ...l, [campo]: valor } : l)) } : undefined, false);

        const { error } = await supabase.from("leads_crm").update({ [campo]: valor }).eq("id", id);
        if (error) {
            // Rollback
            mutate((prev) => prev ? { ...prev, leads: prev.leads.map((l) => (l.id === id ? oldLead : l)) } : undefined, false);
            toast.error("Erro ao salvar o lead no banco.");
        }
    }, [data, mutate]);

    const mudarEtapa = useCallback(async (id: string, novaEtapa: string) => {
        const oldLeads = data?.leads;
        const lead = oldLeads?.find((l) => l.id === id);
        if (!oldLeads || !lead) return;

        const agora = new Date().toISOString();
        const df: Record<string, string> = { reuniao_agendada: "data_reuniao_agendada", proposta_enviada: "data_proposta_enviada", follow_up: "data_follow_up", assinatura_contrato: "data_assinatura", comprou: "data_comprou", desistiu: "data_desistiu" };
        const upd: Partial<LeadCrm> = { etapa: novaEtapa };
        if (df[novaEtapa]) (upd as any)[df[novaEtapa]] = agora;
        if (novaEtapa === "comprou") upd.data_venda = agora.split("T")[0];

        // Rollback state pre-mutation
        mutate((prev) => prev ? { ...prev, leads: prev.leads.map((l) => (l.id === id ? { ...l, ...upd } : l)) } : undefined, false);

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
                    toast.success("Contrato gerado e vinculado automaticamente!");
                    // Invalida cache global do dashboard via pattern regex keys in SWR
                    globalMutate((key) => Array.isArray(key) && key[0] === 'dashboard-db');
                }
            } catch (err: any) {
                toast.error("Venda migrada para Comprou, mas falha ao criar o Contrato. Preencha na Aba Contratos manualmente.");
                console.error("Erro contrato:", err);
            }
        }

        const { error } = await supabase.from("leads_crm").update(upd).eq("id", id);
        if (error) {
            mutate((prev) => prev ? { ...prev, leads: prev.leads.map((l) => (l.id === id ? lead : l)) } : undefined, false);
            toast.error("Tentativa falhou. Rollback revertendo o visual.");
            return;
        }

        await supabase.from("leads_crm_historico").insert({ lead_id: id, etapa_anterior: lead.etapa, etapa_nova: novaEtapa });

        // Garantir state final
        if (contratoIdToLink) {
            mutate((prev) => prev ? { ...prev, leads: prev.leads.map((l) => (l.id === id ? { ...l, contrato_id: contratoIdToLink } : l)) } : undefined, false);
        }
    }, [data, mutate]);

    const addNovoLead = useCallback(async (etapa: string, mesRef: string) => {
        const { data: dataRow, error } = await supabase.from("leads_crm").insert({
            nome: "", etapa: etapa || "oportunidade", mes_referencia: mesRef, ghl_contact_id: `manual-${Date.now()}`,
        }).select().single();

        if (error) { toast.error("Erro ao criar lead: " + error.message); return null; }

        if (dataRow) {
            mutate((prev) => prev ? { ...prev, leads: [dataRow as LeadCrm, ...prev.leads] } : undefined, false);
            return dataRow as LeadCrm;
        }
        return null;
    }, [mutate]);

    const deleteLead = useCallback(async (id: string) => {
        if (!confirm("Excluir este lead permanentemente?")) return;
        mutate((prev) => prev ? { ...prev, leads: prev.leads.filter((l) => l.id !== id) } : undefined, false);
        await supabase.from("leads_crm").delete().eq("id", id);
        toast.success("Lead excluido");
    }, [mutate]);

    return { leads, closers, sdrs, loading, mutate, updateLead, mudarEtapa, addNovoLead, deleteLead };
}
