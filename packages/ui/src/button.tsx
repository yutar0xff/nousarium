import type { ButtonHTMLAttributes, ReactNode } from "react";
import { cn } from "./cn";
import { buttonClassName, type ButtonVariant } from "./button-styles";

export function Button({
  variant = "primary",
  className,
  children,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: ButtonVariant; children: ReactNode }) {
  return (
    <button
      className={buttonClassName(
        variant,
        cn("inline-flex h-11 min-h-11 items-center justify-center px-4 text-ui font-medium", className),
      )}
      {...props}
    >
      {children}
    </button>
  );
}
