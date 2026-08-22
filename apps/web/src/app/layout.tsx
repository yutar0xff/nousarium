import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import "./globals.css";
import { ServiceWorkerRegister } from "../components/sw-register";

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
  themeColor: "#1c1917",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="ja">
      <body className="min-h-dvh antialiased">
        <ServiceWorkerRegister />
        {children}
      </body>
    </html>
  );
}
