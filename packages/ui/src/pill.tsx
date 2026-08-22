import type { ReactNode } from "react";

export function Pill({
  active,
  tone = "accent",
  children,
}: {
  active?: boolean;
  tone?: "accent" | "warning";
  children: ReactNode;
}) {
  const styles =
    tone === "warning"
      ? active
        ? "bg-warning text-white"
        : "bg-warning/15 text-warning"
      : active
        ? "bg-accent text-white"
        : "bg-accent-soft text-accent";
  return (
    <span className={`inline-flex min-h-8 items-center rounded-full px-3 text-xs ${styles}`}>{children}</span>
  );
}
