"use client";

import * as ToastPrimitive from "@radix-ui/react-toast";
import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import { cn } from "./cn";

type Tone = "success" | "danger" | "neutral";

type ToastItem = {
  id: number;
  title: string;
  tone: Tone;
};

type ToastApi = {
  toast: (title: string, tone?: Tone) => void;
};

const ToastContext = createContext<ToastApi | null>(null);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);

  const toast = useCallback((title: string, tone: Tone = "success") => {
    const id = Date.now() + Math.random();
    setItems((current) => [...current, { id, title, tone }]);
  }, []);

  const value = useMemo(() => ({ toast }), [toast]);

  return (
    <ToastContext.Provider value={value}>
      <ToastPrimitive.Provider swipeDirection="right" duration={3200}>
        {children}
        {items.map((item) => (
          <ToastPrimitive.Root
            key={item.id}
            onOpenChange={(open) => {
              if (!open) setItems((current) => current.filter((row) => row.id !== item.id));
            }}
            className={cn(
              "rounded-xl border border-stroke bg-surface-elevated px-4 py-3 text-ui text-text-primary shadow-float",
              item.tone === "success" && "border-success/40",
              item.tone === "danger" && "border-danger/40",
            )}
          >
            <ToastPrimitive.Title>{item.title}</ToastPrimitive.Title>
          </ToastPrimitive.Root>
        ))}
        <ToastPrimitive.Viewport className="fixed top-4 right-4 z-[60] flex w-[min(22rem,calc(100vw-2rem))] flex-col gap-2 outline-hidden" />
      </ToastPrimitive.Provider>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastApi {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    return {
      toast: () => undefined,
    };
  }
  return ctx;
}
