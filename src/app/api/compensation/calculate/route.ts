import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { calculateCompensation } from "@/lib/commission";

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const employeeId = req.nextUrl.searchParams.get("employee_id") || session.employeeId;
  const mes = req.nextUrl.searchParams.get("mes") || new Date().toISOString().slice(0, 7);

  // Closer/SDR só pode ver o próprio
  if (session.role !== "admin" && employeeId !== session.employeeId) {
    return NextResponse.json({ error: "Acesso negado" }, { status: 403 });
  }

  const result = await calculateCompensation(employeeId, session.role === "admin" ? "closer" : session.role, session.entityId || "", mes);
  if (!result) return NextResponse.json({ error: "Configuração de compensação não encontrada para este mês" }, { status: 404 });

  return NextResponse.json(result);
}
