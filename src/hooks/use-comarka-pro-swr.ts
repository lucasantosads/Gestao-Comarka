import useSWR from "swr";

const fetcher = (url: string) => fetch(url, { credentials: "include" }).then((res) => res.json());

export type MeusPontos = {
    mes_referencia: string;
    pontos_mes: number;
    pontos_brutos: number;
    multiplicador_ativo: number;
    meses_sequencia: number;
    historico: { mes_referencia: string; pontos_finais: number; multiplicador_ativo: number }[];
    lancamentos: {
        id: string; categoria: string; pontos: number; descricao: string | null;
        origem: "automatico" | "manual"; criado_em: string;
    }[];
    posicoes: { mensal: number | null; trimestral: number | null; semestral: number | null; anual: number | null };
    metas_automaticas: { cronometro_pct: number; cronometro_dias: number; cronometro_dias_uteis: number };
};

export function useComarkaProSWR() {
    const { data, error, mutate, isLoading } = useSWR<MeusPontos>(
        "/api/comarka-pro/meus-pontos",
        fetcher,
        { revalidateOnFocus: true, dedupingInterval: 60000 }
    );

    return { data, isLoading, isError: !!error, mutate };
}
