import type { ReactNode } from "react";
import { cn } from "./cn";

type Tone = "accent" | "warning" | "danger" | "success" | "neutral";

const styles: Record<Tone, { active: string; idle: string }> = {
  accent: { active: "bg-accent text-on-accent", idle: "bg-accent-soft text-accent" },
  warning: { active: "bg-warning text-on-accent", idle: "bg-warning-soft text-warning" },
  danger: { active: "bg-danger text-on-accent", idle: "bg-danger-soft text-danger" },
  success: { active: "bg-success text-on-accent", idle: "bg-success-soft text-success" },
  neutral: { active: "bg-surface-sunken text-text-primary", idle: "bg-surface-sunken text-text-secondary" },
};

export function Pill({
  active,
  tone = "accent",
  className,
  children,
}: {
  active?: boolean;
  tone?: Tone;
  className?: string;
  children: ReactNode;
}) {
  return (
    <span
      className={cn(
        "inline-flex min-h-8 items-center rounded-full px-3 text-caption",
        active ? styles[tone].active : styles[tone].idle,
        className,
      )}
    >
      {children}
    </span>
  );
}
