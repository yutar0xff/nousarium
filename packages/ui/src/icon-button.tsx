import type { ButtonHTMLAttributes, ReactNode } from "react";
import { cn } from "./cn";
import { buttonClassName, type ButtonVariant } from "./button-styles";

type Layout = "icon" | "bar";

export function IconButtonSlot({ children }: { children: ReactNode }) {
  return <span className="inline-flex size-11 shrink-0 items-center justify-center">{children}</span>;
}

export function IconButton({
  variant = "ghost",
  layout = "icon",
  label,
  className,
  children,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  layout?: Layout;
  label: string;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      className={buttonClassName(
        variant,
        cn(
          "inline-flex h-11 items-center [&_svg]:size-6!",
          layout === "icon" ? "w-11 shrink-0 justify-center" : "w-auto min-w-0 flex-1 justify-start",
          className,
        ),
      )}
      {...props}
    >
      {children}
    </button>
  );
}

export function BarButton({
  label,
  start,
  end,
  children,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  label: string;
  start?: ReactNode;
  end?: ReactNode;
  children: ReactNode;
}) {
  return (
    <IconButton layout="bar" label={label} {...props}>
      {start ? <IconButtonSlot>{start}</IconButtonSlot> : null}
      <span className="min-w-0 flex-1 truncate text-left text-heading font-semibold">{children}</span>
      {end ? <IconButtonSlot>{end}</IconButtonSlot> : null}
    </IconButton>
  );
}
