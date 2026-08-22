import type { ButtonHTMLAttributes, ReactNode } from "react";
import { cn } from "./cn";

type Variant = "ghost" | "primary" | "danger" | "secondary";

const styles: Record<Variant, string> = {
  ghost: "bg-transparent text-text-primary hover:bg-accent-soft",
  primary: "bg-accent text-on-accent hover:bg-accent-strong",
  secondary: "bg-accent-soft text-accent hover:opacity-90",
  danger: "bg-danger text-on-accent hover:opacity-90",
};

export function IconButton({
  variant = "ghost",
  label,
  className,
  children,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant;
  label: string;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      className={cn(
        "inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-lg [&_svg]:size-6!",
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
