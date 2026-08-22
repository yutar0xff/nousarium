import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import "./globals.css";
import { ServiceWorkerRegister } from "../components/sw-register";
import { THEME_BOOTSTRAP } from "../lib/theme";
import { ToastProvider, TooltipProvider } from "@nousarium/ui";

export const metadata: Metadata = {
  title: "Nousarium",
  description: "対話から知識空間を育てる",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    title: "Nousarium",
  },
};

export const viewport: Viewport = {
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f4f1ea" },
    { media: "(prefers-color-scheme: dark)", color: "#171612" },
  ],
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="ja" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_BOOTSTRAP }} />
      </head>
      <body className="min-h-dvh bg-surface font-sans text-body text-text-primary antialiased">
        <TooltipProvider>
          <ToastProvider>
            <ServiceWorkerRegister />
            {children}
          </ToastProvider>
        </TooltipProvider>
      </body>
    </html>
  );
}
