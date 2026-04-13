/**
 * Helper para chamadas paginadas à Meta Marketing API.
 * Server-side only — nunca importar no cliente.
 *
 * Usa getCachedMetaData para cache em memória com TTL por tipo de dado.
 * Registra chamadas em sistema_rate_limit_log automaticamente.
 */

import { getCachedMetaData, getTTLForEndpoint } from "@/lib/meta-cache";

const TOKEN = () => process.env.META_ADS_ACCESS_TOKEN || "";
const ACCOUNT = () => process.env.META_ADS_ACCOUNT_ID || "";
const BASE = "https://graph.facebook.com/v21.0";

interface MetaFetchOptions {
  endpoint: string; // ex: "insights", "ads"
  fields: string;
  params?: Record<string, string>;
  datePreset?: string;
  since?: string;
  until?: string;
  /** Filtrar por status: "ACTIVE", "PAUSED", ou undefined para todos */
  statusFilter?: string;
  /** Forçar bypass do cache */
  skipCache?: boolean;
}

interface MetaResponse<T> {
  data: T[];
  error?: string;
  from_cache?: boolean;
  rate_limited?: boolean;
}

async function rawMetaFetch<T>(options: MetaFetchOptions): Promise<T[]> {
  const token = TOKEN();
  const account = ACCOUNT();

  const queryParams = new URLSearchParams({
    access_token: token,
    fields: options.fields,
    limit: "500",
    ...options.params,
  });

  if (options.since && options.until) {
    queryParams.set("time_range", JSON.stringify({ since: options.since, until: options.until }));
  } else if (options.datePreset) {
    queryParams.set("date_preset", options.datePreset);
  }

  if (options.statusFilter && options.statusFilter !== "ALL") {
    queryParams.set("filtering", JSON.stringify([{ field: "ad.effective_status", operator: "IN", value: [options.statusFilter] }]));
  }

  const url = `${BASE}/${account}/${options.endpoint}?${queryParams.toString()}`;
  const allData: T[] = [];

  const firstRes: Response = await fetch(url);
  if (!firstRes.ok) {
    const errText = await firstRes.text();
    let errMsg = `Meta API retornou ${firstRes.status}`;
    try { errMsg = JSON.parse(errText)?.error?.message || errMsg; } catch {}
    throw new Error(errMsg);
  }
  const firstBody = await firstRes.json();
  allData.push(...((firstBody.data || []) as T[]));

  let nextUrl: string | undefined = firstBody.paging?.next;
  while (nextUrl) {
    const pageRes: Response = await fetch(nextUrl);
    if (!pageRes.ok) break;
    const pageBody = await pageRes.json();
    allData.push(...((pageBody.data || []) as T[]));
    nextUrl = pageBody.paging?.next;
  }

  return allData;
}

/**
 * Busca dados paginados da Meta Marketing API com cache.
 * Itera por todas as páginas até não haver "next" no cursor.
 * Retorna { data, error, from_cache, rate_limited }.
 */
export async function metaFetchPaginated<T = Record<string, unknown>>(options: MetaFetchOptions): Promise<MetaResponse<T>> {
  const token = TOKEN();
  const account = ACCOUNT();

  if (!token || !account) {
    return { data: [], error: "META_ADS_ACCESS_TOKEN ou META_ADS_ACCOUNT_ID não configurados" };
  }

  // Construir params de cache key
  const cacheParams: Record<string, string> = {
    fields: options.fields,
    ...(options.params || {}),
    ...(options.since ? { since: options.since } : {}),
    ...(options.until ? { until: options.until } : {}),
    ...(options.datePreset ? { datePreset: options.datePreset } : {}),
    ...(options.statusFilter ? { statusFilter: options.statusFilter } : {}),
  };

  const ttl = getTTLForEndpoint(options.endpoint);

  if (options.skipCache) {
    try {
      const data = await rawMetaFetch<T>(options);
      return { data };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`[meta-fetch] Erro em ${options.endpoint}: ${msg}`);
      return { data: [], error: msg };
    }
  }

  try {
    const result = await getCachedMetaData<T[]>(
      options.endpoint,
      cacheParams,
      ttl,
      () => rawMetaFetch<T>(options),
    );
    return {
      data: result.data,
      from_cache: result.from_cache,
      rate_limited: result.rate_limited,
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[meta-fetch] Exceção em ${options.endpoint}: ${msg}`);
    return { data: [], error: msg };
  }
}
