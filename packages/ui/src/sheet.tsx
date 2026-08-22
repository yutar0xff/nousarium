"use client";

import * as Dialog from "@radix-ui/react-dialog";
import type { ReactNode } from "react";
import { cn } from "./cn";
import { CloseIcon } from "./icons";
import { IconButton } from "./icon-button";

export function Sheet({
  open,
  onOpenChange,
  side = "left",
  title,
  start,
  children,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  side?: "left" | "right";
  title: string;
  start?: ReactNode;
  children: ReactNode;
}) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-surface-inverse/40" />
        <Dialog.Content
          className={cn(
            "fixed top-0 z-50 flex h-dvh w-[min(20rem,calc(100vw-2rem))] flex-col bg-surface-elevated shadow-float",
            "focus-visible:outline-hidden",
            side === "left" ? "left-0 rounded-r-2xl" : "right-0 rounded-l-2xl",
          )}
        >
          <div className="flex h-12 shrink-0 items-center border-b border-stroke px-2">
            {start ? (
              <Dialog.Close asChild>
                <IconButton label="閉じる" className="w-auto min-w-0 flex-1 justify-start">
                  {start}
                  <Dialog.Title asChild>
                    <span className="min-w-0 flex-1 truncate text-left text-heading font-semibold">
                      {title}
                    </span>
                  </Dialog.Title>
                  <span className="inline-flex size-11 shrink-0 items-center justify-center">
                    <CloseIcon />
                  </span>
                </IconButton>
              </Dialog.Close>
            ) : (
              <>
                <Dialog.Title className="min-w-0 flex-1 truncate px-1 text-heading font-semibold text-text-primary">
                  {title}
                </Dialog.Title>
                <Dialog.Close asChild>
                  <IconButton label="閉じる">
                    <CloseIcon />
                  </IconButton>
                </Dialog.Close>
              </>
            )}
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto">{children}</div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
