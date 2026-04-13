"use client";

import { useEffect, useMemo, useState } from "react";
import useSWR from "swr";
import { supabase } from "@/lib/supabase";
import { format } from "date-fns";
import type { Closer, LancamentoDiario, Contrato, MetaMensal, MetaCloser, LeadCrm } from "@/types/database";
import { calcKpis, type KpiData } from "@/lib/kpis";

export interface DashboardData {
    kpis: KpiData | null;
    prevKpis: KpiData | null;
    meta: MetaMensal | null;
    contratos: Contrato[];
    closers: Closer[];
    lancamentos: LancamentoDiario[];
    crmLeads: LeadCrm[];
    sdrAlerts: { msg: string; tipo: "erro" | "aviso" | "qualificacao_baixa" | "desqualificacao_alta" }[];
    ghlClosersOpen: { name: string; aberto: number }[];
    churnData: { churnsAtivos: number; mrrEmRisco: number; mrrPerdidoMes: number; churnRate: number } | null;
    custosOp: number;
    loading: boolean;
    alertas: { msg: string; tipo: "aviso" | "erro" }[];
    metasClosers: Record<string, MetaCloser>;
    loadData: () => void;
    attrStart: string | null;
    apiErrors: string[];
}

export function useDashboardData(period: any) {
    const mes = format(period.current.start, "yyyy-MM");
    const startDate = format(period.current.start, "yyyy-MM-dd");
    const endDate = format(period.current.end, "yyyy-MM-dd");
    const prevStartDate = format(period.previous.start, "yyyy-MM-dd");
    const prevEndDate = format(period.previous.end, "yyyy-MM-dd");

    // O Mês base de comparação anterior precisa usar a lógica exata de recuo
    const prevDateObj = new Date(`${mes}-01T12:00:00Z`);
    prevDateObj.setMonth(prevDateObj.getMonth() - 1);
    const prevMes = format(prevDateObj, "yyyy-MM");

    const [apiErrors, setApiErrors] = useState<string[]>([]);
    const addError = (err: string) => setApiErrors(p => p.includes(err) ? p : [...p, err]);

    // 1. SWR Core DB
    const { data: dbData, mutate: mutateDb, isLoading: isDbLoading } = useSWR(
        ['dashboard-db', mes, period.mode, startDate, endDate],
        async () => {
            const isMesMode = period.mode === "mes";
            const lancQuery = isMesMode ? supabase.from("lancamentos_diarios").select("*").eq("mes_referencia", mes) : supabase.from("lancamentos_diarios").select("*").gte("data", startDate).lte("data", endDate);
            const prevLancQuery = isMesMode ? supabase.from("lancamentos_diarios").select("*").eq("mes_referencia", prevMes) : supabase.from("lancamentos_diarios").select("*").gte("data", prevStartDate).lte("data", prevEndDate);
            const crmQuery = isMesMode ? supabase.from("leads_crm").select("etapa,valor_total_projeto,closer_id,canal_aquisicao,funil,mes_referencia").eq("mes_referencia", mes) : supabase.from("leads_crm").select("etapa,valor_total_projeto,closer_id,canal_aquisicao,funil,mes_referencia").gte("ghl_created_at", startDate).lte("ghl_created_at", endDate + "T23:59:59");
            const contratosQuery = isMesMode ? supabase.from("contratos").select("*").eq("mes_referencia", mes).order("data_fechamento") : supabase.from("contratos").select("*").gte("data_fechamento", startDate).lte("data_fechamento", endDate).order("data_fechamento");
            const adsQuery = supabase.from("ads_performance").select("spend, leads").gte("data_ref", startDate).lte("data_ref", endDate);
            const prevAdsQuery = supabase.from("ads_performance").select("spend, leads").gte("data_ref", prevStartDate).lte("data_ref", prevEndDate);

            const [{ data: lances }, { data: prevLances }, { data: config }, { data: prevConfig }, { data: closersData }, { data: contratosData }, { data: metaData }, { data: mcData }, { data: crmData }, { data: adsPerf }, { data: prevAdsPerf }] = await Promise.all([
                lancQuery, prevLancQuery,
                supabase.from("config_mensal").select("*").eq("mes_referencia", mes).single(),
                supabase.from("config_mensal").select("*").eq("mes_referencia", prevMes).single(),
                supabase.from("closers").select("*").eq("ativo", true).order("created_at"),
                contratosQuery,
                supabase.from("metas_mensais").select("*").eq("mes_referencia", mes).single(),
                supabase.from("metas_closers").select("*").eq("mes_referencia", mes),
                crmQuery, adsQuery, prevAdsQuery,
            ]);

            return {
                lances: (lances || []) as LancamentoDiario[], prevLances: (prevLances || []) as LancamentoDiario[],
                config, prevConfig, closers: (closersData || []) as Closer[], contratos: (contratosData || []) as Contrato[],
                metaData: (metaData || null) as MetaMensal | null, mcData: (mcData || []) as MetaCloser[],
                crmData: (crmData || []) as LeadCrm[], adsPerf: adsPerf || [], prevAdsPerf: prevAdsPerf || [],
            };
        },
        { revalidateOnFocus: false, dedupingInterval: 10000, keepPreviousData: true }
    );

    // Real-time (debounce via mutate direto invés de timers estáticos perigosos)
    useEffect(() => {
        let timeout: NodeJS.Timeout;
        const debouncedMutate = () => {
            clearTimeout(timeout);
            timeout = setTimeout(() => mutateDb(), 3000);
        };

        // We only need to listen to inserts/updates conceptually if changes occur, but for now we debounce
        const channel = supabase.channel("dashboard-rt")
            .on("postgres_changes", { event: "*", schema: "public", table: "leads_crm" }, debouncedMutate)
            .on("postgres_changes", { event: "*", schema: "public", table: "lancamentos_diarios" }, debouncedMutate)
            .on("postgres_changes", { event: "*", schema: "public", table: "contratos" }, debouncedMutate)
            .subscribe();

        return () => { clearTimeout(timeout); supabase.removeChannel(channel); };
    }, [mutateDb]);

    // 2. Background APIs Paralelas (Sem bloquear SWR core)
    const { data: realData } = useSWR(
        dbData ? `/api/meta-spend?since=${startDate}&until=${endDate}` : null,
        async (url) => {
            try {
                const res = await fetch(url);
                if (!res.ok) throw new Error("Meta Ads erro");
                return await res.json();
            } catch (err) {
                addError("Falha na API Meta Ads");
                return null;
            }
        },
        { revalidateOnFocus: false, dedupingInterval: 60000, keepPreviousData: true }
    );

    const { data: despesasData } = useSWR(
        dbData ? `/api/despesas?mes=${mes}` : null,
        async (url) => {
            try {
                const res = await fetch(url);
                if (!res.ok) throw new Error("Despesas erro");
                return await res.json();
            } catch (err) {
                addError("Falha ao puxar Custos Asaas");
                return { total: 0 };
            }
        },
        { revalidateOnFocus: false, keepPreviousData: true }
    );

    const { data: ghlData } = useSWR(
        "/api/ghl-funnel",
        async (url) => {
            try {
                const res = await fetch(url);
                if (!res.ok) throw new Error("GHL erro");
                return await res.json();
            } catch (err) {
                addError("Falha no tunel do GoHighLevel");
                return { sdrAlerts: [], closers: [] };
            }
        },
        { revalidateOnFocus: false, dedupingInterval: 120000, keepPreviousData: true }
    );

    const { data: churnDataResult } = useSWR(
        ["churn", mes],
        async () => {
            try {
                const [notionRes, sbRes] = await Promise.all([
                    fetch("/api/notion-churn").catch(() => null),
                    fetch("/api/churn").catch(() => null),
                ]);

                const notionData = notionRes && notionRes.ok ? await notionRes.json() : { churns: [] };
                const sbData = sbRes && sbRes.ok ? await sbRes.json() : { clientes: [], resumo: null };

                if (!notionRes || !notionRes.ok) addError("API do Notion indisponível (Churn)");

                const mesAtual = new Date().toISOString().slice(0, 7);
                const seen = new Set<string>();
                const all: { nome: string; status: string; valor: number; data: string; etapa: string }[] = [];

                for (const c of (notionData.churns || [])) {
                    const key = c.nome?.toLowerCase();
                    if (key && !seen.has(key)) {
                        seen.add(key);
                        all.push({ nome: c.nome, status: c.status, valor: c.valor, data: c.data, etapa: c.status });
                    }
                }
                for (const c of (sbData.clientes || [])) {
                    const key = c.nome?.toLowerCase();
                    if (key && !seen.has(key) && c.status === "cancelado") {
                        seen.add(key);
                        all.push({ nome: c.nome, status: c.etapa_churn || c.status, valor: Number(c.mrr), data: c.data_cancelamento, etapa: c.etapa_churn });
                    }
                }

                const churnsAtivos = all.filter((c) => c.etapa !== "Finalizado" && c.etapa !== "finalizado");
                const churnsMes = all.filter((c) => c.data?.startsWith(mesAtual));

                return {
                    churnsAtivos: churnsAtivos.length,
                    mrrEmRisco: churnsAtivos.reduce((s, c) => s + c.valor, 0),
                    mrrPerdidoMes: churnsMes.reduce((s, c) => s + c.valor, 0),
                    churnRate: sbData.resumo?.churnRate || 0
                };
            } catch (err) {
                return null;
            }
        },
        { revalidateOnFocus: false, keepPreviousData: true }
    );

    // 3. Derivações Protegidas por useMemo (SSOT approach for Race Conditions)
    const { kpis, prevKpis, metasClosers, alertas } = useMemo(() => {
        const listAlerts: { msg: string; tipo: "erro" | "aviso" }[] = [];
        if (!dbData) return { kpis: null, prevKpis: null, metasClosers: {}, alertas: listAlerts };

        // Correção de SSOT (Source of truth) do Meta Spend:
        // Se o realData via Meta Graph API for retornado (com erro=false), ele se sobrepõe
        // com garantias sobre o banco. Sem chaveamento intermitente graças a isso.
        let metaSpend = dbData.adsPerf.reduce((s: number, r: { spend: number; leads: number }) => s + Number(r.spend || 0), 0);
        let metaLeads = dbData.adsPerf.reduce((s: number, r: { spend: number; leads: number }) => s + Number(r.leads || 0), 0);

        if (realData && !realData.error && realData.spend > 0) {
            metaSpend = realData.spend;
            metaLeads = realData.leads;
        }

        const prevMetaSpend = dbData.prevAdsPerf.reduce((s: number, r: { spend: number; leads: number }) => s + Number(r.spend || 0), 0);
        const prevMetaLeads = dbData.prevAdsPerf.reduce((s: number, r: { spend: number; leads: number }) => s + Number(r.leads || 0), 0);

        const k = calcKpis(dbData.lances, dbData.config, { contratos: dbData.contratos, crmLeads: dbData.crmData, metaSpend, metaLeads });
        const p = calcKpis(dbData.prevLances, dbData.prevConfig, { metaSpend: prevMetaSpend, metaLeads: prevMetaLeads });

        const mcMap: Record<string, MetaCloser> = {};
        for (const m of dbData.mcData) mcMap[m.closer_id] = m;

        // Aninhando Geração de Alertas aqui (evita poluir View e render re-calculations)
        const RESULTADO_TIME_MINIMO = 2000;
        const formatCurrency = (v: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);
        const formatPercent = (v: number) => `${v.toFixed(1)}%`;

        if (k.resultadoTime < RESULTADO_TIME_MINIMO) listAlerts.push({ msg: `Resultado do Time em ${formatCurrency(k.resultadoTime)} — abaixo do mínimo esperado (${formatCurrency(RESULTADO_TIME_MINIMO)}). Revise desempenho dos closers.`, tipo: "erro" });
        if (k.percentNoShow > 30) listAlerts.push({ msg: `No-Show em ${formatPercent(k.percentNoShow)} — acima de 30%. Ação necessária.`, tipo: "erro" });
        if (k.roas > 0 && k.roas < 2) listAlerts.push({ msg: `ROAS em ${k.roas.toFixed(2)} — abaixo de 2x. Revisar investimento.`, tipo: "erro" });
        if (k.contratosGanhos === 0 && k.reunioesFeitas > 10) listAlerts.push({ msg: "Nenhum contrato fechado com mais de 10 reuniões feitas.", tipo: "erro" });

        // Correção Tabela CRM (Divergência "Comprou" / Contrato) usando Array groupBy approach O(1)
        const mrrLanc = k.mrrTotal;
        const mrrContratos = dbData.contratos.reduce((s, c) => s + Number(c.mrr), 0);

        const countComprou = dbData.crmData.filter(l => l.etapa === "comprou").length;
        if (k.contratosGanhos > 0 && countComprou !== k.contratosGanhos) {
            listAlerts.push({ msg: `Divergência em "Comprou": Lançamentos=${k.contratosGanhos}, CRM=${countComprou}. Corrija a etapa no CRM.`, tipo: "aviso" });
        }

        if (mrrLanc > 0 && mrrContratos > 0 && Math.abs(mrrLanc - mrrContratos) > 1) {
            listAlerts.push({ msg: `Divergência em MRR: Lançamentos=${formatCurrency(mrrLanc)}, Contratos=${formatCurrency(mrrContratos)}.`, tipo: "aviso" });
        }

        // GHL/SDR Limits errors and alerts are tracked statically on the component return to avoid loops

        return { kpis: k, prevKpis: p, metasClosers: mcMap, alertas: listAlerts };
    }, [dbData, realData]);

    // Loading unificado evitando Flashes
    const loading = (isDbLoading && !dbData) || !kpis;

    // Corrigindo Type Any GHL Closers safely
    interface GhlCloser { name: string; aberto?: number; }
    const safeGhlClosers = Array.isArray(ghlData?.closers)
        ? (ghlData.closers as GhlCloser[]).map((c) => ({ name: c.name || "Desconhecido", aberto: c.aberto || 0 }))
        : [];

    return {
        kpis,
        prevKpis,
        meta: dbData?.metaData || null,
        contratos: dbData?.contratos || [],
        closers: dbData?.closers || [],
        lancamentos: dbData?.lances || [],
        crmLeads: dbData?.crmData || [],
        sdrAlerts: ghlData?.sdrAlerts || [],
        ghlClosersOpen: safeGhlClosers,
        churnData: churnDataResult || null,
        custosOp: despesasData?.total || 0,
        loading,
        alertas,
        metasClosers,
        loadData: mutateDb,
        attrStart: realData?.attrStart || null, // Se presente
        apiErrors
    };
}
