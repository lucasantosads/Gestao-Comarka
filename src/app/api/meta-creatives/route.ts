/**
 * Route 4 — Thumbnails e status dos criativos.
 * GET /api/meta-creatives
 *
 * Response shape:
 * { data: RawMetaCreative[], error?: string }
 */
import { NextResponse } from "next/server";
import { metaFetchPaginated } from "@/lib/meta-fetch";
import type { RawMetaCreative } from "@/lib/types/metaVideo";

interface MetaAdRaw {
  id: string;
  name: string;
  status: string;
  created_time: string;
  creative?: {
    thumbnail_url?: string;
    video_id?: string;
  };
}

export async function GET() {
  const result = await metaFetchPaginated<MetaAdRaw>({
    endpoint: "ads",
    fields: "id,name,status,created_time,creative{thumbnail_url,video_id}",
    params: { limit: "100" },
  });

  if (result.error && result.data.length === 0) {
    return NextResponse.json({ data: [], error: result.error }, { status: 500 });
  }

  // Filtrar deletados e normalizar
  const creatives: RawMetaCreative[] = result.data
    .filter((ad) => ad.status !== "DELETED")
    .map((ad) => ({
      id: ad.id,
      name: ad.name,
      status: ad.status,
      created_time: ad.created_time,
      thumbnail_url: ad.creative?.thumbnail_url,
      video_id: ad.creative?.video_id,
    }));

  return NextResponse.json({ data: creatives, error: result.error });
}
