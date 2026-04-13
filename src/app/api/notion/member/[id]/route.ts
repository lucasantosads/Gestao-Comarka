import { NextRequest, NextResponse } from "next/server";
import { getTeam, getClientesByAnalista, getTarefasByPessoa, getReunioesByPessoa } from "@/lib/data";

export const dynamic = "force-dynamic";

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const team = await getTeam();
    const member = team.find((m) => m.notion_id.replace(/-/g, "") === params.id.replace(/-/g, ""));
    if (!member) return NextResponse.json({ error: "Membro não encontrado" }, { status: 404 });

    const nomeFirst = member.nome.split(" ")[0];
    const [clientes, tarefas, reunioes] = await Promise.all([
      getClientesByAnalista(nomeFirst),
      getTarefasByPessoa(member.nome),
      getReunioesByPessoa(member.nome),
    ]);

    return NextResponse.json({ member, clientes, tarefas, reunioes });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
