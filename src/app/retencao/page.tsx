"use client";

import { Suspense } from "react";
import dynamic from "next/dynamic";

const ChurnVisaoGeral = dynamic(() => import("@/app/churn/page"), { loading: () => <Loading /> });
const ChurnPipeline = dynamic(() => import("@/app/churn/pipeline/page"), { loading: () => <Loading /> });

function Loading() {
  return <div className="flex items-center justify-center h-64"><p className="text-muted-foreground">Carregando...</p></div>;
}

export default function ChurnUnificadoPage() {
  return (
    <Suspense fallback={<Loading />}>
      <div className="space-y-8">
        <ChurnVisaoGeral />
        <div className="border-t pt-6">
          <ChurnPipeline />
        </div>
      </div>
    </Suspense>
  );
}
