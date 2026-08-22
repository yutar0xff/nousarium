import type { ButtonHTMLAttributes, ReactNode } from "react";

type Variant = "primary" | "secondary" | "ghost" | "danger";

const styles: Record<Variant, string> = {
  primary: "bg-accent text-white hover:opacity-90",
  secondary: "bg-accent-soft text-accent hover:opacity-90",
  ghost: "bg-transparent text-text-primary hover:bg-accent-soft",
  danger: "bg-danger text-white hover:opacity-90",
};

export function Button({
  variant = "primary",
  className = "",
  children,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; children: ReactNode }) {
  return (
    <button
      className={`inline-flex min-h-11 items-center justify-center rounded-sm px-4 text-sm font-medium disabled:opacity-50 ${styles[variant]} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}
