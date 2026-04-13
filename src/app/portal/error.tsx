"use client";

import { useEffect } from "react";

export default function PortalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[portal/error]", error);
  }, [error]);

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] p-8 text-center space-y-3">
      <h2 className="text-xl font-bold">Erro no portal</h2>
      <p className="text-sm text-muted-foreground max-w-md">{error.message || "Algo deu errado."}</p>
      {error.digest && <p className="text-[10px] font-mono text-muted-foreground">digest: {error.digest}</p>}
      <button
        onClick={() => reset()}
        className="mt-2 px-4 py-2 text-sm bg-primary text-primary-foreground rounded-md"
      >
        Tentar novamente
      </button>
    </div>
  );
}
