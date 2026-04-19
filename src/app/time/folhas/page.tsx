"use client";

import { Card, CardContent } from "@/components/ui/card";
import { FileText } from "lucide-react";

export default function FolhasPage() {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Folhas de Pagamento</h1>
      <Card className="bg-card/50 border-border/50">
        <CardContent className="flex flex-col items-center justify-center py-16 text-center">
          <FileText size={48} className="text-muted-foreground/30 mb-4" />
          <p className="text-lg font-medium text-muted-foreground">Em construção</p>
          <p className="text-sm text-muted-foreground/60 mt-1">O módulo de folhas de pagamento está sendo desenvolvido.</p>
        </CardContent>
      </Card>
    </div>
  );
}
