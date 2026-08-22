"use client";

import * as SwitchPrimitive from "@radix-ui/react-switch";
import { cn } from "./cn";

export function Switch({
  checked,
  onCheckedChange,
  disabled,
  id,
  label,
  showLabel = true,
}: {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  disabled?: boolean;
  id?: string;
  label?: string;
  showLabel?: boolean;
}) {
  return (
    <label className="inline-flex h-11 shrink-0 items-center gap-2 text-ui text-text-primary">
      <SwitchPrimitive.Root
        id={id}
        checked={checked}
        onCheckedChange={onCheckedChange}
        disabled={disabled}
        aria-label={label}
        className={cn(
          "relative h-7 w-12 shrink-0 rounded-full border border-stroke bg-surface-sunken",
          "data-[state=checked]:border-accent data-[state=checked]:bg-accent",
          "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-stroke-strong",
          "disabled:opacity-50",
        )}
      >
        <SwitchPrimitive.Thumb
          className={cn(
            "block size-5 translate-x-1 rounded-full bg-surface-elevated transition-transform",
            "data-[state=checked]:translate-x-6 data-[state=checked]:bg-on-accent",
          )}
        />
      </SwitchPrimitive.Root>
      {label && showLabel ? <span className="max-md:hidden">{label}</span> : null}
    </label>
  );
}
