"use client";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html>
      <body style={{ fontFamily: "system-ui, sans-serif", padding: 40, color: "#fff", background: "#0a0a0a" }}>
        <h1 style={{ fontSize: 24, fontWeight: 700, marginBottom: 12 }}>Erro inesperado</h1>
        <p style={{ color: "#a1a1aa", marginBottom: 16 }}>{error.message || "Algo deu errado."}</p>
        {error.digest && <p style={{ fontSize: 12, color: "#71717a" }}>digest: {error.digest}</p>}
        <button
          onClick={() => reset()}
          style={{
            marginTop: 16,
            padding: "8px 16px",
            background: "#3b82f6",
            color: "#fff",
            border: 0,
            borderRadius: 6,
            cursor: "pointer",
          }}
        >
          Tentar novamente
        </button>
      </body>
    </html>
  );
}
