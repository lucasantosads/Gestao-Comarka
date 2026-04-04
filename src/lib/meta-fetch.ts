/**
 * Helper para chamadas paginadas à Meta Marketing API.
 * Server-side only — nunca importar no cliente.
 */

const TOKEN = () => process.env.META_ADS_ACCESS_TOKEN || "";
const ACCOUNT = () => process.env.META_ADS_ACCOUNT_ID || "";
const BASE = "https://graph.facebook.com/v19.0";

interface MetaFetchOptions {
  endpoint: string; // ex: "insights", "ads"
  fields: string;
  params?: Record<string, string>;
  datePreset?: string;
  since?: string;
  until?: string;
  /** Filtrar por status: "ACTIVE", "PAUSED", ou undefined para todos */
  statusFilter?: string;
}

interface MetaResponse<T> {
  data: T[];
  error?: string;
}

/**
 * Busca dados paginados da Meta Marketing API.
 * Itera por todas as páginas até não haver "next" no cursor.
 * Retorna { data, error }.
 */
export async function metaFetchPaginated<T = Record<string, unknown>>(options: MetaFetchOptions): Promise<MetaResponse<T>> {
  const token = TOKEN();
  const account = ACCOUNT();

  if (!token || !account) {
    return { data: [], error: "META_ADS_ACCESS_TOKEN ou META_ADS_ACCOUNT_ID não configurados" };
  }

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

  try {
    // Primeira página
    const firstRes: Response = await fetch(url);
    if (!firstRes.ok) {
      const errText = await firstRes.text();
      let errMsg = `Meta API retornou ${firstRes.status}`;
      try { errMsg = JSON.parse(errText)?.error?.message || errMsg; } catch {}
      console.error(`[meta-fetch] Erro em ${options.endpoint}: ${errMsg}`);
      return { data: [], error: errMsg };
    }
    const firstBody = await firstRes.json();
    allData.push(...((firstBody.data || []) as T[]));

    // Páginas seguintes
    let nextUrl: string | undefined = firstBody.paging?.next;
    while (nextUrl) {
      const pageRes: Response = await fetch(nextUrl);
      if (!pageRes.ok) break;
      const pageBody = await pageRes.json();
      allData.push(...((pageBody.data || []) as T[]));
      nextUrl = pageBody.paging?.next;
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[meta-fetch] Exceção em ${options.endpoint}: ${msg}`);
    return { data: allData, error: msg };
  }

  return { data: allData };
}
