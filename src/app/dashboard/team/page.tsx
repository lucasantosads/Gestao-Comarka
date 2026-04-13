import { redirect } from "next/navigation";

// /dashboard/team foi descontinuada — conteúdo consolidado em /equipe-geral
export default function Page() {
  redirect("/equipe-geral");
}
