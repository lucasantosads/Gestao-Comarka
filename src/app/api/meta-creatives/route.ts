/**
 * Route 4 — Thumbnails, copy e status dos criativos.
 * GET /api/meta-creatives
 *
 * Puxa thumbnail_url, body (copy), title, image_url, link_url e CTA de cada anúncio.
 * Response shape:
 * { data: AdCreativeData[], error?: string }
 */
import { NextResponse } from "next/server";
import { metaFetchPaginated } from "@/lib/meta-fetch";

export const revalidate = 120; // Meta Ads data

interface MetaAdRaw {
  id: string;
  name: string;
  status: string;
  created_time: string;
  creative?: {
    thumbnail_url?: string;
    image_url?: string;
    video_id?: string;
    body?: string;
    title?: string;
    link_url?: string;
    call_to_action_type?: string;
    object_story_spec?: any;
  };
}

export interface AdCreativeData {
  id: string;
  name: string;
  status: string;
  created_time: string;
  thumbnail_url?: string;
  image_url?: string;
  video_id?: string;
  body?: string;
  title?: string;
  link_url?: string;
  call_to_action_type?: string;
}

export async function GET() {
  const result = await metaFetchPaginated<MetaAdRaw>({
    endpoint: "ads",
    fields: "id,name,status,created_time,creative{thumbnail_url,image_url,video_id,body,title,link_url,call_to_action_type,object_story_spec}",
    params: { limit: "50" },
  });

  if (result.error && result.data.length === 0) {
    return NextResponse.json({ data: [], error: result.error }, { status: 500 });
  }

  // Filtrar deletados e normalizar
  const creatives: AdCreativeData[] = result.data
    .filter((ad) => ad.status !== "DELETED")
    .map((ad) => {
      const spec = ad.creative?.object_story_spec as any;
      const highResImg = spec?.video_data?.image_url || spec?.link_data?.image_url || spec?.photo_data?.url;

      return {
        id: ad.id,
        name: ad.name,
        status: ad.status,
        created_time: ad.created_time,
        thumbnail_url: ad.creative?.thumbnail_url,
        image_url: highResImg || ad.creative?.image_url,
        video_id: ad.creative?.video_id,
        body: ad.creative?.body,
        title: ad.creative?.title,
        link_url: ad.creative?.link_url,
        call_to_action_type: ad.creative?.call_to_action_type,
      };
    });

  return NextResponse.json({ data: creatives, error: result.error });
}
