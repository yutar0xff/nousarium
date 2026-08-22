import type { ButtonHTMLAttributes, ReactNode } from "react";
import { cn } from "./cn";

type Variant = "primary" | "secondary" | "ghost" | "danger";

const styles: Record<Variant, string> = {
  primary: "bg-accent text-on-accent hover:bg-accent-strong",
  secondary: "bg-accent-soft text-accent hover:opacity-90",
  ghost: "bg-transparent text-text-primary hover:bg-accent-soft",
  danger: "bg-danger text-on-accent hover:opacity-90",
};

export function Button({
  variant = "primary",
  className,
  children,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; children: ReactNode }) {
  return (
    <button
      className={cn(
        "inline-flex h-11 min-h-11 items-center justify-center rounded-lg px-4 text-ui font-medium",
        "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-stroke-strong",
        "disabled:opacity-50",
        styles[variant],
        className,
      )}
      {...props}
    >
      {children}
    </button>
  );
}
