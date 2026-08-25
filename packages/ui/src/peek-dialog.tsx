"use client";

import * as Dialog from "@radix-ui/react-dialog";
import type { ReactNode } from "react";
import { CloseIcon } from "./icons";
import { IconButton } from "./icon-button";

export function PeekDialog({
  open,
  onOpenChange,
  title,
  children,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  children: ReactNode;
}) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-surface-inverse/40" />
        <Dialog.Content
          className="fixed left-1/2 top-1/2 z-50 flex max-h-[min(85dvh,40rem)] w-[min(40rem,calc(100vw-1.5rem))] -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-2xl bg-surface-elevated shadow-float focus-visible:outline-hidden"
          aria-describedby={undefined}
        >
          <div className="flex shrink-0 items-center gap-2 border-b border-stroke px-3 py-2">
            <Dialog.Title className="min-w-0 flex-1 truncate text-heading font-semibold text-text-primary">
              {title}
            </Dialog.Title>
            <Dialog.Close asChild>
              <IconButton label="閉じる">
                <CloseIcon />
              </IconButton>
            </Dialog.Close>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto p-4">{children}</div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
