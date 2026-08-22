import { cn } from "./cn";

export type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";

export const buttonVariantClass: Record<ButtonVariant, string> = {
  primary: "bg-accent text-on-accent hover:bg-accent-strong",
  secondary: "bg-accent-soft text-accent hover:opacity-90",
  ghost: "bg-transparent text-text-primary hover:bg-accent-soft",
  danger: "bg-danger text-on-accent hover:opacity-90",
};

export const buttonChromeClass =
  "rounded-lg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-stroke-strong disabled:opacity-50";

export function buttonClassName(variant: ButtonVariant, className?: string) {
  return cn(buttonChromeClass, buttonVariantClass[variant], className);
}
