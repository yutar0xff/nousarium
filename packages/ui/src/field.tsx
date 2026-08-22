import type { ReactNode } from "react";
import { cn } from "./cn";

export function Field({
  label,
  hint,
  error,
  className,
  children,
}: {
  label: string;
  hint?: string;
  error?: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <label className={cn("flex flex-col gap-1 text-ui text-text-secondary", className)}>
      <span>{label}</span>
      {children}
      {hint && !error ? <span className="text-caption text-text-muted">{hint}</span> : null}
      {error ? <span className="text-caption text-danger">{error}</span> : null}
    </label>
  );
}
