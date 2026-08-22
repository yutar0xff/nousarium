import type { ReactNode } from "react";

export function Pill({
  active,
  children,
}: {
  active?: boolean;
  children: ReactNode;
}) {
  return (
    <span
      className={`inline-flex min-h-8 items-center rounded-full px-3 text-xs ${
        active ? "bg-accent text-white" : "bg-accent-soft text-accent"
      }`}
    >
      {children}
    </span>
  );
}
