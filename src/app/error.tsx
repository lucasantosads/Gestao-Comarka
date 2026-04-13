"use client";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div style={{ padding: 32, fontFamily: "system-ui, sans-serif" }}>
      <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 8 }}>Erro</h2>
      <pre
        style={{
          background: "#1e1e1e",
          color: "#f87171",
          padding: 12,
          borderRadius: 6,
          fontSize: 12,
          whiteSpace: "pre-wrap",
          maxWidth: 800,
          overflow: "auto",
        }}
      >
        {error?.message || "Algo deu errado."}
        {error?.stack ? "\n\n" + error.stack : ""}
      </pre>
      {error?.digest && <p style={{ fontSize: 11, color: "#71717a", marginTop: 6 }}>digest: {error.digest}</p>}
      <button
        onClick={() => reset()}
        style={{
          marginTop: 12,
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
    </div>
  );
}
