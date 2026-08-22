import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";
import { Shell } from "../components/shell";

export const metadata: Metadata = {
  title: "Nousarium",
  description: "対話から知識空間を育てる",
  manifest: "/manifest.webmanifest",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="ja">
      <body className="min-h-dvh antialiased">
        <Shell>{children}</Shell>
      </body>
    </html>
  );
}
