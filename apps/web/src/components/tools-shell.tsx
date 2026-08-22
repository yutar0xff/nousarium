"use client";

import type { ReactNode } from "react";
import { AppShell } from "./app-shell";
import { ChromeProvider } from "./chrome-context";

export function ToolsShell({ children }: { children: ReactNode }) {
  return (
    <ChromeProvider>
      <AppShell>{children}</AppShell>
    </ChromeProvider>
  );
}
