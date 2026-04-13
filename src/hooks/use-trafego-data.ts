"use client";

import useSWR from "swr";
import { supabase } from "@/lib/supabase";
import type { AdsMetadata, AdsPerformance, LeadAdsAttribution } from "@/types/database";

export interface TrafegoData {
    metadata: AdsMetadata[];
    performance: AdsPerformance[];
    leads: LeadAdsAttribution[];
    prevPerformance: AdsPerformance[];
    prevLeads: LeadAdsAttribution[];
    attrStartIso: string;
}

export function useTrafegoData(dataInicio: string, dataFim: string, statusFiltro: string) {
    return useSWR<TrafegoData>(
        ["trafego-data", dataInicio, dataFim, statusFiltro],
        async () => {
            let metaQuery = supabase.from("ads_metadata").select("*");
            if (statusFiltro !== "all") metaQuery = metaQuery.eq("status", statusFiltro);

            const attrRes = await fetch("/api/trafego/attribution-start").then((r) => r.json()).catch(() => null);
            const attrStartIso: string = attrRes?.attribution_start || "2026-04-03T23:21:18.000Z";

            const inicio = new Date(dataInicio + "T00:00:00");
            const fim = new Date(dataFim + "T23:59:59");
            const dias = Math.ceil((fim.getTime() - inicio.getTime()) / 86400000);
            const prevFimDate = new Date(inicio); prevFimDate.setDate(prevFimDate.getDate() - 1);
            const prevInicioDate = new Date(prevFimDate); prevInicioDate.setDate(prevInicioDate.getDate() - dias);
            const pi = prevInicioDate.toISOString().split("T")[0];
            const pf = prevFimDate.toISOString().split("T")[0];

            const filtroInicioIso = dataInicio + "T00:00:00.000Z";
            const leadsStart = filtroInicioIso > attrStartIso ? filtroInicioIso : attrStartIso;
            const prevLeadsStart = (pi + "T00:00:00.000Z") > attrStartIso ? (pi + "T00:00:00.000Z") : attrStartIso;

            const [{ data: m }, { data: p }, { data: l }, { data: pp }, { data: pl }] = await Promise.all([
                metaQuery,
                supabase.from("ads_performance").select("*").gte("data_ref", dataInicio).lte("data_ref", dataFim).order("data_ref"),
                supabase.from("leads_ads_attribution").select("*").gte("created_at", leadsStart).lte("created_at", dataFim + "T23:59:59").limit(5000),
                supabase.from("ads_performance").select("*").gte("data_ref", pi).lte("data_ref", pf).order("data_ref"),
                supabase.from("leads_ads_attribution").select("*").gte("created_at", prevLeadsStart).lte("created_at", pf + "T23:59:59").limit(5000),
            ]);

            return {
                metadata: (m || []) as AdsMetadata[],
                performance: (p || []) as AdsPerformance[],
                leads: (l || []) as LeadAdsAttribution[],
                prevPerformance: (pp || []) as AdsPerformance[],
                prevLeads: (pl || []) as LeadAdsAttribution[],
                attrStartIso
            };
        },
        {
            revalidateOnFocus: false,
            dedupingInterval: 30000,
            keepPreviousData: true
        }
    );
}
