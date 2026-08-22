"use client";

import * as Dropdown from "@radix-ui/react-dropdown-menu";
import type { ReactNode } from "react";
import { cn } from "./cn";
import { CheckIcon } from "./icons";

export function Menu({
  trigger,
  children,
}: {
  trigger: ReactNode;
  children: ReactNode;
}) {
  return (
    <Dropdown.Root>
      <Dropdown.Trigger asChild>{trigger}</Dropdown.Trigger>
      <Dropdown.Portal>
        <Dropdown.Content
          align="end"
          sideOffset={8}
          className="z-50 min-w-52 rounded-xl border border-stroke bg-surface-elevated p-1 shadow-float"
        >
          {children}
        </Dropdown.Content>
      </Dropdown.Portal>
    </Dropdown.Root>
  );
}

export function MenuLabel({ children }: { children: ReactNode }) {
  return <Dropdown.Label className="px-3 py-2 text-caption text-text-muted">{children}</Dropdown.Label>;
}

export function MenuSeparator() {
  return <Dropdown.Separator className="my-1 h-px bg-stroke" />;
}

export function MenuItem({
  onSelect,
  disabled,
  destructive,
  children,
}: {
  onSelect?: () => void;
  disabled?: boolean;
  destructive?: boolean;
  children: ReactNode;
}) {
  return (
    <Dropdown.Item
      disabled={disabled}
      onSelect={onSelect}
      className={cn(
        "flex min-h-11 cursor-pointer items-center rounded-lg px-3 text-ui outline-hidden",
        "data-[highlighted]:bg-accent-soft",
        "data-[disabled]:opacity-50",
        destructive ? "text-danger" : "text-text-primary",
      )}
    >
      {children}
    </Dropdown.Item>
  );
}

export function MenuRadioGroup({
  value,
  onValueChange,
  children,
}: {
  value: string;
  onValueChange: (value: string) => void;
  children: ReactNode;
}) {
  return (
    <Dropdown.RadioGroup value={value} onValueChange={onValueChange}>
      {children}
    </Dropdown.RadioGroup>
  );
}

export function MenuRadioItem({ value, children }: { value: string; children: ReactNode }) {
  return (
    <Dropdown.RadioItem
      value={value}
      className="flex min-h-11 cursor-pointer items-center gap-2 rounded-lg px-3 text-ui text-text-primary outline-hidden data-[highlighted]:bg-accent-soft"
    >
      <span className="inline-flex size-4 items-center justify-center">
        <Dropdown.ItemIndicator>
          <CheckIcon className="size-4 text-accent" />
        </Dropdown.ItemIndicator>
      </span>
      {children}
    </Dropdown.RadioItem>
  );
}
