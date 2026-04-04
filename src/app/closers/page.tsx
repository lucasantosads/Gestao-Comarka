"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import type { Closer } from "@/types/database";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { User } from "lucide-react";

export default function ClosersPage() {
  const [closers, setClosers] = useState<Closer[]>([]);

  useEffect(() => {
    supabase
      .from("closers")
      .select("*")
      .eq("ativo", true)
      .order("created_at")
      .then(({ data }) => {
        if (data) setClosers(data);
      });
  }, []);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Closers</h1>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {closers.map((c) => (
          <Link key={c.id} href={`/closer/${c.id}`}>
            <Card className="hover:border-primary/50 transition-colors cursor-pointer">
              <CardContent className="p-4 flex items-center gap-3">
                <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                  <User size={20} className="text-primary" />
                </div>
                <div>
                  <p className="font-medium">{c.nome}</p>
                  <Badge variant="outline" className="text-xs">
                    Ativo
                  </Badge>
                </div>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
