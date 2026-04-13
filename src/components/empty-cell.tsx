/**
 * Célula padronizada para estados vazios nas tabelas de /trafego/*.
 *
 * - value null/undefined  → "—" (dado inexistente)
 * - reason="missing"      → "Sem dados" em muted (integração ausente)
 * - value === 0 && allowZero → "0" (zero real, ex: 0 reuniões feitas)
 * - value === 0 (default) → "—"
 */
interface EmptyCellProps {
  value?: number | string | null;
  reason?: "missing";
  allowZero?: boolean;
  render?: (v: number | string) => string;
  className?: string;
}

export function EmptyCell({ value, reason, allowZero, render, className }: EmptyCellProps) {
  if (reason === "missing") {
    return <span className={`text-muted-foreground text-[11px] ${className || ""}`}>Sem dados</span>;
  }
  if (value === null || value === undefined) {
    return <span className={`text-muted-foreground ${className || ""}`}>—</span>;
  }
  if (value === 0 && !allowZero) {
    return <span className={`text-muted-foreground ${className || ""}`}>—</span>;
  }
  return <span className={className}>{render ? render(value) : String(value)}</span>;
}
