/**
 * GET /api/trafego/attribution-start
 * Retorna a data do primeiro lead com ad_id populado. Usada pelas páginas
 * client-side de /trafego/* para aplicar o "ponto de corte" no cruzamento
 * CRM × tráfego.
 */
import { NextResponse } from "next/server";
import { attributionStartDate } from "@/lib/trafego-attribution";

export const dynamic = "force-dynamic";

export async function GET() {
  const date = await attributionStartDate();
  return NextResponse.json({ attribution_start: date });
}
